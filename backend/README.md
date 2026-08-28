# CollectIQ — Collections Agent

AI-powered accounts receivable collections automation. Simulates a back-office collections agent across 18 months of invoice and payment history, replays every decision it would have made with only the information available at that moment, and surfaces risk assessments for currently open invoices.

## Architecture

```
Historical Data (CSV)
  ├── invoices.csv       18 months, 432 invoices, 12 customers
  ├── payments.csv       403 payment records
  ├── customers.csv      12 customers with contractual payment terms
  ├── contacts.csv       Customer and provider contact hierarchy
  └── inbound_replies/   20 inbound customer email replies

        LLM mode      : NVIDIA NIM (google/gemma-2-27b-it)
  Replay Engine (src/replay.py)
  Iterates every significant date. At each date T:
  only invoices/payments/emails with timestamp ≤ T are visible.
        │
        ▼
  LangGraph Workflow (src/graph.py)
  ┌────────────────────────────────┐
  │ load_invoice_state             │ ← compute point-in-time state
  │ check_payment                  │ ← paid? → END
  │ process_email  ←── LLM HERE   │ ← classify inbound email (+ fallback)
  │ calculate_risk                 │ ← explainable risk scoring
  │ apply_policy   ←── YAML rules  │ ← deterministic escalation decision
  │ human_review (if needed)       │
  └────────────────────────────────┘
        │
        ▼
  output/replay_log.jsonl    Every action the agent would have taken
  output/risk_report.json    Risk assessment for open invoices
```

**Key principle:** LLM is used only for unstructured language tasks (email classification). All business logic — escalation, risk, routing — is deterministic Python driven by `config/policy.yaml`.

## Installation

```bash
cd backend
pip install -r requirements.txt
```

## Environment Variables

```bash
cp .env.example .env
# Edit .env and add your NVIDIA API key:
# NVIDIA_API_KEY=your-key-here
```

If `NVIDIA_API_KEY` is not set, the agent falls back to a rule-based email classifier automatically.

## Running

```bash
python main.py
```

Expected output:

```
output/replay_log.jsonl   — All actions across 18 months (JSONL format)
output/risk_report.json   — Risk assessments for open invoices
```

## Running Tests

```bash
pytest tests/ -v
```

Tests cover: paid invoice (no action), overdue reminder, promise-to-pay pause, broken promise escalation, dispute routing, future data leakage prevention, policy loading, risk scoring, and email classification fallback.

## Output Format

### replay_log.jsonl

```json
{
  "date": "2024-02-05",
  "invoice_id": "INV-001",
  "customer_id": "CUST-001",
  "customer_name": "Acme Construction Ltd",
  "recipient_tier": "customer",
  "action": "payment_reminder",
  "message_body": "Dear Acme Construction Ltd, ...",
  "delivery_mode": "auto_send",
  "reason": "Invoice is 1 days overdue — policy rule 'first_reminder' triggered",
  "policy_rule": "first_reminder",
  "risk_level": "LOW",
  "risk_score": 12.5,
  "days_overdue": 1,
  "amount_outstanding": 185000.0
}
```

### risk_report.json

```json
[
  {
    "invoice_id": "INV-096",
    "customer_name": "Sunrise Exports Ltd",
    "risk_level": "HIGH",
    "risk_score": 78.0,
    "reasons": [
      "Customer historically pays late: 6 of 8 past invoices were overdue (75%)",
      "Average payment delay: 22 days",
      "Customer has broken 1 payment promises"
    ]
  }
]
```

## Key Design Decisions

1. **No future leakage** — every data access in the replay uses explicit `timestamp <= T` filters.
2. **LLM only for language** — the LLM classifies emails and extracts dates; it never picks an escalation tier.
3. **Rule-based fallback** — works fully offline with no API key.
4. **YAML-only policy** — all thresholds in `config/policy.yaml`; no code change needed to adjust timing.
5. **Explainable risk** — every risk score has plain-language reasons; no black-box ML.
6. **Human sign-off required** for all escalations beyond the customer tier, all disputes, and all payment plan requests.

## Project Structure

```
backend/
├── main.py                  Single entry point
├── requirements.txt         Pinned dependencies
├── .env.example
├── NOTES.md
├── README.md
├── config/
│   └── policy.yaml          Escalation policy (no code needed to adjust)
├── data/                    Synthetic collections pack
├── src/
│   ├── models.py            Pydantic models (all LLM outputs validated here)
│   ├── data_loader.py       CSV loading + point-in-time filtering
│   ├── invoice_state.py     State calculator (dispute/promise detection)
│   ├── email_agent.py       LLM + rule-based email classifier
│   ├── risk_engine.py       Explainable risk scoring
│   ├── policy_engine.py     Deterministic escalation (no LLM)
│   ├── graph.py             LangGraph workflow
│   ├── replay.py            Historical dry-run engine
│   ├── message_generator.py Template-based message drafting
│   └── logger.py            JSONL + JSON output
├── output/                  Generated at runtime
└── tests/                   Pytest test suite
```
