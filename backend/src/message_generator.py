"""
Professional collection message generator.
The policy engine decides WHO gets contacted and WHEN.
This module only drafts the message content.
No LLM is used here — templates ensure consistency and compliance.
"""

from __future__ import annotations

from datetime import date
from typing import Optional


SENDER_NAME = "CollectIQ Collections Team"
SENDER_EMAIL = "collections@collectiq.com"


def generate_message(
    invoice_id: str,
    customer_name: str,
    amount_outstanding: float,
    currency: str,
    due_date: str,
    days_overdue: int,
    recipient_tier: str,
    action: str,
    policy_rule: str,
    promise_date: Optional[str] = None,
    description: str = "",
) -> str:
    """
    Generate a professional, compliant collection message.
    Returns the message body as a string.
    """
    amount_fmt = f"₹{amount_outstanding:,.0f}" if currency == "INR" else f"{currency} {amount_outstanding:,.0f}"

    if action == "no_action":
        return ""

    if recipient_tier == "customer":
        return _customer_message(
            invoice_id, customer_name, amount_fmt, due_date, days_overdue, policy_rule, description
        )
    elif recipient_tier == "sales":
        return _sales_message(invoice_id, customer_name, amount_fmt, due_date, days_overdue, policy_rule)
    elif recipient_tier == "controller":
        return _controller_message(invoice_id, customer_name, amount_fmt, due_date, days_overdue)
    elif recipient_tier == "ceo":
        return _ceo_message(invoice_id, customer_name, amount_fmt, due_date, days_overdue)
    elif recipient_tier == "owner":
        return _owner_message(invoice_id, customer_name, amount_fmt, due_date, days_overdue)
    elif recipient_tier == "internal":
        return _internal_review_message(invoice_id, customer_name, amount_fmt, days_overdue, action)
    else:
        return _customer_message(
            invoice_id, customer_name, amount_fmt, due_date, days_overdue, policy_rule, description
        )


def _customer_message(
    invoice_id: str,
    customer_name: str,
    amount_fmt: str,
    due_date: str,
    days_overdue: int,
    policy_rule: str,
    description: str,
) -> str:
    if policy_rule == "first_reminder":
        return (
            f"Dear {customer_name},\n\n"
            f"This is a friendly reminder that invoice {invoice_id} for {amount_fmt} "
            f"({description}) was due on {due_date} and remains outstanding.\n\n"
            f"If you have already arranged payment, please disregard this notice. "
            f"Otherwise, we kindly request that you process the payment at your earliest convenience.\n\n"
            f"Please do not hesitate to contact us if you have any questions regarding this invoice.\n\n"
            f"Best regards,\n{SENDER_NAME}"
        )
    elif policy_rule == "second_reminder":
        return (
            f"Dear {customer_name},\n\n"
            f"We are writing to follow up on invoice {invoice_id} for {amount_fmt}, "
            f"which is now {days_overdue} days past its due date of {due_date}.\n\n"
            f"We kindly request that you arrange payment as soon as possible. "
            f"If there are any issues with this invoice or if payment has already been processed, "
            f"please let us know so we can update our records.\n\n"
            f"Thank you for your prompt attention to this matter.\n\n"
            f"Best regards,\n{SENDER_NAME}"
        )
    else:
        return (
            f"Dear {customer_name},\n\n"
            f"This is our third and final reminder regarding invoice {invoice_id} for {amount_fmt}, "
            f"which is now {days_overdue} days overdue (due date: {due_date}).\n\n"
            f"We have attempted to contact you previously and have not yet received payment or a response. "
            f"We request that you arrange immediate payment or contact us urgently to discuss this matter.\n\n"
            f"Please reach out to us at {SENDER_EMAIL} to resolve this at the earliest.\n\n"
            f"Regards,\n{SENDER_NAME}"
        )


