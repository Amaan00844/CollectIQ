"""
Email classification agent.
Primary: LLM (NVIDIA NIM endpoint, llama-3.1-70b-instruct).
Fallback: Rule-based classifier when API key is unavailable.

CRITICAL DESIGN PRINCIPLE:
- LLM is ONLY used here — to understand unstructured language.
- All LLM outputs are validated with Pydantic before any business logic runs.
- Deterministic Python code in policy_engine.py makes all escalation decisions.
"""

from __future__ import annotations

import json
import os
import re
from datetime import date
from typing import Optional

from src.models import EmailClassification, EmailIntent


# ---------------------------------------------------------------------------
# Rule-based fallback classifier
# ---------------------------------------------------------------------------

_RULES: list[tuple[list[str], EmailIntent, float]] = [
    # (keywords, intent, confidence)
    (["payment was processed", "have transferred", "have paid", "payment has been processed",
      "payment of rs", "payment has been initiated", "paid today", "payment processed",
      "transaction reference", "neft today", "rtgs today"], EmailIntent.PAYMENT_SENT, 0.85),

    (["already paid", "payment was made", "we paid", "previously paid",
      "was settled", "cleared last"], EmailIntent.ALREADY_PAID, 0.85),

    (["will pay", "will process payment", "will be processed", "will be done by",
      "payment will be made", "expect to process", "payment run", "payment by",
      "payment will be initiated", "processing date is", "approved the payment",
      "by friday", "by monday", "by end of"], EmailIntent.PROMISE_TO_PAY, 0.80),

    (["payment plan", "installment", "over three months", "over 2 monthly",
      "pay in two parts", "monthly installments", "propose paying"], EmailIntent.PAYMENT_PLAN_REQUEST, 0.88),

    (["dispute", "incorrect", "discrepancy", "wrong amount", "overcharged",
      "not received", "only received", "pricing error", "revised invoice",
      "does not match", "pu order", "purchase order"], EmailIntent.DISPUTE, 0.90),

    (["more time", "extension", "delay", "cash flow", "temporary constraint",
      "awaiting payment", "awaiting release", "requesting extension",
      "experiencing delay"], EmailIntent.PAYMENT_DELAY, 0.80),

    (["out of office", "ooo", "away until", "will be back", "on leave",
      "on vacation", "return on"], EmailIntent.OUT_OF_OFFICE, 0.95),

    (["query", "question", "clarify", "confirm the scope", "confirm if",
      "ensure it aligns", "reviewing internally", "under review"], EmailIntent.INVOICE_QUESTION, 0.75),
]


def classify_email_rule_based(
    email_body: str,
    email_subject: str,
    invoice_ref: Optional[str],
    known_invoice_ids: set[str],
) -> EmailClassification:
    """
    Rule-based email classification used when LLM is unavailable.
    Keyword matching with confidence scores.
    """
    body_lower = email_body.lower()
    subject_lower = email_subject.lower()
    combined = body_lower + " " + subject_lower

    best_intent = EmailIntent.UNKNOWN
    best_confidence = 0.50
    matched = False

    for keywords, intent, confidence in _RULES:
        if any(kw in combined for kw in keywords):
            if confidence > best_confidence:
                best_intent = intent
                best_confidence = confidence
                matched = True

    # Validate invoice reference
    validated_invoice_id: Optional[str] = None
    if invoice_ref and invoice_ref in known_invoice_ids:
        validated_invoice_id = invoice_ref
    elif invoice_ref and invoice_ref not in known_invoice_ids:
        # Referenced invoice not in known set — flag ambiguity
        best_confidence = min(best_confidence, 0.60)

    # Extract promise date from body
    promised_date: Optional[date] = None
    if best_intent == EmailIntent.PROMISE_TO_PAY:
        promised_date = _extract_date_from_body(email_body)

    requires_human: bool = bool(
        best_intent in (EmailIntent.DISPUTE, EmailIntent.PAYMENT_PLAN_REQUEST)
        or best_confidence < 0.70
        or bool(invoice_ref and invoice_ref not in known_invoice_ids)
    )

    return EmailClassification(
        intent=best_intent,
        invoice_id=validated_invoice_id,
        promised_payment_date=promised_date,
        confidence=best_confidence,
        summary=f"Rule-based: detected intent '{best_intent.value}' from keywords.",
        requires_human_review=requires_human,
        classification_source="rule_based",
    )


def _extract_date_from_body(body: str) -> Optional[date]:
    """Extract a promised payment date from email body text."""
    from datetime import date as dt
    months = {
        "january": 1, "february": 2, "march": 3, "april": 4,
        "may": 5, "june": 6, "july": 7, "august": 8,
        "september": 9, "october": 10, "november": 11, "december": 12,
        "jan": 1, "feb": 2, "mar": 3, "apr": 4, "jun": 6,
        "jul": 7, "aug": 8, "sep": 9, "oct": 10, "nov": 11, "dec": 12,
    }
    body_lower = body.lower()
    today = dt.today()

    for month_name, month_num in months.items():
        m = re.search(rf"\b{month_name}\s+(\d{{1,2}})", body_lower)
        if m:
            day = int(m.group(1))
            year = today.year
            try:
                candidate = dt(year, month_num, day).date()
                if candidate < today:
                    candidate = dt(year + 1, month_num, day).date()
                return candidate
            except ValueError:
                continue
        m = re.search(rf"(\d{{1,2}})\s*(?:st|nd|rd|th)?\s+{month_name}", body_lower)
        if m:
            day = int(m.group(1))
            year = today.year
            try:
                candidate = dt(year, month_num, day).date()
                if candidate < today:
                    candidate = dt(year + 1, month_num, day).date()
                return candidate
            except ValueError:
                continue
    return None


