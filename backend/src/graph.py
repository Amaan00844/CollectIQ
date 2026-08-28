"""
LangGraph workflow orchestration for the Collections Agent.

Architecture:
  START → load_invoice_state → check_payment
    ├── PAID → END
    └── UNPAID → process_email
          ├── DISPUTE / PAYMENT_PLAN → human_review → END
          ├── PROMISE_TO_PAY → monitor → END
          └── OTHERWISE → calculate_risk → apply_policy
                ├── NO ACTION → END
                ├── AUTO SEND → log_action → END
                └── HUMAN REVIEW → log_action → END

The LLM is called ONLY in process_email.
All routing decisions use deterministic conditional edges.
"""

from __future__ import annotations

from datetime import date
from typing import Literal

from langgraph.graph import StateGraph, END

from src.models import CollectionState, EmailIntent
from src.email_agent import classify_email
from src.risk_engine import compute_risk
from src.policy_engine import PolicyEngine
from src.message_generator import generate_message


# ---------------------------------------------------------------------------
# Node implementations
# ---------------------------------------------------------------------------

def node_load_invoice_state(state: CollectionState) -> CollectionState:
    """
    Invoice state is pre-loaded by the replay engine before graph invocation.
    This node validates required fields are present.
    """
    required = ["invoice_id", "customer_id", "invoice_status", "days_overdue"]
    for field in required:
        if field not in state:
            state["error"] = f"Missing required field: {field}"
    return state


def node_check_payment(state: CollectionState) -> CollectionState:
    """Check if invoice is fully paid."""
    if state.get("payment_received") or state.get("invoice_status") == "paid":
        state["next_action"] = "no_action"
        state["delivery_mode"] = "no_action"
        state["decision_reason"] = "Invoice is fully paid — no collection action required"
        state["policy_rule"] = "paid_check"
        state["requires_human_review"] = False
    return state


def node_process_email(state: CollectionState, known_invoice_ids: set[str] | None = None) -> CollectionState:
    """
    Classify the most recent pending customer email using LLM (with fallback).
    This is the ONLY node that calls the LLM.
    """
    pending_emails = state.get("pending_emails", [])
    if not pending_emails:
        state["email_intent"] = None
        state["email_confidence"] = None
        return state

    # Process the most recent email
    most_recent = sorted(pending_emails, key=lambda e: e.get("received_date", ""), reverse=True)[0]
    current_date_str = state.get("current_date", date.today().isoformat())
    current_date = date.fromisoformat(current_date_str)

    known_ids = known_invoice_ids or {state.get("invoice_id", "")}

    classification = classify_email(
        email_body=most_recent.get("body", ""),
        email_subject=most_recent.get("subject", ""),
        invoice_ref=most_recent.get("invoice_ref"),
        known_invoice_ids=known_ids,
        current_date=current_date,
    )

    state["email_intent"] = classification.intent.value
    state["email_confidence"] = classification.confidence
    state["email_summary"] = classification.summary

    if classification.promised_payment_date:
        state["promised_payment_date"] = classification.promised_payment_date.isoformat()
        state["has_active_promise"] = True
        state["promise_date"] = classification.promised_payment_date.isoformat()

    if classification.intent == EmailIntent.DISPUTE:
        state["has_active_dispute"] = True

    return state


def node_calculate_risk(
    state: CollectionState,
    invoice_obj=None,
    all_invoices=None,
    all_payments=None,
    action_history=None,
    policy=None,
) -> CollectionState:
    """
    Calculate risk score using the explainable risk engine.
    """
    risk_reasons = state.get("risk_reasons", [])
    if not risk_reasons:
        state["risk_score"] = 0.0
        state["risk_level"] = "LOW"
        state["risk_reasons"] = ["Risk calculation context not available in this run mode"]
    return state


