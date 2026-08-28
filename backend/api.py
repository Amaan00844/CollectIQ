"""
CollectIQ — FastAPI server.
Exposes the collections engine as a REST API.

Endpoints:
  GET  /                    health check
  GET  /health              health check (verbose)
  GET  /invoices            all invoices (with payment status)
  GET  /invoices/{id}       single invoice detail
  GET  /customers           all customers
  GET  /customers/{id}      single customer with their invoices
  GET  /emails              all inbound emails
  GET  /replay              full replay log (all 358 actions)
  GET  /risk                risk report for open invoices
  GET  /policy              loaded escalation policy
  POST /run                 re-run the full replay (background task)

Run locally:
  uvicorn api:app --reload --port 8000

Render start command:
  uvicorn api:app --host 0.0.0.0 --port $PORT
"""

from __future__ import annotations

import json
import os
import threading
from datetime import date
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware

load_dotenv()

# ---------------------------------------------------------------------------
# App setup
# ---------------------------------------------------------------------------

app = FastAPI(
    title="CollectIQ API",
    description="AI-powered Accounts Receivable Collections Agent",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tighten in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = Path(__file__).parent
OUTPUT_DIR = BASE_DIR / "output"
REPLAY_LOG = OUTPUT_DIR / "replay_log.jsonl"
RISK_REPORT = OUTPUT_DIR / "risk_report.json"

# ---------------------------------------------------------------------------
# Lazy-load data (loaded once on first request)
# ---------------------------------------------------------------------------

_data = None
_policy = None
_replay_running = False


def get_data():
    global _data
    if _data is None:
        from src.data_loader import CollectionsData
        _data = CollectionsData()
    return _data


def get_policy():
    global _policy
    if _policy is None:
        from src.replay import load_policy
        _policy = load_policy()
    return _policy


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------

@app.get("/", tags=["Health"])
def root():
    return {"status": "ok", "service": "CollectIQ API", "version": "1.0.0"}


@app.get("/health", tags=["Health"])
def health():
    data = get_data()
    return {
        "status": "ok",
        "invoices": len(data.invoices),
        "customers": len(data.customers),
        "payments": len(data.payments),
        "emails": len(data.emails),
        "replay_log_exists": REPLAY_LOG.exists(),
        "replay_log_bytes": REPLAY_LOG.stat().st_size if REPLAY_LOG.exists() else 0,
        "risk_report_exists": RISK_REPORT.exists(),
    }


# ---------------------------------------------------------------------------
# Invoices
# ---------------------------------------------------------------------------

@app.get("/invoices", tags=["Invoices"])
def list_invoices():
    data = get_data()
    today = date.today()
    result = []
    for inv_id, inv in data.invoices.items():
        payments = [p for p in data.payments if p.invoice_id == inv_id]
        total_paid = sum(p.amount_paid for p in payments)
        outstanding = max(0.0, inv.amount - total_paid)
        if outstanding == 0:
            status = "paid"
        elif total_paid > 0:
            status = "partial"
        elif today > inv.due_date:
            status = "overdue"
        else:
            status = "open"
        days_overdue = max(0, (today - inv.due_date).days) if today > inv.due_date else 0
        result.append({
            "invoice_id": inv_id,
            "customer_id": inv.customer_id,
            "customer_name": data.customers.get(inv.customer_id, type("", (), {"customer_name": "Unknown"})()).customer_name if inv.customer_id in data.customers else "Unknown",
            "amount": inv.amount,
            "currency": inv.currency,
            "issue_date": inv.issue_date.isoformat(),
            "due_date": inv.due_date.isoformat(),
            "description": inv.description,
            "status": status,
            "total_paid": total_paid,
            "amount_outstanding": outstanding,
            "days_overdue": days_overdue,
        })
    result.sort(key=lambda x: x["days_overdue"], reverse=True)
    return {"count": len(result), "invoices": result}


@app.get("/invoices/{invoice_id}", tags=["Invoices"])
def get_invoice(invoice_id: str):
    data = get_data()
    inv = data.invoices.get(invoice_id)
    if not inv:
        raise HTTPException(status_code=404, detail=f"Invoice {invoice_id} not found")
    today = date.today()
    payments = [p for p in data.payments if p.invoice_id == invoice_id]
    total_paid = sum(p.amount_paid for p in payments)
    outstanding = max(0.0, inv.amount - total_paid)
    emails = [
        {
            "email_id": e.email_id,
            "subject": e.subject,
            "body": e.body,
            "received_date": e.received_date.isoformat(),
            "invoice_ref": e.invoice_ref,
        }
        for e in data.emails
        if e.invoice_ref == invoice_id or e.customer_id == inv.customer_id
    ]
    # Pull actions from replay log
    actions = []
    if REPLAY_LOG.exists():
        with open(REPLAY_LOG, "r", encoding="utf-8") as f:
            for line in f:
                try:
                    rec = json.loads(line)
                    if rec.get("invoice_id") == invoice_id:
                        actions.append(rec)
                except Exception:
                    pass
    return {
        "invoice_id": invoice_id,
        "customer_id": inv.customer_id,
        "amount": inv.amount,
        "currency": inv.currency,
        "issue_date": inv.issue_date.isoformat(),
        "due_date": inv.due_date.isoformat(),
        "description": inv.description,
        "status": "paid" if outstanding == 0 else ("partial" if total_paid > 0 else ("overdue" if today > inv.due_date else "open")),
        "total_paid": total_paid,
        "amount_outstanding": outstanding,
        "days_overdue": max(0, (today - inv.due_date).days) if today > inv.due_date else 0,
        "payments": [{"amount": p.amount_paid, "date": p.payment_date.isoformat(), "method": p.payment_method, "reference": p.reference} for p in payments],
        "emails": emails,
        "actions": actions,
    }


# ---------------------------------------------------------------------------
# Customers
# ---------------------------------------------------------------------------

@app.get("/customers", tags=["Customers"])
def list_customers():
    data = get_data()
    today = date.today()
    result = []
    for cust_id, cust in data.customers.items():
        invoices = [inv for inv in data.invoices.values() if inv.customer_id == cust_id]
        open_invoices = []
        total_outstanding = 0.0
        for inv in invoices:
            payments = [p for p in data.payments if p.invoice_id == inv.invoice_id]
            paid = sum(p.amount_paid for p in payments)
            outstanding = max(0.0, inv.amount - paid)
            if outstanding > 0:
                open_invoices.append(inv.invoice_id)
                total_outstanding += outstanding
        result.append({
            "customer_id": cust_id,
            "customer_name": cust.customer_name,
            "contact_email": cust.contact_email,
            "industry": cust.industry,
            "credit_limit": cust.credit_limit,
            "payment_terms_days": cust.payment_terms_days,
            "open_invoices": len(open_invoices),
            "open_invoice_ids": open_invoices,
            "total_outstanding": total_outstanding,
        })
    result.sort(key=lambda x: x["total_outstanding"], reverse=True)
    return {"count": len(result), "customers": result}


@app.get("/customers/{customer_id}", tags=["Customers"])
def get_customer(customer_id: str):
    data = get_data()
    cust = data.customers.get(customer_id)
    if not cust:
        raise HTTPException(status_code=404, detail=f"Customer {customer_id} not found")
    invoices = [inv for inv in data.invoices.values() if inv.customer_id == customer_id]
    emails = [
        {"email_id": e.email_id, "subject": e.subject, "received_date": e.received_date.isoformat(), "invoice_ref": e.invoice_ref}
        for e in data.emails if e.customer_id == customer_id
    ]
    return {
        "customer_id": customer_id,
        "customer_name": cust.customer_name,
        "contact_email": cust.contact_email,
        "industry": cust.industry,
        "credit_limit": cust.credit_limit,
        "payment_terms_days": cust.payment_terms_days,
        "invoice_count": len(invoices),
        "invoices": [{"invoice_id": inv.invoice_id, "amount": inv.amount, "due_date": inv.due_date.isoformat(), "description": inv.description} for inv in invoices],
        "emails": emails,
    }


# ---------------------------------------------------------------------------
# Emails
# ---------------------------------------------------------------------------

@app.get("/emails", tags=["Emails"])
def list_emails():
    data = get_data()
    return {
        "count": len(data.emails),
        "emails": [
            {
                "email_id": e.email_id,
                "customer_id": e.customer_id,
                "from_email": e.from_email,
                "subject": e.subject,
                "body": e.body,
                "received_date": e.received_date.isoformat(),
                "invoice_ref": e.invoice_ref,
            }
            for e in data.emails
        ],
    }


# ---------------------------------------------------------------------------
# Replay log
# ---------------------------------------------------------------------------

@app.get("/replay", tags=["Replay"])
def get_replay(limit: int = 500, offset: int = 0):
    if not REPLAY_LOG.exists():
        raise HTTPException(status_code=404, detail="Replay log not found. Run POST /run first.")
    actions = []
    with open(REPLAY_LOG, "r", encoding="utf-8") as f:
        for line in f:
            try:
                actions.append(json.loads(line))
            except Exception:
                pass
    total = len(actions)
    return {
        "total": total,
        "offset": offset,
        "limit": limit,
        "actions": actions[offset: offset + limit],
    }


# ---------------------------------------------------------------------------
# Risk report
# ---------------------------------------------------------------------------

@app.get("/risk", tags=["Risk"])
def get_risk():
    if not RISK_REPORT.exists():
        raise HTTPException(status_code=404, detail="Risk report not found. Run POST /run first.")
    with open(RISK_REPORT, "r", encoding="utf-8") as f:
        data = json.load(f)
    return data


# ---------------------------------------------------------------------------
# Policy
# ---------------------------------------------------------------------------

@app.get("/policy", tags=["Policy"])
def get_policy_endpoint():
    return get_policy()


# ---------------------------------------------------------------------------
# Trigger replay run
# ---------------------------------------------------------------------------

def _run_replay_task():
    global _replay_running
    try:
        from src.replay import run_replay
        run_replay(verbose=False)
    finally:
        _replay_running = False


@app.post("/run", tags=["Run"])
def trigger_run(background_tasks: BackgroundTasks):
    global _replay_running
    if _replay_running:
        return {"status": "already_running", "message": "A replay is already in progress."}
    _replay_running = True
    background_tasks.add_task(_run_replay_task)
    return {
        "status": "started",
        "message": "Replay started in background. Poll GET /replay and GET /risk for results.",
    }


@app.get("/run/status", tags=["Run"])
def run_status():
    return {
        "running": _replay_running,
        "replay_log_exists": REPLAY_LOG.exists(),
        "replay_log_bytes": REPLAY_LOG.stat().st_size if REPLAY_LOG.exists() else 0,
        "risk_report_exists": RISK_REPORT.exists(),
    }
