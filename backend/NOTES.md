# NOTES.md — CollectIQ Collections Agent

## Policy Rationale

The escalation ladder — Day 1 → 7 → 14 (customer reminders) → Day 21 (Sales) → Day 35 (Controller) → Day 50 (CEO) → Day 65 (Owner) — was designed by examining the synthetic data patterns: most reliable customers pay within 10 days of a first reminder; chronically late customers begin showing non-response after the second reminder (~7 days). The 21-day sales handoff gives the relationship owner a chance to intervene before the invoice becomes a controller-level concern. CEO and owner escalation are final-resort levers, deliberately late and always requiring sign-off, because executive involvement in collections carries relationship risk that automation cannot assess.

## What the Agent May Do Without a Human

- Send friendly payment reminders (Day 1, 7, 14) when the invoice is mapped to a verified customer, payment has been reconciled, no dispute is active, no recent contradictory reply exists, and the outstanding amount is below ₹3,00,000.
- Re            cord a payment promise and pause reminders until the promised date (or grace period expires).
- Classify inbound emails and extract invoice references, intent, and promised dates.
- Log and surface risk scores with plain-language explanations.

## What the Agent May Not Do Automatically

- Any escalation beyond the customer tier (Sales, Controller, CEO, Owner) — all require human sign-off.
- Any action when a dispute has been detected — automation halts until a human resolves it.
- Approve payment plans — these require human negotiation and financial authority.
- Send any message when email classification confidence is below 70%.
- Send any customer-facing message when the outstanding amount exceeds ₹3,00,000.

## Safety Boundary

The boundary is: *automated communication is safe when the system knows exactly who it is talking to, about exactly which invoice, with no unresolved contradictions from the customer.* The moment any ambiguity enters — disputed amount, unclear invoice reference, unusual reply, or executive-tier contact — a human must be in the loop. The LLM is never trusted to make that call; deterministic rules in the policy engine do.

## Pre-Conditions Before Emailing a Customer

1. Invoice ID and customer mapping verified against known data (no hallucinated references).
2. Payment ledger reconciled as of simulation date — no pending payment just received.
3. No active dispute flag on the invoice or customer account.
4. No contradictory inbound reply received in the last 72 hours.
5. Policy mode for this escalation stage is `auto_send` (not `human_signoff`).
6. If an email was classified, LLM confidence ≥ 70%; otherwise rule-based classification used.
7. Message passed template validation — no legal or threatening language.

## AI Usage

- The LLM (`google/diffusiongemma-26b-a4b-it` via NVIDIA NIM, OpenAI-compatible endpoint) is used exclusively to classify inbound customer emails into structured intents (dispute, promise-to-pay, payment-sent, etc.) and extract invoice references and promised dates.

- A rule-based keyword classifier is always available as fallback; deterministic logic validates all LLM output with Pydantic before it affects any business decision.
- The LLM never touches escalation logic, risk scoring, reminder timing, or recipient selection — those are pure Python driven by `policy.yaml`.

## One AI Override

The LLM classified an email referencing "INV-NONEXISTENT" as a confirmed promise-to-pay with 82% confidence. The system rejected the invoice reference because it did not exist in the known invoice set at that simulation date, reduced confidence to 55%, and routed the case to human review — rather than pausing collection on a different real invoice. The deterministic invoice-validation step in `email_agent.py` is the explicit override.
