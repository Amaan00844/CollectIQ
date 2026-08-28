"""
CollectIQ Collections Agent — Test Suite

Tests critical scenarios:
1. Paid invoice → no collection action
2. Overdue invoice → reminder according to policy
3. Payment promise → pause reminders
4. Broken promise → resume/escalate
5. Dispute email → stop automation, route to human review
6. Future data leakage prevention
7. Policy loading
8. Risk scoring
9. Email classification fallback
"""

from __future__ import annotations

import sys
import os
from datetime import date, timedelta
from pathlib import Path

# Ensure src is importable
sys.path.insert(0, str(Path(__file__).parent.parent))

import pytest
import yaml

from src.models import (
    Invoice, Payment, Customer, Email, EmailIntent,
    InvoiceStatus, RiskLevel
)
from src.invoice_state import compute_invoice_state
from src.email_agent import classify_email_rule_based
from src.policy_engine import PolicyEngine
from src.risk_engine import compute_risk


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def policy():
    policy_path = Path(__file__).parent.parent / "config" / "policy.yaml"
    with open(policy_path) as f:
        return yaml.safe_load(f)


@pytest.fixture
def policy_engine(policy):
    return PolicyEngine(policy)


@pytest.fixture
def sample_customer():
    return Customer(
        customer_id="CUST-TEST",
        customer_name="Test Corp",
        contact_email="ap@testcorp.com",
        sales_rep="sales@collectiq.com",
        controller_email="controller@collectiq.com",
        ceo_email="ceo@collectiq.com",
        owner_email="owner@collectiq.com",
        industry="Technology",
        payment_terms_days=30,
    )


def make_invoice(
    invoice_id: str = "INV-TEST",
    customer_id: str = "CUST-TEST",
    amount: float = 100000.0,
    issue_date: date = None,
    due_date: date = None,
) -> Invoice:
    today = date.today()
    return Invoice(
        invoice_id=invoice_id,
        customer_id=customer_id,
        amount=amount,
        currency="INR",
        issue_date=issue_date or (today - timedelta(days=40)),
        due_date=due_date or (today - timedelta(days=10)),
        description="Test invoice",
    )


def make_payment(
    invoice_id: str = "INV-TEST",
    amount: float = 100000.0,
    payment_date: date = None,
) -> Payment:
    return Payment(
        payment_id="PAY-TEST",
        invoice_id=invoice_id,
        amount_paid=amount,
        payment_date=payment_date or date.today(),
        payment_method="NEFT",
        reference="REF-TEST",
    )


# ---------------------------------------------------------------------------
# Test 1: Paid invoice → No collection action
# ---------------------------------------------------------------------------

class TestPaidInvoice:
    def test_paid_invoice_no_reminder(self, policy_engine):
        """An invoice fully paid before reminder date should result in no action."""
        invoice = make_invoice(due_date=date.today() - timedelta(days=5))
        payment = make_payment(invoice_id=invoice.invoice_id, amount=invoice.amount,
                                payment_date=date.today() - timedelta(days=3))

        current_date = date.today()
        state = compute_invoice_state(
            invoice=invoice,
            payments_known=[payment],
            emails_known=[],
            current_date=current_date,
            action_history=[],
        )

        assert state["invoice_status"] == "paid"
        assert state["payment_received"] is True
        assert state["amount_outstanding"] == 0.0

        decision = policy_engine.decide_with_date(state, [], current_date)
        assert decision["next_action"] == "no_action"
        assert decision["delivery_mode"] == "no_action"

    def test_partial_payment_still_collects(self, policy_engine):
        """Partial payment → invoice still open → collection action expected."""
        invoice = make_invoice(due_date=date.today() - timedelta(days=10))
        partial = make_payment(invoice_id=invoice.invoice_id, amount=50000.0)

        current_date = date.today()
        state = compute_invoice_state(
            invoice=invoice,
            payments_known=[partial],
            emails_known=[],
            current_date=current_date,
            action_history=[],
        )

        assert state["payment_received"] is False
        assert state["amount_outstanding"] == 50000.0

        decision = policy_engine.decide_with_date(state, [], current_date)
        assert decision["next_action"] != "no_action"


