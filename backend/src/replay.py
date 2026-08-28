"""
Historical dry-run replay engine.
The most important deliverable — simulates the agent across 18 months
using ONLY information available at each point in time.

CRITICAL INVARIANT:
  For any simulated date T, the agent sees ONLY:
    - Invoices with issue_date <= T
    - Payments with payment_date <= T
    - Emails with received_date <= T
  Future information is NEVER used.

Output: output/replay_log.jsonl (one action per line)
"""

from __future__ import annotations

import json
from datetime import date, timedelta
from pathlib import Path
from typing import Optional

import yaml

from src.data_loader import CollectionsData
from src.invoice_state import compute_invoice_state
from src.risk_engine import compute_risk
from src.policy_engine import PolicyEngine
from src.graph import build_collections_graph
from src.message_generator import generate_message
from src.logger import write_action, clear_output

OUTPUT_DIR = Path(__file__).parent.parent / "output"
REPLAY_LOG = OUTPUT_DIR / "replay_log.jsonl"
RISK_REPORT = OUTPUT_DIR / "risk_report.json"
POLICY_PATH = Path(__file__).parent.parent / "config" / "policy.yaml"


def load_policy() -> dict:
    with open(POLICY_PATH, "r") as f:
        return yaml.safe_load(f)


# ---------------------------------------------------------------------------
# Timeline builder
# ---------------------------------------------------------------------------

def build_timeline(data: CollectionsData) -> list[date]:
    """
    Build a sorted list of all significant dates from the data:
    - Invoice issue dates
    - Invoice due dates
    - Payment dates
    - Email received dates
    - Overdue check dates (1, 7, 14, 21, 35, 50, 65 days after due date)
    """
    dates: set[date] = set()

    for inv in data.invoices.values():
        dates.add(inv.issue_date)
        dates.add(inv.due_date)
        # Add check dates relative to due date
        for offset in [1, 7, 14, 21, 35, 50, 65]:
            check_date = inv.due_date + timedelta(days=offset)
            dates.add(check_date)

    for payment in data.payments:
        dates.add(payment.payment_date)

    for email in data.emails:
        dates.add(email.received_date)

    # Limit to the actual data window
    all_dates = sorted(dates)
    if not all_dates:
        return []

    start = all_dates[0]
    end = all_dates[-1]

    return [d for d in all_dates if start <= d <= end]


# ---------------------------------------------------------------------------
# Replay runner
# ---------------------------------------------------------------------------

