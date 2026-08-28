"""
Point-in-time invoice state calculator.
Given a date, computes the status, days overdue, amount outstanding,
and action history for an invoice — using only information known at that date.
"""

from __future__ import annotations

from datetime import date
from typing import Optional

from src.models import Invoice, Payment, Email, InvoiceStatus


def compute_invoice_state(
    invoice: Invoice,
    payments_known: list[Payment],
    emails_known: list[Email],
    current_date: date,
    action_history: list[dict],
) -> dict:
    """
    Compute a complete point-in-time snapshot of an invoice.

    Returns a dict compatible with CollectionState.
    """
    invoice_payments = [p for p in payments_known if p.invoice_id == invoice.invoice_id]
    total_paid = sum(p.amount_paid for p in invoice_payments)
    amount_outstanding = max(0.0, invoice.amount - total_paid)

    # Payment status
    if amount_outstanding == 0:
        status = InvoiceStatus.PAID
        payment_received = True
    elif total_paid > 0:
        status = InvoiceStatus.PARTIAL
        payment_received = False
    else:
        payment_received = False
        if current_date > invoice.due_date:
            status = InvoiceStatus.OVERDUE
        else:
            status = InvoiceStatus.OPEN

    days_overdue = max(0, (current_date - invoice.due_date).days) if current_date > invoice.due_date else 0

    # Check for active dispute in email history
    invoice_emails = [
        e for e in emails_known
        if e.customer_id == invoice.customer_id
        and (e.invoice_ref == invoice.invoice_id or e.invoice_ref is None)
    ]
    # Specifically filter emails that reference this invoice
    direct_emails = [e for e in emails_known if e.invoice_ref == invoice.invoice_id]
    has_active_dispute = any(
        "dispute" in e.subject.lower() or
        "incorrect" in e.body.lower() or
        "discrepancy" in e.body.lower() or
        "wrong amount" in e.body.lower() or
        "pricing error" in e.body.lower() or
        "revised invoice" in e.body.lower()
        for e in direct_emails
    )

    if has_active_dispute and status == InvoiceStatus.OVERDUE:
        status = InvoiceStatus.DISPUTED

    # Check for active payment promise
    promise_info = _find_active_promise(direct_emails, current_date, action_history, invoice.invoice_id)

    return {
        "invoice_id": invoice.invoice_id,
        "customer_id": invoice.customer_id,
        "invoice_status": status.value,
        "due_date": invoice.due_date.isoformat(),
        "issue_date": invoice.issue_date.isoformat(),
        "amount": invoice.amount,
        "amount_outstanding": amount_outstanding,
        "days_overdue": days_overdue,
        "payment_received": payment_received,
        "total_paid": total_paid,
        "description": invoice.description,
        "currency": invoice.currency,
        "has_active_dispute": has_active_dispute,
        "pending_emails": [
            {
                "email_id": e.email_id,
                "subject": e.subject,
                "body": e.body,
                "received_date": e.received_date.isoformat(),
                "invoice_ref": e.invoice_ref,
            }
            for e in direct_emails
        ],
        **promise_info,
    }


def _find_active_promise(
    direct_emails: list[Email],
    current_date: date,
    action_history: list[dict],
    invoice_id: str,
) -> dict:
    """
    Scan emails for the most recent promise-to-pay.
    Returns promise state dict.
    """
    promise_keywords = [
        "will pay", "will process", "by friday", "by monday", "by tuesday",
        "by wednesday", "by thursday", "by saturday", "next week", "will be done",
        "processing date", "payment run", "approved payment", "payment will be made",
        "payment will be processed", "payment will be initiated",
    ]

    has_active_promise = False
    promise_date: Optional[str] = None
    promise_broken = False

    # Also check action_history for recorded promises
    for action in action_history:
        if action.get("invoice_id") == invoice_id and action.get("action") == "promise_recorded":
            recorded_date = action.get("promised_payment_date")
            if recorded_date:
                pd_obj = date.fromisoformat(recorded_date)
                if pd_obj >= current_date:
                    has_active_promise = True
                    promise_date = recorded_date
                elif pd_obj < current_date:
                    promise_broken = True

    # Check emails for promise language
    for email in sorted(direct_emails, key=lambda e: e.received_date, reverse=True):
        body_lower = email.body.lower()
        if any(kw in body_lower for kw in promise_keywords):
            has_active_promise = True
            # Try to extract a date from the body (simple heuristic)
            extracted = _extract_promise_date(email.body, current_date)
            if extracted:
                if extracted < current_date:
                    promise_broken = True
                    has_active_promise = False
                else:
                    promise_date = extracted.isoformat()
                    has_active_promise = True
                    promise_broken = False
            break

    return {
        "has_active_promise": has_active_promise,
        "promise_date": promise_date,
        "promise_broken": promise_broken,
    }


def _extract_promise_date(body: str, current_date: date) -> Optional[date]:
    """Extract a promised payment date from email body text."""
    import re
    from datetime import timedelta

    months = {
        "january": 1, "february": 2, "march": 3, "april": 4,
        "may": 5, "june": 6, "july": 7, "august": 8,
        "september": 9, "october": 10, "november": 11, "december": 12,
        "jan": 1, "feb": 2, "mar": 3, "apr": 4,
        "jun": 6, "jul": 7, "aug": 8, "sep": 9, "oct": 10, "nov": 11, "dec": 12,
    }

    body_lower = body.lower()

    # Pattern: "by [Month] [day]" or "[day] [Month]"
    for month_name, month_num in months.items():
        # "by February 28th" or "by February 28"
        m = re.search(rf"\b{month_name}\s+(\d{{1,2}})", body_lower)
        if m:
            day = int(m.group(1))
            year = current_date.year
            try:
                candidate = date(year, month_num, day)
                if candidate < date(year, current_date.month, 1):
                    candidate = date(year + 1, month_num, day)
                return candidate
            except ValueError:
                continue

        # "28th February"
        m = re.search(rf"(\d{{1,2}})\s*(?:st|nd|rd|th)?\s+{month_name}", body_lower)
        if m:
            day = int(m.group(1))
            year = current_date.year
            try:
                candidate = date(year, month_num, day)
                if candidate < date(year, current_date.month, 1):
                    candidate = date(year + 1, month_num, day)
                return candidate
            except ValueError:
                continue

    # "by friday", "next week" → approximate
    if "by friday" in body_lower or "this friday" in body_lower:
        days_ahead = (4 - current_date.weekday()) % 7
        return current_date + timedelta(days=max(days_ahead, 1))


    if "next week" in body_lower:
        return current_date + timedelta(days=7)

    return None
