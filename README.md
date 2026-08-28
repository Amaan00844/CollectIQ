# CollectIQ

AI-powered accounts-receivable collections agent for the F/S technical exercise.

CollectIQ reads customer, invoice, payment, and inbound-email data, then decides what collection action should happen next. The agent replays the history in date order and writes simulated actions to a log instead of sending real emails.

## What's In The Project

### Backend

- `backend/main.py` - command-line entry point that runs the full replay
- `backend/api.py` - FastAPI server exposing the data and agent results
- `backend/src/` - data loading, email classification, risk, policy, replay, and logging logic
- `backend/data/` - collections-pack CSV files
- `backend/config/policy.yaml` - configurable escalation policy
- `backend/output/replay_log.jsonl` - generated dry-run actions
- `backend/output/risk_report.json` - generated risk report
- `backend/tests/` - automated backend tests

### Frontend

- `frontend/src/app/` - Next.js dashboard pages
- `frontend/src/lib/api.ts` - frontend client for the FastAPI backend
- `frontend/src/components/` - shared layout and UI components
- `frontend/package.json` - Next.js dependencies and scripts

### Written Deliverables

- `backend/NOTES.md` - policy rationale, safety boundary, and AI usage
- `thought_exercise.md` - concrete-defect analytics thought exercise

## Prerequisites

- Python 3.11 or newer
- Node.js 18 or newer
- npm

## Run The Backend

Open a terminal and run:

```powershell
cd C:\Users\user\Downloads\collectIQ-1\CollectIQ\backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

Optional: create `backend/.env` for NVIDIA LLM classification:

```env
NVIDIA_API_KEY=your-private-nvidia-api-key
```

Never commit `.env` or expose the API key in the frontend.

Run the historical replay:

```powershell
python main.py
```

This writes the replay and risk files under `backend/output/`.

Start the API server in the same backend terminal, or in a second backend terminal with the virtual environment activated:

```powershell
uvicorn api:app --reload --host 0.0.0.0 --port 8000
```

Check the backend:

- http://localhost:8000/health
- http://localhost:8000/docs

## Run The Frontend

Open a second terminal:

```powershell
cd C:\Users\user\Downloads\collectIQ-1\CollectIQ\frontend
npm install
```

For local development, create `frontend/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

Start Next.js:

```powershell
npm run dev
```

Open http://localhost:3000.

Run only one frontend dev server at a time. Do not run `npm run build` while `npm run dev` is using the same `.next` directory. If the development cache becomes corrupted, stop the server, remove `.next`, and restart:

```powershell
Remove-Item -Recurse -Force .next
npm run dev
```

## Frontend and Backend Connection

The frontend reads live data from the FastAPI backend through `frontend/src/lib/api.ts`. It calls:

```text
GET /invoices
GET /customers
GET /customers/{id}
GET /invoices/{id}
GET /risk
GET /replay
GET /policy
```

The frontend does not use the old mock data for operational pages. If the API is unavailable, the UI shows an error state.

For a deployed frontend, set this Vercel environment variable to the public backend URL:

```env
NEXT_PUBLIC_API_URL=https://your-backend.example.com
```

The backend is a separate Python service. Its start command is:

```text
uvicorn api:app --host 0.0.0.0 --port $PORT
```

## How The Agent Works

The replay engine processes significant dates chronologically. At date `T`, it can see only invoices, payments, emails, and previous actions known by `T`. This prevents future-data leakage.

```text
Load point-in-time invoice state
        |
Check payment status
        |
Classify the latest customer reply
        |
Calculate explainable risk
        |
Apply policy.yaml rules
        |
Create a simulated action or do nothing
        |
Write replay_log.jsonl
```

The current policy is:

| Timing         | Action          | Recipient  | Mode              |
| -------------- | --------------- | ---------- | ----------------- |
| Day 1 overdue  | First reminder  | Customer   | Auto-send if safe |
| Day 7 overdue  | Second reminder | Customer   | Auto-send if safe |
| Day 14 overdue | Third reminder  | Customer   | Auto-send if safe |
| Day 21 overdue | Escalation      | Sales      | Human sign-off    |
| Day 35 overdue | Escalation      | Controller | Human sign-off    |
| Day 50 overdue | Escalation      | CEO        | Human sign-off    |
| Day 65 overdue | Escalation      | Owner      | Human sign-off    |

All thresholds and timings are configurable in `backend/config/policy.yaml`.

## LLM And Dry-Run Behavior

The LLM is used only in `backend/src/email_agent.py` to classify unstructured customer replies and extract intent, invoice references, and promised dates. It does not choose escalation tiers, calculate risk, or send messages.

NVIDIA NIM is used when `NVIDIA_API_KEY` is configured. If the key is missing or the API call fails, the rule-based classifier is used automatically.

This project is deliberately a dry run. An action with `delivery_mode: auto_send` means the agent would have sent the message under the policy. It does not send a real email. An action with `delivery_mode: human_signoff` means it would be held for approval.

There is no SMTP, SendGrid, SES, or other real-email integration in this exercise.

## Test And Build

Run backend tests:

```powershell
cd C:\Users\user\Downloads\collectIQ-1\CollectIQ\backend
pytest tests/ -v
```

Run the frontend production build:

```powershell
cd C:\Users\user\Downloads\collectIQ-1\CollectIQ\frontend
npm run build
```

## API Endpoints

| Method | Endpoint          | Purpose                                   |
| ------ | ----------------- | ----------------------------------------- |
| GET    | `/`               | Health check                              |
| GET    | `/health`         | Data and output status                    |
| GET    | `/invoices`       | Invoice payment status                    |
| GET    | `/invoices/{id}`  | Invoice detail, payments, emails, actions |
| GET    | `/customers`      | Customer balances and open invoices       |
| GET    | `/customers/{id}` | Customer detail and related records       |
| GET    | `/emails`         | Inbound customer emails                   |
| GET    | `/replay`         | Dry-run action log                        |
| GET    | `/risk`           | Open-invoice risk report                  |
| GET    | `/policy`         | Current YAML policy as JSON               |
| POST   | `/run`            | Start a new replay in the background      |
| GET    | `/run/status`     | Replay status                             |
| GET    | `/docs`           | Swagger API documentation                 |

## Data And Results

The supplied data contains 12 customers, 100 invoices, 89 payments, and 30 inbound emails. The included replay output contains 358 simulated actions and the risk output covers currently open invoices.

The main design boundaries are documented in `backend/NOTES.md`.