def run_replay(verbose: bool = True) -> tuple[int, list[dict]]:
    """
    Execute the full historical replay.
    Returns (action_count, risk_report_list).
    """
    data = CollectionsData()
    policy = load_policy()
    policy_engine = PolicyEngine(policy)

    clear_output(REPLAY_LOG)

    timeline = build_timeline(data)
    if verbose:
        print(f"  Timeline: {len(timeline)} event dates from {timeline[0]} to {timeline[-1]}")

    # Global action history — tracks everything already logged (for dedup)
    # Keyed by invoice_id
    action_history: list[dict] = []
    action_count = 0

    for current_date in timeline:
        # ----------------------------------------------------------------
        # POINT-IN-TIME FILTER — the core invariant
        # ----------------------------------------------------------------
        known_invoices = data.invoices_known_at(current_date)
        known_payments = data.payments_known_at(current_date)
        known_emails = data.emails_known_at(current_date)
        known_invoice_ids = set(known_invoices.keys())

        # ----------------------------------------------------------------
        # Build the LangGraph for this date (deps injected)
        # ----------------------------------------------------------------
        graph = build_collections_graph(policy_engine, known_invoice_ids, current_date)

        # ----------------------------------------------------------------
        # Evaluate each invoice known at this date
        # ----------------------------------------------------------------
        for invoice_id, invoice in known_invoices.items():
            customer = data.customers.get(invoice.customer_id)
            if not customer:
                continue

            # Get payments and emails for this invoice/customer known at current_date
            inv_payments = [p for p in known_payments if p.invoice_id == invoice_id]
            cust_emails = [e for e in known_emails if e.customer_id == invoice.customer_id]

            # Get per-invoice action history
            inv_action_history = [a for a in action_history if a.get("invoice_id") == invoice_id]
            cust_action_history = [a for a in action_history if a.get("customer_id") == invoice.customer_id]

            # Compute point-in-time state
            inv_state = compute_invoice_state(
                invoice=invoice,
                payments_known=known_payments,
                emails_known=known_emails,
                current_date=current_date,
                action_history=action_history,
            )

            # Skip if invoice hasn't reached its due date yet AND no email received
            if inv_state["days_overdue"] <= 0 and not inv_state["pending_emails"]:
                # Invoice not due yet — skip unless there's an inbound email to process
                # Check: is there a NEW email today (email received today) for this invoice?
                todays_emails = [
                    e for e in known_emails
                    if e.customer_id == invoice.customer_id
                    and e.invoice_ref == invoice_id
                    and e.received_date == current_date
                ]
                if not todays_emails:
                    continue

            # Skip paid invoices unless there's a new email today
            if inv_state["invoice_status"] == "paid":
                todays_emails = [
                    e for e in known_emails
                    if e.customer_id == invoice.customer_id
                    and e.invoice_ref == invoice_id
                    and e.received_date == current_date
                ]
                if not todays_emails:
                    continue

            # Compute risk
            all_cust_invoices = [
                v for v in known_invoices.values()
                if v.customer_id == invoice.customer_id
            ]
            risk = compute_risk(
                invoice=invoice,
                customer_name=customer.customer_name,
                all_customer_invoices=all_cust_invoices,
                all_customer_payments=[p for p in known_payments if any(
                    i.invoice_id == p.invoice_id for i in all_cust_invoices
                )],
                action_history=cust_action_history,
                current_date=current_date,
                policy=policy,
            )

            # Build LangGraph state
            lg_state = {
                "current_date": current_date.isoformat(),
                "invoice_id": invoice_id,
                "customer_id": invoice.customer_id,
                "customer_name": customer.customer_name,
                "customer_email": customer.contact_email,
                "risk_score": risk.risk_score,
                "risk_level": risk.risk_level.value,
                "risk_reasons": risk.reasons,
                "action_history": inv_action_history + cust_action_history,
                **inv_state,
            }

            # Run the graph
            try:
                result = graph.invoke(lg_state)
            except Exception as exc:
                exc_msg = str(exc)
                # Suppress benign LangGraph date-serialisation warnings
                if "'datetime.date' object has no attribute 'date'" not in exc_msg:
                    if verbose:
                        print(f"    [WARN] Graph error for {invoice_id} on {current_date}: {exc}")
                continue


            next_action = result.get("next_action", "no_action")
            delivery_mode = result.get("delivery_mode", "no_action")

            # Skip no-ops
            if next_action == "no_action" or delivery_mode == "no_action":
                continue

            # Build action record
            action_record = {
                "date": current_date.isoformat(),
                "invoice_id": invoice_id,
                "customer_id": invoice.customer_id,
                "customer_name": customer.customer_name,
                "recipient_tier": result.get("recipient_tier", ""),
                "action": next_action,
                "message_body": result.get("message_body", ""),
                "delivery_mode": delivery_mode,
                "reason": result.get("decision_reason", ""),
                "policy_rule": result.get("policy_rule", ""),
                "risk_level": risk.risk_level.value,
                "risk_score": risk.risk_score,
                "days_overdue": inv_state.get("days_overdue", 0),
                "amount_outstanding": inv_state.get("amount_outstanding", 0.0),
                "email_intent": result.get("email_intent"),
                "promised_payment_date": result.get("promised_payment_date"),
            }

            # Append to global history and write to log
            action_history.append(action_record)
            write_action(action_record, REPLAY_LOG)
            action_count += 1

            if verbose:
                mode_tag = "AUTO" if delivery_mode == "auto_send" else "HUMAN"
                print(
                    f"    [{current_date}] {invoice_id} | {next_action} | "
                    f"{result.get('recipient_tier','')} | {mode_tag}"
                )

    return action_count, action_history


# ---------------------------------------------------------------------------
# Risk report for open invoices
# ---------------------------------------------------------------------------

def generate_risk_report(data: CollectionsData, policy: dict, action_history: list[dict], as_of: date) -> list[dict]:
    """
    Assess risk for all currently open invoices.
    Uses point-in-time data as of `as_of` date.
    """
    known_invoices = data.invoices_known_at(as_of)
    known_payments = data.payments_known_at(as_of)

    open_invoices = {}
    for inv_id, inv in known_invoices.items():
        inv_payments = [p for p in known_payments if p.invoice_id == inv_id]
        total_paid = sum(p.amount_paid for p in inv_payments)
        if total_paid < inv.amount:
            open_invoices[inv_id] = inv

    report = []
    for inv_id, inv in open_invoices.items():
        customer = data.customers.get(inv.customer_id)
        if not customer:
            continue

        all_cust_invoices = [
            v for v in known_invoices.values()
            if v.customer_id == inv.customer_id
        ]
        cust_payments = [
            p for p in known_payments
            if any(i.invoice_id == p.invoice_id for i in all_cust_invoices)
        ]
        cust_action_history = [
            a for a in action_history
            if a.get("customer_id") == inv.customer_id
        ]

        risk = compute_risk(
            invoice=inv,
            customer_name=customer.customer_name,
            all_customer_invoices=all_cust_invoices,
            all_customer_payments=cust_payments,
            action_history=cust_action_history,
            current_date=as_of,
            policy=policy,
        )

        days_overdue = max(0, (as_of - inv.due_date).days)
        inv_payments_list = [p for p in known_payments if p.invoice_id == inv_id]
        total_paid = sum(p.amount_paid for p in inv_payments_list)

        report.append({
            "invoice_id": inv_id,
            "customer_id": inv.customer_id,
            "customer_name": customer.customer_name,
            "amount": inv.amount,
            "amount_outstanding": max(0.0, inv.amount - total_paid),
            "due_date": inv.due_date.isoformat(),
            "days_overdue": days_overdue,
            "risk_level": risk.risk_level.value,
            "risk_score": risk.risk_score,
            "reasons": risk.reasons,
            "features": risk.features,
        })

    # Sort by risk score descending
    report.sort(key=lambda x: x["risk_score"], reverse=True)
    return report