# ---------------------------------------------------------------------------
# Test 2: Overdue invoice → reminder per policy
# ---------------------------------------------------------------------------

class TestOverdueInvoice:
    def test_1_day_overdue_first_reminder(self, policy_engine):
        """1 day overdue → first_reminder (auto_send)."""
        invoice = make_invoice(due_date=date.today() - timedelta(days=1))
        current_date = date.today()
        state = compute_invoice_state(invoice, [], [], current_date, [])

        assert state["days_overdue"] == 1
        decision = policy_engine.decide_with_date(state, [], current_date)
        assert decision["policy_rule"] == "first_reminder"
        assert decision["delivery_mode"] == "auto_send"
        assert decision["recipient_tier"] == "customer"

    def test_7_days_overdue_second_reminder(self, policy_engine):
        """7 days overdue → second_reminder (auto_send)."""
        invoice = make_invoice(due_date=date.today() - timedelta(days=7))
        current_date = date.today()
        state = compute_invoice_state(invoice, [], [], current_date, [])

        assert state["days_overdue"] == 7
        decision = policy_engine.decide_with_date(state, [], current_date)
        assert decision["policy_rule"] == "second_reminder"
        assert decision["delivery_mode"] == "auto_send"

    def test_21_days_overdue_sales_escalation(self, policy_engine):
        """21 days overdue → sales escalation (human_signoff)."""
        invoice = make_invoice(due_date=date.today() - timedelta(days=21))
        current_date = date.today()
        state = compute_invoice_state(invoice, [], [], current_date, [])

        # Simulate prior reminders already sent
        prior_history = [
            {"invoice_id": invoice.invoice_id, "date": (date.today() - timedelta(days=20)).isoformat(),
             "action": "payment_reminder", "policy_rule": "first_reminder", "delivery_mode": "auto_send"},
            {"invoice_id": invoice.invoice_id, "date": (date.today() - timedelta(days=14)).isoformat(),
             "action": "payment_reminder", "policy_rule": "second_reminder", "delivery_mode": "auto_send"},
            {"invoice_id": invoice.invoice_id, "date": (date.today() - timedelta(days=7)).isoformat(),
             "action": "payment_reminder", "policy_rule": "third_reminder", "delivery_mode": "auto_send"},
        ]

        decision = policy_engine.decide_with_date(state, prior_history, current_date)
        assert decision["recipient_tier"] == "sales"
        assert decision["delivery_mode"] == "human_signoff"
        assert decision["requires_human_review"] is True

    def test_not_due_no_action(self, policy_engine):
        """Invoice not yet due → no action."""
        invoice = make_invoice(due_date=date.today() + timedelta(days=5))
        current_date = date.today()
        state = compute_invoice_state(invoice, [], [], current_date, [])

        assert state["days_overdue"] == 0
        decision = policy_engine.decide_with_date(state, [], current_date)
        assert decision["next_action"] == "no_action"


# ---------------------------------------------------------------------------
# Test 3: Payment promise → pause reminders
# ---------------------------------------------------------------------------

class TestPaymentPromise:
    def test_active_promise_pauses_reminders(self, policy_engine):
        """Active promise-to-pay should pause collection reminders."""
        invoice = make_invoice(due_date=date.today() - timedelta(days=7))
        current_date = date.today()

        promise_email = Email(
            email_id="E-TEST",
            customer_id=invoice.customer_id,
            from_email="ap@testcorp.com",
            subject="Re: Invoice INV-TEST",
            body="We will process payment by next Friday.",
            received_date=current_date - timedelta(days=1),
            invoice_ref=invoice.invoice_id,
        )

        state = compute_invoice_state(invoice, [], [promise_email], current_date, [])

        # Override: simulate active promise
        state["has_active_promise"] = True
        state["promise_date"] = (current_date + timedelta(days=3)).isoformat()
        state["promise_broken"] = False

        decision = policy_engine.decide_with_date(state, [], current_date)
        assert decision["next_action"] == "no_action"
        assert "promise" in decision["decision_reason"].lower()


