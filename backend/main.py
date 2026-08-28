"""
CollectIQ Collections Agent — Main Entry Point

Usage:
    pip install -r requirements.txt
    python main.py

Outputs:
    output/replay_log.jsonl  — Every action the agent would have taken across 18 months
    output/risk_report.json  — Risk assessment for currently open invoices
"""

from __future__ import annotations

import json
import os
import sys
from datetime import date
from pathlib import Path

# Load .env before anything else
from dotenv import load_dotenv
load_dotenv()

import yaml

# Ensure src is importable when running from backend/ directory
sys.path.insert(0, str(Path(__file__).parent))

from src.data_loader import CollectionsData
from src.replay import run_replay, generate_risk_report, load_policy
from src.logger import write_risk_report

OUTPUT_DIR = Path(__file__).parent / "output"
RISK_REPORT_PATH = OUTPUT_DIR / "risk_report.json"
REPLAY_LOG_PATH = OUTPUT_DIR / "replay_log.jsonl"


def print_header():
    print()
    print("=" * 60)
    print("  CollectIQ — AI-Powered Collections Agent")
    print("  Accounts Receivable Automation Platform")
    print("=" * 60)
    print()


def print_summary(action_count: int, risk_report: list[dict]):
    print()
    print("=" * 60)
    print("  REPLAY COMPLETE")
    print("=" * 60)
    print(f"  Actions logged       : {action_count}")
    print(f"  Open invoices at risk: {len(risk_report)}")

    high_risk = [r for r in risk_report if r["risk_level"] in ("HIGH", "CRITICAL")]
    total_exposure = sum(r["amount_outstanding"] for r in risk_report)

    print(f"  High/critical risk   : {len(high_risk)}")
    print(f"  Total open exposure  : INR {total_exposure:,.0f}")

    print()
    print(f"  Output files:")
    print(f"    {REPLAY_LOG_PATH}")
    print(f"    {RISK_REPORT_PATH}")
    print()

    if risk_report:
        print("  Top 3 Risk Invoices:")
        print("  " + "-" * 55)
        for r in risk_report[:3]:
            print(f"  {r['invoice_id']} | {r['customer_name']}")
            print(f"    ₹{r['amount_outstanding']:,.0f} | {r['risk_level']} ({r['risk_score']:.0f}/100)")
            for reason in r["reasons"][:2]:
                print(f"    • {reason}")
            print()


def main():
    print_header()

    # Check API key
    api_key = os.getenv("NVIDIA_API_KEY", "").strip()
    if api_key:
        print(f"  LLM mode      : NVIDIA NIM (llama-3.1-70b-instruct)")
    else:
        print(f"  LLM mode      : Rule-based fallback (no API key set)")

    print()
    print("Loading collections data...")
    data = CollectionsData()
    print(f"  Customers : {len(data.customers)}")
    print(f"  Invoices  : {len(data.invoices)}")
    print(f"  Payments  : {len(data.payments)}")
    print(f"  Emails    : {len(data.emails)}")

    policy = load_policy()
    print()
    print("Running historical replay...")
    print("  (Simulating agent decisions across all dates — no future data used)")
    print()

    action_count, action_history = run_replay(verbose=True)

    print()
    print("Generating risk report for open invoices...")
    as_of = date.today()
    # Use the last known date from data as "now" to keep it self-contained
    last_payment_date = max(p.payment_date for p in data.payments) if data.payments else as_of
    last_invoice_date = max(i.due_date for i in data.invoices.values()) if data.invoices else as_of
    simulation_end = max(last_payment_date, last_invoice_date)

    risk_report = generate_risk_report(data, policy, action_history, simulation_end)
    write_risk_report(risk_report, RISK_REPORT_PATH)

    print_summary(action_count, risk_report)


if __name__ == "__main__":
    main()
