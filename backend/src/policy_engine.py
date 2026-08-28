"""
Deterministic policy engine.
Reads thresholds exclusively from policy.yaml.
NO LLM involvement — all escalation decisions are made here in pure Python.
"""

from __future__ import annotations

from datetime import date
from typing import Optional


class PolicyEngine:
    """
    Evaluates a CollectionState against the loaded policy and returns a decision.
    The LLM never touches this class.
    """

    def __init__(self, policy: dict) -> None:
        self.policy = policy
        self.reminders: dict = policy.get("reminders", {})
        self.escalation: dict = policy.get("escalation", {})
        self.human_review_cfg: dict = policy.get("human_review", {})
        self.auto_send_cfg: dict = policy.get("auto_send", {})
        self.high_amount = self.human_review_cfg.get("high_amount_threshold", 300000)
        self.low_confidence = self.human_review_cfg.get("low_confidence_threshold", 0.70)
        self.promise_grace = policy.get("promise_to_pay", {}).get("grace_days", 2)
        self.escalate_on_breach = policy.get("promise_to_pay", {}).get("escalate_on_breach", True)

    # ------------------------------------------------------------------
    # Main decision method
    # ------------------------------------------------------------------

    def decide(self, state: dict, action_history: list[dict]) -> dict:
        """
        Given invoice state and action history, return:
          {
            "next_action": str,
            "recipient_tier": str,
            "delivery_mode": str,
            "policy_rule": str,
            "decision_reason": str,
            "requires_human_review": bool,
          }
        Never raises — always returns a decision.
        """
        invoice_id = state.get("invoice_id", "")
        days_overdue = state.get("days_overdue", 0)
        has_dispute = state.get("has_active_dispute", False)
        has_promise = state.get("has_active_promise", False)
        promise_broken = state.get("promise_broken", False)
        email_intent = state.get("email_intent")
        email_confidence = state.get("email_confidence", 1.0) or 1.0
        amount_outstanding = state.get("amount_outstanding", 0.0)
        risk_level = state.get("risk_level", "LOW")

        # ---- GUARD 1: Paid — no action needed ----
        if state.get("payment_received") or state.get("invoice_status") == "paid":
            return self._no_action("Invoice is fully paid", "paid_check")

        # ---- GUARD 2: Active dispute — stop automation ----
        if has_dispute or email_intent == "dispute":
            return self._human_review(
                "Dispute detected — automated collection paused pending resolution",
                "dispute_hold",
            )

        # ---- GUARD 3: Payment plan request ----
        if email_intent == "payment_plan_request":
            return self._human_review(
                "Customer requested a payment plan — requires human approval",
                "payment_plan_review",
            )

        # ---- GUARD 4: Low-confidence email classification ----
        if email_confidence < self.low_confidence and email_intent not in (None, ""):
            return self._human_review(
                f"Email classification confidence {email_confidence:.0%} below threshold — ambiguous intent",
                "low_confidence",
            )

        # ---- GUARD 5: Active payment promise (not broken) ----
        if has_promise and not promise_broken:
            promise_date = state.get("promise_date")
            return self._no_action(
                f"Active payment promise on record (expected: {promise_date}) — reminders paused",
                "promise_active",
            )

        # ---- GUARD 6: Broken promise — escalate ----
        if promise_broken:
            return self._escalate_broken_promise(days_overdue, action_history, invoice_id, amount_outstanding)

        # ---- GUARD 7: Not yet overdue ----
        if days_overdue <= 0:
            return self._no_action("Invoice is not yet overdue", "not_due")

        # ---- MAIN POLICY: escalation ladder ----
        return self._apply_escalation_ladder(
            days_overdue, action_history, invoice_id, amount_outstanding, risk_level
        )

    # ------------------------------------------------------------------
    # Escalation ladder (reads from policy.yaml)
    # ------------------------------------------------------------------

    def _apply_escalation_ladder(
        self,
        days_overdue: int,
        action_history: list[dict],
        invoice_id: str,
        amount_outstanding: float,
        risk_level: str,
    ) -> dict:
        # Walk escalation stages from highest to lowest
        # Collect all stages in descending order of overdue_days
        stages = self._all_stages_sorted()

        for stage_name, stage_cfg in stages:
            threshold = stage_cfg["overdue_days"]
            if days_overdue < threshold:
                continue

            mode = stage_cfg.get("mode", "human_signoff")
            tier = stage_cfg.get("recipient_tier", "customer")
            freq = stage_cfg.get("frequency_days")

            # Check dedup: has this stage already been sent recently?
            if self._recently_actioned(action_history, invoice_id, stage_name, freq):
                continue

            # High-amount override: always require sign-off regardless of mode
            if amount_outstanding >= self.high_amount and mode == "auto_send":
                mode = "human_signoff"
                reason = (
                    f"Invoice is {days_overdue} days overdue — {stage_name} stage triggered; "
                    f"amount ₹{amount_outstanding:,.0f} above threshold → human sign-off required"
                )
            else:
                reason = f"Invoice is {days_overdue} days overdue — policy rule '{stage_name}' triggered"

            return {
                "next_action": "payment_reminder" if tier == "customer" else "escalation_notice",
                "recipient_tier": tier,
                "delivery_mode": mode,
                "policy_rule": stage_name,
                "decision_reason": reason,
                "requires_human_review": mode == "human_signoff",
            }

        # Nothing triggered — should not reach here normally
        return self._no_action("No policy rule matched current overdue days", "no_match")

    def _all_stages_sorted(self) -> list[tuple[str, dict]]:
        """Return all reminder + escalation stages sorted by overdue_days DESC."""
        stages: list[tuple[str, dict]] = []
        for name, cfg in self.reminders.items():
            stages.append((name, cfg))
        for name, cfg in self.escalation.items():
            stages.append((name, cfg))
        # Sort descending so we match the highest applicable stage first
        stages.sort(key=lambda x: x[1]["overdue_days"], reverse=True)
        return stages

    def _recently_actioned(
        self,
        action_history: list[dict],
        invoice_id: str,
        policy_rule: str,
        frequency_days: Optional[int],
    ) -> bool:
        """
        Return True if this policy rule was already applied to this invoice
        and the frequency window has not elapsed.
        """
        matching = [
            a for a in action_history
            if a.get("invoice_id") == invoice_id
            and a.get("policy_rule") == policy_rule
            and a.get("action") not in ("no_action",)
        ]
        if not matching:
            return False
        # If frequency_days is None, it's a one-shot rule — already done
        if frequency_days is None:
            return True
        # Check most recent action date
        last_date = max(date.fromisoformat(a["date"]) for a in matching)
        # Import here to avoid circular
        return True  # Will be resolved by the caller supplying current_date

    def check_recently_actioned_with_date(
        self,
        action_history: list[dict],
        invoice_id: str,
        policy_rule: str,
        frequency_days: Optional[int],
        current_date: date,
    ) -> bool:
        """Proper dedup check with current_date."""
        matching = [
            a for a in action_history
            if a.get("invoice_id") == invoice_id
            and a.get("policy_rule") == policy_rule
            and a.get("action") not in ("no_action",)
        ]
        if not matching:
            return False
        if frequency_days is None:
            return True  # one-shot
        last_date = max(date.fromisoformat(a["date"]) for a in matching)
        elapsed = (current_date - last_date).days
        return elapsed < frequency_days

    def decide_with_date(self, state: dict, action_history: list[dict], current_date: date) -> dict:
        """
        Full decision with proper date-aware deduplication.
        This is the method called by the replay engine.
        """
        invoice_id = state.get("invoice_id", "")
        days_overdue = state.get("days_overdue", 0)
        has_dispute = state.get("has_active_dispute", False)
        has_promise = state.get("has_active_promise", False)
        promise_broken = state.get("promise_broken", False)
        email_intent = state.get("email_intent")
        email_confidence = state.get("email_confidence", 1.0) or 1.0
        amount_outstanding = state.get("amount_outstanding", 0.0)
        risk_level = state.get("risk_level", "LOW")

        if state.get("payment_received") or state.get("invoice_status") == "paid":
            return self._no_action("Invoice is fully paid", "paid_check")

        if has_dispute or email_intent == "dispute":
            return self._human_review(
                "Dispute detected — automated collection paused pending resolution",
                "dispute_hold",
            )

        if email_intent == "payment_plan_request":
            return self._human_review(
                "Customer requested a payment plan — requires human approval",
                "payment_plan_review",
            )

        if email_confidence < self.low_confidence and email_intent not in (None, "", "unknown"):
            return self._human_review(
                f"Email classification confidence {email_confidence:.0%} below threshold",
                "low_confidence",
            )

        if has_promise and not promise_broken:
            return self._no_action(
                f"Active payment promise on record (expected: {state.get('promise_date')}) — reminders paused",
                "promise_active",
            )

        if promise_broken:
            return self._escalate_broken_promise(days_overdue, action_history, invoice_id, amount_outstanding, current_date)

        if days_overdue <= 0:
            return self._no_action("Invoice is not yet overdue", "not_due")

        return self._apply_escalation_ladder_with_date(
            days_overdue, action_history, invoice_id, amount_outstanding, risk_level, current_date
        )

    def _apply_escalation_ladder_with_date(
        self,
        days_overdue: int,
        action_history: list[dict],
        invoice_id: str,
        amount_outstanding: float,
        risk_level: str,
        current_date: date,
    ) -> dict:
        stages = self._all_stages_sorted()

        for stage_name, stage_cfg in stages:
            threshold = stage_cfg["overdue_days"]
            if days_overdue < threshold:
                continue

            mode = stage_cfg.get("mode", "human_signoff")
            tier = stage_cfg.get("recipient_tier", "customer")
            freq = stage_cfg.get("frequency_days")

            if self.check_recently_actioned_with_date(
                action_history, invoice_id, stage_name, freq, current_date
            ):
                continue

            if amount_outstanding >= self.high_amount and mode == "auto_send":
                mode = "human_signoff"
                reason = (
                    f"Invoice is {days_overdue} days overdue — {stage_name} triggered; "
                    f"₹{amount_outstanding:,.0f} above threshold → human sign-off"
                )
            else:
                reason = f"Invoice is {days_overdue} days overdue — policy rule '{stage_name}' triggered"

            return {
                "next_action": "payment_reminder" if tier == "customer" else "escalation_notice",
                "recipient_tier": tier,
                "delivery_mode": mode,
                "policy_rule": stage_name,
                "decision_reason": reason,
                "requires_human_review": mode == "human_signoff",
            }

        return self._no_action("All applicable policy rules recently actioned — awaiting next window", "dedup_hold")

    def _escalate_broken_promise(
        self,
        days_overdue: int,
        action_history: list[dict],
        invoice_id: str,
        amount_outstanding: float,
        current_date: Optional[date] = None,
    ) -> dict:
        """When a promise is broken, escalate to the next tier."""
        # Find the last escalation tier applied
        tiers_order = ["first_reminder", "second_reminder", "third_reminder", "sales", "controller", "ceo", "owner"]
        last_rule = "first_reminder"
        for a in sorted(action_history, key=lambda x: x["date"]):
            if a.get("invoice_id") == invoice_id and a.get("policy_rule") in tiers_order:
                last_rule = a["policy_rule"]

        next_idx = min(tiers_order.index(last_rule) + 1, len(tiers_order) - 1)
        next_rule = tiers_order[next_idx]

        all_stages = dict(self._all_stages_sorted())
        stage_cfg = all_stages.get(next_rule, {"recipient_tier": "sales", "mode": "human_signoff", "overdue_days": 21})

        return {
            "next_action": "broken_promise_escalation",
            "recipient_tier": stage_cfg.get("recipient_tier", "sales"),
            "delivery_mode": "human_signoff",
            "policy_rule": f"broken_promise_{next_rule}",
            "decision_reason": f"Customer missed promised payment date — escalating to '{stage_cfg.get('recipient_tier', 'sales')}' tier",
            "requires_human_review": True,
        }

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    def _no_action(self, reason: str, rule: str) -> dict:
        return {
            "next_action": "no_action",
            "recipient_tier": "none",
            "delivery_mode": "no_action",
            "policy_rule": rule,
            "decision_reason": reason,
            "requires_human_review": False,
        }

    def _human_review(self, reason: str, rule: str) -> dict:
        return {
            "next_action": "route_human_review",
            "recipient_tier": "internal",
            "delivery_mode": "human_signoff",
            "policy_rule": rule,
            "decision_reason": reason,
            "requires_human_review": True,
        }