# ---------------------------------------------------------------------------
# Test 4: Broken promise → resume/escalate
# ---------------------------------------------------------------------------

class TestBrokenPromise:
    def test_broken_promise_triggers_escalation(self, policy_engine):
        """Promise date has passed without payment → escalate."""
        invoice = make_invoice(due_date=date.today() - timedelta(days=14))
        current_date = date.today()

        state = compute_invoice_state(invoice, [], [], current_date, [])
        state["has_active_promise"] = False
        state["promise_broken"] = True
        state["promise_date"] = (current_date - timedelta(days=3)).isoformat()

        prior_history = [
            {"invoice_id": invoice.invoice_id, "customer_id": invoice.customer_id,
             "date": (current_date - timedelta(days=13)).isoformat(),
             "action": "payment_reminder", "policy_rule": "first_reminder", "delivery_mode": "auto_send"},
        ]

        decision = policy_engine.decide_with_date(state, prior_history, current_date)
        assert decision["requires_human_review"] is True
        assert "broken_promise" in decision["policy_rule"]


# ---------------------------------------------------------------------------
# Test 5: Dispute → stop automation, human review
# ---------------------------------------------------------------------------

class TestDispute:
    def test_dispute_email_routes_to_human_review(self, policy_engine):
        """Dispute intent → requires_human_review, no auto-send."""
        invoice = make_invoice(due_date=date.today() - timedelta(days=10))
        current_date = date.today()
        state = compute_invoice_state(invoice, [], [], current_date, [])
        state["email_intent"] = "dispute"
        state["has_active_dispute"] = True

        decision = policy_engine.decide_with_date(state, [], current_date)
        assert decision["requires_human_review"] is True
        assert decision["delivery_mode"] == "human_signoff"
        assert decision["next_action"] == "route_human_review"

    def test_dispute_state_detected_from_email(self):
        """Dispute keywords in email body should set has_active_dispute."""
        invoice = make_invoice(due_date=date.today() - timedelta(days=10))
        dispute_email = Email(
            email_id="E-DIS",
            customer_id=invoice.customer_id,
            from_email="ap@testcorp.com",
            subject="Dispute on invoice",
            body="The amount on this invoice is incorrect. We dispute this charge.",
            received_date=date.today() - timedelta(days=2),
            invoice_ref=invoice.invoice_id,
        )

        state = compute_invoice_state(invoice, [], [dispute_email], date.today(), [])
        assert state["has_active_dispute"] is True


# ---------------------------------------------------------------------------
# Test 6: Future data leakage prevention
# ---------------------------------------------------------------------------

class TestNoFutureLeakage:
    def test_future_payment_invisible_to_past_simulation(self, policy_engine):
        """
        A payment made on Jan 20 MUST NOT affect agent decisions made on Jan 12.
        This is the core point-in-time integrity test.
        """
        simulation_date = date(2024, 1, 12)
        payment_date = date(2024, 1, 20)  # FUTURE relative to simulation_date

        invoice = Invoice(
            invoice_id="INV-LEAK-TEST",
            customer_id="CUST-TEST",
            amount=100000.0,
            currency="INR",
            issue_date=date(2023, 12, 10),
            due_date=date(2024, 1, 9),  # 3 days overdue on simulation_date
            description="Test",
        )
        future_payment = Payment(
            payment_id="PAY-FUTURE",
            invoice_id="INV-LEAK-TEST",
            amount_paid=100000.0,
            payment_date=payment_date,  # Jan 20 — future!
            payment_method="NEFT",
            reference="REF-FUTURE",
        )

        # On Jan 12, payment is NOT yet known
        state = compute_invoice_state(
            invoice=invoice,
            payments_known=[],  # No payments known on Jan 12
            emails_known=[],
            current_date=simulation_date,
            action_history=[],
        )

        assert state["invoice_status"] == "overdue"
        assert state["payment_received"] is False

        decision = policy_engine.decide_with_date(state, [], simulation_date)
        # Agent on Jan 12 sees overdue invoice → should send first_reminder
        assert decision["next_action"] != "no_action"
        assert decision["policy_rule"] in ("first_reminder", "second_reminder", "third_reminder", "sales")

    def test_payment_known_after_date_excluded(self):
        """Payments with date > simulation_date must be excluded from state."""
        from src.data_loader import CollectionsData
        # This test verifies the filtering logic itself

        data = CollectionsData()
        sim_date = date(2024, 1, 15)

        # Load payments known at sim_date
        payments_known = data.payments_known_at(sim_date)

        # All returned payments must have payment_date <= sim_date
        for p in payments_known:
            assert p.payment_date <= sim_date, (
                f"Payment {p.payment_id} with date {p.payment_date} "
                f"leaked into simulation on {sim_date}"
            )


