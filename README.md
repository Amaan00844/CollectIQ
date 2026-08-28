# CollectIQ — AI-Powered Accounts Receivable Collections Agent

> F/S Technical Exercise · Built with Python + LangGraph + FastAPI + Next.js

---

## Quick Start

### Backend
```bash
cd backend
pip install -r requirements.txt
cp .env.example .env          # add your NVIDIA_API_KEY
python main.py                # runs full 18-month replay
uvicorn api:app --reload      # starts REST API on :8000
```

### Frontend
```bash
cd frontend
npm install
# set NEXT_PUBLIC_API_URL in .env.local
npm run dev                   # http://localhost:3001 or http://localhost:3000
```

---

## What Was Built

### Part 1 — Collections Agent

| Deliverable | File |
|---|---|
| Entry point | `backend/main.py` |
| Pinned dependencies | `backend/requirements.txt` |
| Escalation policy (config) | `backend/config/policy.yaml` |
| Reply handling (LLM + fallback) | `backend/src/email_agent.py` |
| Dry-run replay log | `backend/output/replay_log.jsonl` |
| Risk report | `backend/output/risk_report.json` |
| Policy rationale | `backend/NOTES.md` |
| Tests (26/26 passing) | `backend/tests/test_collections.py` |

### Part 2 — Thought Exercise
`thought_exercise.md` — concrete defect prediction analysis, one page.

---

## Architecture

```
main.py
  └── replay.py          # 18-month point-in-time simulation
        └── graph.py     # LangGraph StateGraph
              ├── email_agent.py   # LLM classification (NVIDIA NIM)
              ├── risk_engine.py   # Weighted explainable scoring
              ├── policy_engine.py # Deterministic rules from policy.yaml
              └── message_generator.py

api.py                   # FastAPI REST server
```

### Escalation Ladder (config/policy.yaml)
| Day | Action | Tier | Mode |
|---|---|---|---|
| 1 | First reminder | Customer | Auto |
| 7 | Second reminder | Customer | Auto |
| 14 | Third reminder | Customer | Auto |
| 21 | Sales handoff | Sales | Human sign-off |
| 35 | Controller notice | Controller | Human sign-off |
| 50 | CEO notice | CEO | Human sign-off |
| 65 | Owner notice | Owner | Human sign-off |

### Safety Invariants
- LLM used only for email classification — never for escalation decisions
- All LLM output validated with Pydantic before affecting business logic
- Disputes halt all automation immediately
- No auto-send above ₹3,00,000
- Point-in-time isolation: agent sees only data known at each simulation date

---

## API Endpoints (FastAPI)

| Method | Endpoint | Description |
|---|---|---|
| GET | `/` | Health check |
| GET | `/invoices` | All invoices with payment status |
| GET | `/invoices/{id}` | Invoice detail + payments + emails + actions |
| GET | `/customers` | All customers sorted by outstanding |
| GET | `/customers/{id}` | Customer detail |
| GET | `/emails` | All inbound emails |
| GET | `/replay` | Full 358-action replay log |
| GET | `/risk` | Risk report for open invoices |
| GET | `/policy` | Escalation policy as JSON |
| POST | `/run` | Trigger a new replay run |
| GET | `/docs` | Interactive Swagger UI |

---

## Replay Results
- **358 actions** logged across 18 months
- **11 open invoices** assessed for risk
- **INR 50,30,000** total open exposure
- Top risk: INV-091 (Sunrise Exports) — HIGH (52/100), 100% historical late rate