def _sales_message(
    invoice_id: str,
    customer_name: str,
    amount_fmt: str,
    due_date: str,
    days_overdue: int,
    policy_rule: str,
) -> str:
    return (
        f"[INTERNAL — SALES ESCALATION]\n\n"
        f"Attention: Sales Representative\n\n"
        f"Invoice {invoice_id} for customer {customer_name} ({amount_fmt}) is now "
        f"{days_overdue} days overdue (due: {due_date}).\n\n"
        f"Automated reminders have been sent to the customer without resolution. "
        f"Please review the account and consider reaching out directly to your contact at {customer_name} "
        f"to facilitate payment.\n\n"
        f"Action required: Please confirm whether there are any relationship-level issues "
        f"or outstanding disputes that may be affecting payment.\n\n"
        f"This notice requires your sign-off before any further customer communication.\n\n"
        f"— {SENDER_NAME}"
    )


def _controller_message(
    invoice_id: str,
    customer_name: str,
    amount_fmt: str,
    due_date: str,
    days_overdue: int,
) -> str:
    return (
        f"[INTERNAL — CONTROLLER ESCALATION]\n\n"
        f"Attention: Controller\n\n"
        f"Invoice {invoice_id} for {customer_name} ({amount_fmt}) remains unpaid at "
        f"{days_overdue} days overdue (due: {due_date}).\n\n"
        f"Sales escalation has not resolved the outstanding payment. "
        f"This invoice is being escalated to your attention for further action.\n\n"
        f"Recommended actions:\n"
        f"• Review account standing and credit limits\n"
        f"• Approve or modify the collection strategy\n"
        f"• Determine whether legal or formal notice is appropriate\n\n"
        f"This notice requires your approval before proceeding.\n\n"
        f"— {SENDER_NAME}"
    )


def _ceo_message(
    invoice_id: str,
    customer_name: str,
    amount_fmt: str,
    due_date: str,
    days_overdue: int,
) -> str:
    return (
        f"[INTERNAL — CEO ESCALATION]\n\n"
        f"Attention: CEO\n\n"
        f"A significant receivable remains outstanding and has not been resolved through standard collection procedures.\n\n"
        f"Invoice: {invoice_id}\n"
        f"Customer: {customer_name}\n"
        f"Amount: {amount_fmt}\n"
        f"Days Overdue: {days_overdue}\n"
        f"Original Due Date: {due_date}\n\n"
        f"This matter has been escalated through customer, sales, and controller channels without resolution. "
        f"Your direction is requested on next steps.\n\n"
        f"This notice requires your review and sign-off.\n\n"
        f"— {SENDER_NAME}"
    )


def _owner_message(
    invoice_id: str,
    customer_name: str,
    amount_fmt: str,
    due_date: str,
    days_overdue: int,
) -> str:
    return (
        f"[INTERNAL — OWNER ESCALATION — CRITICAL]\n\n"
        f"Attention: Owner\n\n"
        f"The following invoice has reached the final escalation level after exhausting all standard collection channels.\n\n"
        f"Invoice: {invoice_id}\n"
        f"Customer: {customer_name}\n"
        f"Amount: {amount_fmt}\n"
        f"Days Overdue: {days_overdue}\n"
        f"Due Date: {due_date}\n\n"
        f"All automated and manual collection attempts have been exhausted. "
        f"Your personal direction is required to determine the final course of action "
        f"(legal referral, write-off, or direct negotiation).\n\n"
        f"This is held for your sign-off.\n\n"
        f"— {SENDER_NAME}"
    )


def _internal_review_message(
    invoice_id: str,
    customer_name: str,
    amount_fmt: str,
    days_overdue: int,
    action: str,
) -> str:
    return (
        f"[INTERNAL — HUMAN REVIEW REQUIRED]\n\n"
        f"Invoice {invoice_id} for {customer_name} ({amount_fmt}) requires human review.\n\n"
        f"Reason: {action.replace('_', ' ').title()}\n"
        f"Days overdue: {days_overdue}\n\n"
        f"The collections agent has paused automated actions for this invoice. "
        f"Please review and determine the appropriate next step.\n\n"
        f"— {SENDER_NAME}"
    )
