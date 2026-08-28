"""
Pydantic models for CollectIQ Collections Agent.
All LLM outputs are validated through these models before any business logic runs.
"""

from __future__ import annotations

from datetime import date, datetime
from enum import Enum
from typing import Any, Optional

from pydantic import BaseModel, Field, field_validator
from typing_extensions import TypedDict


# ---------------------------------------------------------------------------
# Domain Enums
# ---------------------------------------------------------------------------

class EmailIntent(str, Enum):
    PAYMENT_SENT = "payment_sent"
    ALREADY_PAID = "already_paid"
    PROMISE_TO_PAY = "promise_to_pay"
    PAYMENT_DELAY = "payment_delay"
    DISPUTE = "dispute"
    INVOICE_QUESTION = "invoice_question"
    PAYMENT_PLAN_REQUEST = "payment_plan_request"
    OUT_OF_OFFICE = "out_of_office"
    GENERAL_REPLY = "general_reply"
    UNKNOWN = "unknown"


class InvoiceStatus(str, Enum):
    PAID = "paid"
    PARTIAL = "partial"
    OPEN = "open"
    OVERDUE = "overdue"
    DISPUTED = "disputed"
    PROMISE_TO_PAY = "promise_to_pay"


class RiskLevel(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class DeliveryMode(str, Enum):
    AUTO_SEND = "auto_send"
    HUMAN_SIGNOFF = "human_signoff"
    NO_ACTION = "no_action"


class RecipientTier(str, Enum):
    CUSTOMER = "customer"
    SALES = "sales"
    CONTROLLER = "controller"
    CEO = "ceo"
    OWNER = "owner"
    INTERNAL = "internal"


# ---------------------------------------------------------------------------
# Data Models
# ---------------------------------------------------------------------------

class Customer(BaseModel):
    customer_id: str
    customer_name: str
    contact_email: str
    sales_rep: str
    controller_email: str
    ceo_email: str
    owner_email: str
    industry: str
    payment_terms_days: int


class Invoice(BaseModel):
    invoice_id: str
    customer_id: str
    amount: float
    currency: str = "INR"
    issue_date: date
    due_date: date
    description: str

    @field_validator("issue_date", "due_date", mode="before")
    @classmethod
    def parse_date(cls, v: Any) -> date:
        if isinstance(v, date):
            return v
        return date.fromisoformat(str(v))


class Payment(BaseModel):
    payment_id: str
    invoice_id: str
    amount_paid: float
    payment_date: date
    payment_method: str
    reference: str

    @field_validator("payment_date", mode="before")
    @classmethod
    def parse_date(cls, v: Any) -> date:
        if isinstance(v, date):
            return v
        return date.fromisoformat(str(v))


class Email(BaseModel):
    email_id: str
    customer_id: str
    from_email: str
    subject: str
    body: str
    received_date: date
    invoice_ref: Optional[str] = None

    @field_validator("received_date", mode="before")
    @classmethod
    def parse_date(cls, v: Any) -> date:
        if isinstance(v, date):
            return v
        return date.fromisoformat(str(v))


# ---------------------------------------------------------------------------
# LLM Output Model (validated before any business logic)
# ---------------------------------------------------------------------------

class EmailClassification(BaseModel):
    intent: EmailIntent
    invoice_id: Optional[str] = None
    promised_payment_date: Optional[date] = None
    confidence: float = Field(ge=0.0, le=1.0)
    summary: str
    requires_human_review: bool
    classification_source: str = "llm"  # "llm" | "rule_based"

    @field_validator("promised_payment_date", mode="before")
    @classmethod
    def parse_date(cls, v: Any) -> Optional[date]:
        if v is None or v == "" or v == "null":
            return None
        if isinstance(v, date):
            return v
        try:
            return date.fromisoformat(str(v))
        except Exception:
            return None


# ---------------------------------------------------------------------------
# Risk Assessment
# ---------------------------------------------------------------------------

class RiskAssessment(BaseModel):
    invoice_id: str
    customer_id: str
    customer_name: str
    risk_level: RiskLevel
    risk_score: float = Field(ge=0.0, le=100.0)
    reasons: list[str]
    features: dict[str, float] = Field(default_factory=dict)


# ---------------------------------------------------------------------------
# Collection Action (what the agent decides to do)
# ---------------------------------------------------------------------------

class CollectionAction(BaseModel):
    date: str
    invoice_id: str
    customer_id: str
    customer_name: str
    recipient_tier: str
    action: str
    message_body: str
    delivery_mode: str
    reason: str
    policy_rule: str
    risk_level: str
    risk_score: float
    days_overdue: int
    amount_outstanding: float
    email_intent: Optional[str] = None
    promised_payment_date: Optional[str] = None


# ---------------------------------------------------------------------------
# LangGraph State (TypedDict for graph nodes)
# ---------------------------------------------------------------------------

class CollectionState(TypedDict, total=False):
    # Context
    current_date: str
    invoice_id: str
    customer_id: str
    customer_name: str
    customer_email: str

    # Invoice facts
    invoice_status: str
    due_date: str
    amount: float
    amount_outstanding: float
    days_overdue: int
    issue_date: str
    description: str
    currency: str

    # Payment
    payment_received: bool
    total_paid: float

    # Email context
    pending_emails: list[dict]
    email_intent: Optional[str]
    promised_payment_date: Optional[str]
    email_confidence: Optional[float]
    email_summary: Optional[str]

    # Promises
    has_active_promise: bool
    promise_date: Optional[str]
    promise_broken: bool

    # Dispute
    has_active_dispute: bool

    # Risk
    risk_score: Optional[float]
    risk_level: Optional[str]
    risk_reasons: list[str]

    # Policy outcome
    next_action: Optional[str]
    recipient_tier: Optional[str]
    delivery_mode: Optional[str]
    policy_rule: Optional[str]
    requires_human_review: bool
    decision_reason: Optional[str]
    message_body: Optional[str]

    # Action history (for dedup)
    action_history: list[dict]
    error: Optional[str]