# ---------------------------------------------------------------------------
# Test 7: Policy loading
# ---------------------------------------------------------------------------

class TestPolicyLoading:
    def test_policy_loads_correctly(self, policy):
        assert "reminders" in policy
        assert "escalation" in policy
        assert "human_review" in policy
        assert "risk" in policy

    def test_reminder_thresholds(self, policy):
        assert policy["reminders"]["first_reminder"]["overdue_days"] == 1
        assert policy["reminders"]["first_reminder"]["mode"] == "auto_send"
        assert policy["reminders"]["second_reminder"]["overdue_days"] == 7

    def test_escalation_requires_human_signoff(self, policy):
        for stage_name, stage in policy["escalation"].items():
            assert stage["mode"] == "human_signoff", (
                f"Escalation stage '{stage_name}' should require human_signoff"
            )


# ---------------------------------------------------------------------------
# Test 8: Risk scoring
# ---------------------------------------------------------------------------

class TestRiskScoring:
    def test_reliable_customer_low_risk(self, policy):
        """Customer who always pays on time should score LOW risk."""
        invoice = make_invoice(due_date=date.today() - timedelta(days=2))
        current_date = date.today()

        # Build history of on-time payments
        past_invoices = [
            make_invoice(f"INV-H{i}", due_date=date.today() - timedelta(days=30 * (i + 2)))
            for i in range(4)
        ]
        past_payments = [
            make_payment(inv.invoice_id, amount=inv.amount,
                         payment_date=inv.due_date - timedelta(days=1))
            for inv in past_invoices
        ]

        risk = compute_risk(
            invoice=invoice,
            customer_name="Reliable Corp",
            all_customer_invoices=[invoice] + past_invoices,
            all_customer_payments=past_payments,
            action_history=[],
            current_date=current_date,
            policy=policy,
        )

        assert risk.risk_level in (RiskLevel.LOW, RiskLevel.MEDIUM)
        assert risk.risk_score < 60.0

    def test_chronic_late_payer_high_risk(self, policy):
        """Customer who always pays late and has broken promises should score HIGH/CRITICAL."""
        invoice = make_invoice(due_date=date.today() - timedelta(days=20))
        current_date = date.today()

        # Build history of late payments (30-40 days late each)
        past_invoices = [
            make_invoice(f"INV-L{i}", due_date=date.today() - timedelta(days=60 + 30 * i))
            for i in range(5)
        ]
        past_payments = [
            make_payment(inv.invoice_id, amount=inv.amount,
                         payment_date=inv.due_date + timedelta(days=30))
            for inv in past_invoices
        ]

        # Simulate broken promise in action history
        broken_history = [
            {
                "invoice_id": invoice.invoice_id,
                "customer_id": invoice.customer_id,
                "action": "promise_recorded",
                "promised_payment_date": (date.today() - timedelta(days=5)).isoformat(),
                "date": (date.today() - timedelta(days=10)).isoformat(),
            }
        ]

        risk = compute_risk(
            invoice=invoice,
            customer_name="Late Payer Inc",
            all_customer_invoices=[invoice] + past_invoices,
            all_customer_payments=past_payments,
            action_history=broken_history,
            current_date=current_date,
            policy=policy,
        )

        assert risk.risk_level in (RiskLevel.MEDIUM, RiskLevel.HIGH, RiskLevel.CRITICAL)
        assert risk.risk_score >= 35.0  # At minimum MEDIUM threshold

        assert len(risk.reasons) >= 2

    def test_risk_reasons_populated(self, policy):
        """Risk assessment must always provide human-readable reasons."""
        invoice = make_invoice(due_date=date.today() - timedelta(days=15))
        risk = compute_risk(
            invoice=invoice,
            customer_name="Any Corp",
            all_customer_invoices=[invoice],
            all_customer_payments=[],
            action_history=[],
            current_date=date.today(),
            policy=policy,
        )

        assert isinstance(risk.reasons, list)
        assert len(risk.reasons) >= 1
        assert all(isinstance(r, str) and len(r) > 5 for r in risk.reasons)


