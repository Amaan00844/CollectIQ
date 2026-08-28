"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { api } from "@/lib/api";
import { GitBranch, Zap, ShieldCheck, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

const TIERS = [
  { key: "reminders", label: "Automated Reminders" },
  { key: "escalation", label: "Human-Signoff Escalation" },
];

export default function PolicyPage() {
  const [policy, setPolicy] = useState<any>(null);
  useEffect(() => {
    api.policy().then(setPolicy);
  }, []);
  if (!policy)
    return (
      <div className="py-16 text-center text-muted-foreground">
        Loading policy...
      </div>
    );

  const allStages = [
    ...Object.entries(policy.reminders).map(([k, v]: [string, any]) => ({
      name: k,
      ...v,
      group: "reminder",
    })),
    ...Object.entries(policy.escalation).map(([k, v]: [string, any]) => ({
      name: k,
      ...v,
      group: "escalation",
    })),
  ].sort((a, b) => a.overdue_days - b.overdue_days);

  return (
    <div className="max-w-3xl space-y-6 animate-fade-in">
      <PageHeader
        title="Escalation Policy"
        description="All thresholds and timing live in config/policy.yaml — no code change required to adjust."
      />

      {/* Safety notice */}
      <div className="p-4 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-900 rounded-lg text-sm text-blue-800 dark:text-blue-300">
        <strong>Policy invariant:</strong> The agent may only send
        customer-facing messages automatically for the first three reminder
        stages. All escalation stages beyond the customer tier require human
        sign-off before any message is sent.
      </div>

      {/* Escalation ladder */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center gap-2">
          <GitBranch className="w-4 h-4 text-foreground" />
          <h2 className="text-sm font-semibold text-foreground">
            Escalation Ladder
          </h2>
        </div>

        <div className="divide-y divide-border">
          {allStages.map((stage, i) => (
            <div key={stage.name} className="flex items-center gap-4 px-5 py-4">
              <div
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0",
                  stage.mode === "auto_send"
                    ? "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400"
                    : "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400",
                )}
              >
                {i + 1}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold text-foreground capitalize">
                    {stage.name.replace(/_/g, " ")}
                  </span>
                  {stage.mode === "auto_send" ? (
                    <span className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 font-medium">
                      <Zap className="w-3 h-3" />
                      Auto-Send
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 font-medium">
                      <ShieldCheck className="w-3 h-3" />
                      Human Sign-off
                    </span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  Triggers at{" "}
                  <strong>
                    {stage.overdue_days} day
                    {stage.overdue_days !== 1 ? "s" : ""}
                  </strong>{" "}
                  overdue → sent to{" "}
                  <strong className="capitalize">{stage.recipient_tier}</strong>
                  {stage.frequency_days && (
                    <>
                      {" "}
                      · repeat every{" "}
                      <strong>{stage.frequency_days} days</strong>
                    </>
                  )}
                  {!stage.frequency_days && stage.group === "escalation" && (
                    <> · one-shot</>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1 text-muted-foreground shrink-0">
                <Clock className="w-3.5 h-3.5" />
                <span className="text-xs">Day {stage.overdue_days}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Human review triggers */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-foreground" />
          <h2 className="text-sm font-semibold text-foreground">
            Automatic Human Review Triggers
          </h2>
          <span className="text-xs text-muted-foreground ml-auto">
            Agent pauses and holds for sign-off
          </span>
        </div>
        <div className="px-5 py-4 flex flex-wrap gap-2">
          {policy.human_review.triggers.map((t: string) => (
            <span
              key={t}
              className="px-2.5 py-1 rounded-full bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800 text-xs font-medium capitalize"
            >
              {t.replace(/_/g, " ")}
            </span>
          ))}
        </div>
        <div className="px-5 pb-4 text-xs text-muted-foreground space-y-1">
          <div>
            • High-amount threshold:{" "}
            <strong className="text-foreground">
              {policy.human_review.high_amount_threshold.toLocaleString(
                "en-US",
              )}
            </strong>{" "}
            — overrides auto_send for all tiers
          </div>
          <div>
            • LLM confidence below{" "}
            <strong className="text-foreground">
              {(policy.human_review.low_confidence_threshold * 100).toFixed(0)}%
            </strong>{" "}
            — email classification is ambiguous, routes to review
          </div>
        </div>
      </div>
    </div>
  );
}
