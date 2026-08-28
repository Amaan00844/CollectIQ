"""
Explainable risk scoring engine.
Uses weighted features with human-readable reasons.
NO ML — intentionally interpretable given 18 months of data for ~12 customers.
All weights come from policy.yaml so they are adjustable without code changes.
"""

from __future__ import annotations

from datetime import date
from typing import Optional

from src.models import Invoice, Payment, RiskAssessment, RiskLevel


def compute_risk(
    invoice: Invoice,
    customer_name: str,
    all_customer_invoices: list[Invoice],
    all_customer_payments: list[Payment],
    action_history: list[dict],
    current_date: date,
    policy: dict,
) -> RiskAssessment:
    """
    Compute an explainable risk score for a single open invoice.

    Score is 0–100 where higher = riskier.
    Each factor contributes a weighted component, capped at max_values from policy.
    """
    weights = policy["risk"]["weights"]
    max_vals = policy["risk"]["max_values"]
    thresholds = policy["risk"]["thresholds"]

    reasons: list[str] = []
    features: dict[str, float] = {}
    weighted_score = 0.0

    # ------------------------------------------------------------------
    # 1. Historical late payment rate (% of past invoices paid late)
    # ------------------------------------------------------------------
    past_invoices = [i for i in all_customer_invoices if i.invoice_id != invoice.invoice_id]
    past_paid = []
    for pi in past_invoices:
        pmnts = [p for p in all_customer_payments if p.invoice_id == pi.invoice_id]
        if pmnts:
            pay_date = max(p.payment_date for p in pmnts)
            past_paid.append((pi, pay_date))

    late_count = sum(1 for pi, pd in past_paid if pd > pi.due_date)
    total_paid = len(past_paid)
    late_rate = (late_count / total_paid * 100) if total_paid > 0 else 50.0  # unknown → assume medium

    features["historical_late_rate"] = late_rate
    norm = min(late_rate / max_vals["historical_late_rate"], 1.0)
    contribution = norm * weights["historical_late_rate"]
    weighted_score += contribution

    if total_paid == 0:
        reasons.append("No payment history available for this customer — risk assumed medium")
    elif late_rate >= 60:
        reasons.append(
            f"Customer historically pays late: {late_count} of {total_paid} past invoices were overdue ({late_rate:.0f}%)"
        )
    elif late_rate >= 30:
        reasons.append(
            f"Customer has moderate late-payment history: {late_count} of {total_paid} invoices paid late"
        )

    # ------------------------------------------------------------------
    # 2. Average days late historically
    # ------------------------------------------------------------------
    days_late_list = []
    for pi, pd in past_paid:
        if pd > pi.due_date:
            days_late_list.append((pd - pi.due_date).days)

    avg_days_late = sum(days_late_list) / len(days_late_list) if days_late_list else 0.0
    features["avg_days_late"] = avg_days_late
    norm = min(avg_days_late / max_vals["avg_days_late"], 1.0)
    contribution = norm * weights["avg_days_late"]
    weighted_score += contribution

    if avg_days_late >= 20:
        reasons.append(f"Average payment delay: {avg_days_late:.0f} days late across historical invoices")
    elif avg_days_late >= 10:
        reasons.append(f"Moderate average payment delay: {avg_days_late:.0f} days")

    # ------------------------------------------------------------------
    # 3. Current days overdue
    # ------------------------------------------------------------------
    days_overdue = max(0, (current_date - invoice.due_date).days)
    features["current_overdue_days"] = float(days_overdue)
    norm = min(days_overdue / max_vals["current_overdue_days"], 1.0)
    contribution = norm * weights["current_overdue_days"]
    weighted_score += contribution

    if days_overdue >= 30:
        reasons.append(f"Current invoice is {days_overdue} days overdue (seriously past due)")
    elif days_overdue >= 14:
        reasons.append(f"Current invoice is {days_overdue} days overdue")
    elif days_overdue >= 1:
        reasons.append(f"Current invoice is {days_overdue} day(s) overdue")

    # ------------------------------------------------------------------
    # 4. Broken promises to pay
    # ------------------------------------------------------------------
    broken_promises = sum(
        1 for a in action_history
        if a.get("invoice_id") == invoice.invoice_id
        and a.get("action") == "promise_recorded"
        and a.get("promised_payment_date")
        and date.fromisoformat(a["promised_payment_date"]) < current_date
    )
    # Also count cross-invoice broken promises for this customer
    customer_broken = sum(
        1 for a in action_history
        if a.get("customer_id") == invoice.customer_id
        and a.get("action") == "promise_recorded"
        and a.get("promised_payment_date")
        and date.fromisoformat(a["promised_payment_date"]) < current_date
    )
    total_broken = max(broken_promises, min(customer_broken, 3))
    features["broken_promises"] = float(total_broken)
    norm = min(total_broken / max_vals["broken_promises"], 1.0)
    contribution = norm * weights["broken_promises"]
    weighted_score += contribution

    if total_broken >= 2:
        reasons.append(f"Customer has broken {total_broken} payment promises — promises cannot be relied upon")
    elif total_broken == 1:
        reasons.append("Customer has previously missed a promised payment date")

    # ------------------------------------------------------------------
    # 5. Previous disputes
    # ------------------------------------------------------------------
    disputes = sum(
        1 for a in action_history
        if a.get("customer_id") == invoice.customer_id
        and a.get("action") == "routed_human_review"
        and a.get("reason", "").lower().startswith("dispute")
    )
    features["previous_disputes"] = float(disputes)
    norm = min(disputes / max_vals["previous_disputes"], 1.0)
    contribution = norm * weights["previous_disputes"]
    weighted_score += contribution

    if disputes >= 1:
        reasons.append(f"Customer has {disputes} prior dispute(s) on record")

    # ------------------------------------------------------------------
    # 6. Number of reminders already sent on this invoice
    # ------------------------------------------------------------------
    reminders_sent = sum(
        1 for a in action_history
        if a.get("invoice_id") == invoice.invoice_id
        and a.get("action") in ("payment_reminder", "payment_reminder_sent")
    )
    features["reminders_sent"] = float(reminders_sent)
    norm = min(reminders_sent / max_vals["reminders_sent"], 1.0)
    contribution = norm * weights["reminders_sent"]
    weighted_score += contribution

    if reminders_sent >= 3:
        reasons.append(f"{reminders_sent} payment reminders sent with no response — customer non-responsive")
    elif reminders_sent >= 1:
        reasons.append(f"{reminders_sent} payment reminder(s) already sent for this invoice")

    # ------------------------------------------------------------------
    # 7. Worsening payment behavior (recent trend)
    # ------------------------------------------------------------------
    worsening = _detect_worsening_behavior(past_paid)
    features["worsening_behavior"] = float(worsening)
    norm = worsening / max_vals["worsening_behavior"]
    contribution = norm * weights["worsening_behavior"]
    weighted_score += contribution

    if worsening:
        reasons.append("Recent payment behavior is worsening compared to historical average")

    # ------------------------------------------------------------------
    # Normalise to 0–100
    # Total possible weighted score = sum of weights = 100
    # ------------------------------------------------------------------
    total_weight = sum(weights.values())
    risk_score = min(100.0, (weighted_score / total_weight) * 100)

    # Apply high-amount bump (informational — does not change score)
    high_threshold = policy.get("human_review", {}).get("high_amount_threshold", 300000)
    if invoice.amount >= high_threshold:
        reasons.append(f"Invoice amount ₹{invoice.amount:,.0f} is above the high-value threshold")

    # Map to risk level
    if risk_score >= thresholds["critical"]:
        risk_level = RiskLevel.CRITICAL
    elif risk_score >= thresholds["high"]:
        risk_level = RiskLevel.HIGH
    elif risk_score >= thresholds["medium"]:
        risk_level = RiskLevel.MEDIUM
    else:
        risk_level = RiskLevel.LOW

    if not reasons:
        reasons.append("No significant risk factors identified — customer has reliable payment history")

    return RiskAssessment(
        invoice_id=invoice.invoice_id,
        customer_id=invoice.customer_id,
        customer_name=customer_name,
        risk_level=risk_level,
        risk_score=round(risk_score, 1),
        reasons=reasons,
        features=features,
    )


def _detect_worsening_behavior(past_paid: list[tuple[Invoice, date]]) -> int:
    """
    Returns 1 if recent invoices show a worsening payment trend, else 0.
    Compares the last 3 invoices vs. the ones before.
    """
    if len(past_paid) < 4:
        return 0

    # Sort by due date ascending
    sorted_paid = sorted(past_paid, key=lambda x: x[0].due_date)

    def avg_delay(pairs: list[tuple[Invoice, date]]) -> float:
        delays = [max(0, (pd - pi.due_date).days) for pi, pd in pairs]
        return sum(delays) / len(delays) if delays else 0.0

    recent = sorted_paid[-3:]
    older = sorted_paid[:-3]

    recent_avg = avg_delay(recent)
    older_avg = avg_delay(older)

    return 1 if recent_avg > older_avg * 1.3 else 0  # 30% worse → worsening