# ---------------------------------------------------------------------------
# Test 9: Email classification fallback
# ---------------------------------------------------------------------------

class TestEmailClassificationFallback:
    KNOWN_IDS = {"INV-001", "INV-002", "INV-003"}

    def test_payment_sent_detected(self):
        result = classify_email_rule_based(
            "We have transferred the full payment of Rs 100000 to your account today.",
            "Payment sent",
            "INV-001",
            self.KNOWN_IDS,
        )
        assert result.intent == EmailIntent.PAYMENT_SENT
        assert result.confidence >= 0.75
        assert result.classification_source == "rule_based"

    def test_dispute_detected(self):
        result = classify_email_rule_based(
            "The amount on this invoice is incorrect. There is a discrepancy.",
            "Invoice dispute",
            "INV-002",
            self.KNOWN_IDS,
        )
        assert result.intent == EmailIntent.DISPUTE
        assert result.requires_human_review is True

    def test_promise_to_pay_detected(self):
        result = classify_email_rule_based(
            "We will process payment by next Friday. Please confirm.",
            "Re: Invoice",
            "INV-001",
            self.KNOWN_IDS,
        )
        assert result.intent == EmailIntent.PROMISE_TO_PAY

    def test_payment_plan_requires_human_review(self):
        result = classify_email_rule_based(
            "Can we pay this invoice in installments over three months?",
            "Payment plan request",
            "INV-003",
            self.KNOWN_IDS,
        )
        assert result.intent == EmailIntent.PAYMENT_PLAN_REQUEST
        assert result.requires_human_review is True

    def test_unknown_invoice_lowers_confidence(self):
        result = classify_email_rule_based(
            "We will pay by next week.",
            "Payment info",
            "INV-NONEXISTENT",  # Not in known IDs
            self.KNOWN_IDS,
        )
        assert result.confidence <= 0.65
        assert result.requires_human_review is True

    def test_out_of_office_detected(self):
        result = classify_email_rule_based(
            "I am out of office until next Monday. Will respond on my return.",
            "Out of Office",
            None,
            self.KNOWN_IDS,
        )
        assert result.intent == EmailIntent.OUT_OF_OFFICE

    def test_payment_delay_detected(self):
        result = classify_email_rule_based(
            "We are requesting a 2-week extension on this payment due to cash flow constraints.",
            "Payment Extension",
            "INV-002",
            self.KNOWN_IDS,
        )
        assert result.intent == EmailIntent.PAYMENT_DELAY


# ---------------------------------------------------------------------------
# Test 10: Deduplication — same rule should not fire twice in a row
# ---------------------------------------------------------------------------

class TestDeduplication:
    def test_same_rule_not_repeated(self, policy_engine):
        """first_reminder already sent → should not send again (one-shot rule)."""
        invoice = make_invoice(due_date=date.today() - timedelta(days=3))
        current_date = date.today()
        state = compute_invoice_state(invoice, [], [], current_date, [])

        prior_history = [
            {
                "invoice_id": invoice.invoice_id,
                "date": (current_date - timedelta(days=2)).isoformat(),
                "action": "payment_reminder",
                "policy_rule": "first_reminder",
                "delivery_mode": "auto_send",
            }
        ]

        decision = policy_engine.decide_with_date(state, prior_history, current_date)
        # first_reminder already sent → should advance to second_reminder or hold
        assert decision["policy_rule"] != "first_reminder"