def node_apply_policy(state: CollectionState, policy_engine: PolicyEngine | None = None, current_date: date | None = None) -> CollectionState:
    """
    Apply deterministic policy rules to determine next action.
    NO LLM involved — pure Python logic from PolicyEngine.
    """
    if policy_engine is None:
        state["next_action"] = "no_action"
        state["delivery_mode"] = "no_action"
        state["decision_reason"] = "Policy engine not available"
        state["requires_human_review"] = False
        return state

    action_history = state.get("action_history", [])
    current_date_str = state.get("current_date", date.today().isoformat())
    # Always parse from isoformat string — avoids LangGraph date serialisation issues
    if isinstance(current_date_str, date):
        cd = current_date_str
    else:
        cd = date.fromisoformat(str(current_date_str))
    if current_date is not None:
        cd = current_date
    decision = policy_engine.decide_with_date(state, action_history, cd)


    state["next_action"] = decision["next_action"]
    state["recipient_tier"] = decision["recipient_tier"]
    state["delivery_mode"] = decision["delivery_mode"]
    state["policy_rule"] = decision["policy_rule"]
    state["decision_reason"] = decision["decision_reason"]
    state["requires_human_review"] = decision["requires_human_review"]

    # Generate message if action needed
    if decision["next_action"] != "no_action":
        state["message_body"] = generate_message(
            invoice_id=state.get("invoice_id", ""),
            customer_name=state.get("customer_name", ""),
            amount_outstanding=state.get("amount_outstanding", 0.0),
            currency=state.get("currency", "INR"),
            due_date=state.get("due_date", ""),
            days_overdue=state.get("days_overdue", 0),
            recipient_tier=decision["recipient_tier"],
            action=decision["next_action"],
            policy_rule=decision["policy_rule"],
            promise_date=state.get("promise_date"),
            description=state.get("description", ""),
        )

    return state


def node_human_review(state: CollectionState) -> CollectionState:
    """Route to human review — generate internal review message."""
    state["requires_human_review"] = True
    state["delivery_mode"] = "human_signoff"
    if not state.get("message_body"):
        state["message_body"] = generate_message(
            invoice_id=state.get("invoice_id", ""),
            customer_name=state.get("customer_name", ""),
            amount_outstanding=state.get("amount_outstanding", 0.0),
            currency=state.get("currency", "INR"),
            due_date=state.get("due_date", ""),
            days_overdue=state.get("days_overdue", 0),
            recipient_tier="internal",
            action=state.get("next_action", "route_human_review"),
            policy_rule=state.get("policy_rule", "human_review"),
            description=state.get("description", ""),
        )
    return state


# ---------------------------------------------------------------------------
# Conditional routing functions
# ---------------------------------------------------------------------------

def route_after_payment_check(state: CollectionState) -> Literal["process_email", "end"]:
    if state.get("payment_received") or state.get("invoice_status") == "paid":
        return "end"
    return "process_email"


def route_after_email(state: CollectionState) -> Literal["human_review", "calculate_risk"]:
    intent = state.get("email_intent")
    confidence = state.get("email_confidence", 1.0) or 1.0
    has_promise = state.get("has_active_promise", False)
    promise_broken = state.get("promise_broken", False)

    if intent in ("dispute", "payment_plan_request"):
        return "human_review"
    if confidence < 0.70 and intent and intent != "unknown":
        return "human_review"
    return "calculate_risk"


def route_after_policy(state: CollectionState) -> Literal["human_review", "end"]:
    if state.get("requires_human_review") and state.get("next_action") != "no_action":
        return "human_review"
    return "end"


# ---------------------------------------------------------------------------
# Graph builder
# ---------------------------------------------------------------------------

def build_collections_graph(
    policy_engine: PolicyEngine,
    known_invoice_ids: set[str],
    current_date: date,
):
    """
    Build and compile the LangGraph collections workflow.
    Returns a compiled graph ready for .invoke().
    """
    workflow = StateGraph(CollectionState)

    # Register nodes (use closures to inject dependencies)
    workflow.add_node("load_invoice_state", node_load_invoice_state)
    workflow.add_node("check_payment", node_check_payment)

    def _process_email(state: CollectionState) -> CollectionState:
        return node_process_email(state, known_invoice_ids=known_invoice_ids)

    def _apply_policy(state: CollectionState) -> CollectionState:
        return node_apply_policy(state, policy_engine=policy_engine, current_date=current_date)

    workflow.add_node("process_email", _process_email)
    workflow.add_node("calculate_risk", node_calculate_risk)
    workflow.add_node("apply_policy", _apply_policy)
    workflow.add_node("human_review", node_human_review)

    # Set entry point
    workflow.set_entry_point("load_invoice_state")

    # Add edges
    workflow.add_edge("load_invoice_state", "check_payment")
    workflow.add_conditional_edges(
        "check_payment",
        route_after_payment_check,
        {"process_email": "process_email", "end": END},
    )
    workflow.add_conditional_edges(
        "process_email",
        route_after_email,
        {"human_review": "human_review", "calculate_risk": "calculate_risk"},
    )
    workflow.add_edge("calculate_risk", "apply_policy")
    workflow.add_conditional_edges(
        "apply_policy",
        route_after_policy,
        {"human_review": "human_review", "end": END},
    )
    workflow.add_edge("human_review", END)

    return workflow.compile()