# ---------------------------------------------------------------------------
# LLM-based classifier (NVIDIA NIM endpoint)
# ---------------------------------------------------------------------------

def classify_email_llm(
    email_body: str,
    email_subject: str,
    invoice_ref: Optional[str],
    known_invoice_ids: set[str],
    current_date: date,
) -> Optional[EmailClassification]:
    """
    Use NVIDIA NIM (google/diffusiongemma-26b-a4b-it) to classify inbound email.
    Returns None if API call fails — caller falls back to rule-based.
    """
    api_key = os.getenv("NVIDIA_API_KEY", "").strip()
    if not api_key:
        return None

    try:
        from openai import OpenAI

        client = OpenAI(
            base_url="https://integrate.api.nvidia.com/v1",
            api_key=api_key,
            timeout=15.0,  # hard cap — fall back to rule-based on slow responses
        )

        known_ids_str = ", ".join(sorted(known_invoice_ids)[:20])
        system_prompt = (
            "You are an accounts receivable email classification system. "
            "Analyse the customer email and return a JSON object ONLY with these exact keys:\n"
            "  intent: one of payment_sent|already_paid|promise_to_pay|payment_delay|"
            "dispute|invoice_question|payment_plan_request|out_of_office|general_reply|unknown\n"
            "  invoice_id: the invoice ID mentioned (e.g. INV-001) or null\n"
            "  promised_payment_date: ISO date string YYYY-MM-DD or null\n"
            "  confidence: float 0.0 to 1.0\n"
            "  summary: one sentence describing what the customer said\n"
            "  requires_human_review: true if this needs human attention, false otherwise\n\n"
            f"Known invoice IDs (validate against these): {known_ids_str}\n"
            f"Today's date for reference: {current_date.isoformat()}\n\n"
            "Return ONLY valid JSON. No explanation. No markdown."
        )

        user_prompt = (
            f"Subject: {email_subject}\n\nBody:\n{email_body}\n\n"
            f"Invoice reference (if any): {invoice_ref or 'not mentioned'}"
        )

        response = client.chat.completions.create(
            model="google/diffusiongemma-26b-a4b-it",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.0,
            max_tokens=400,
        )


        raw = response.choices[0].message.content.strip()
        # Strip markdown code blocks if present
        raw = re.sub(r"^```(?:json)?\n?", "", raw)
        raw = re.sub(r"\n?```$", "", raw)

        data = json.loads(raw)
        classification = EmailClassification(
            intent=EmailIntent(data.get("intent", "unknown")),
            invoice_id=data.get("invoice_id"),
            promised_payment_date=data.get("promised_payment_date"),
            confidence=float(data.get("confidence", 0.5)),
            summary=data.get("summary", ""),
            requires_human_review=bool(data.get("requires_human_review", False)),
            classification_source="llm",
        )

        # Post-validation: verify invoice_id exists
        if classification.invoice_id and classification.invoice_id not in known_invoice_ids:
            # OVERRIDE: LLM hallucinated an invoice ID — flag for human review
            classification.invoice_id = None
            classification.confidence = min(classification.confidence, 0.55)
            classification.requires_human_review = True
            classification.summary += " [OVERRIDE: invoice ID not found in known records — routed to human review]"

        return classification

    except Exception as exc:
        # Any failure → fall through to rule-based
        return None



# ---------------------------------------------------------------------------
# In-memory cache — same email body+subject is only classified once per run
# ---------------------------------------------------------------------------
_EMAIL_CACHE: dict[str, "EmailClassification"] = {}


def classify_email(
    email_body: str,
    email_subject: str,
    invoice_ref: Optional[str],
    known_invoice_ids: set[str],
    current_date: date,
) -> "EmailClassification":
    """
    Classify an inbound customer email.
    Tries LLM first; falls back to rule-based if unavailable.
    Always returns a validated EmailClassification.
    Results are cached by (body, subject) so the LLM is called at most once
    per unique email across the entire replay timeline.
    """
    cache_key = f"{email_subject}|||{email_body[:500]}"
    if cache_key in _EMAIL_CACHE:
        return _EMAIL_CACHE[cache_key]

    # Try LLM
    result = classify_email_llm(
        email_body, email_subject, invoice_ref, known_invoice_ids, current_date
    )

    if result is None:
        # Fallback to rule-based
        result = classify_email_rule_based(
            email_body, email_subject, invoice_ref, known_invoice_ids
        )

    _EMAIL_CACHE[cache_key] = result
    return result
