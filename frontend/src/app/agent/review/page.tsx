"use client";

import { useState } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { RiskBadge } from "@/components/shared/badges";
import { useLiveReplay } from "@/lib/live-data";
import { formatINRFull, formatDate } from "@/lib/utils";
import Link from "next/link";
import { Check, X, ShieldCheck } from "lucide-react";

export default function HumanReviewPage() {
  const { data: actions = [], isLoading, error } = useLiveReplay();
  const [decisions, setDecisions] = useState<
    Record<string, "approved" | "rejected">
  >({});
  if (isLoading)
    return (
      <div className="text-sm text-muted-foreground">
        Loading review queue...
      </div>
    );
  if (error)
    return (
      <div className="text-sm text-red-600">
        Unable to load review queue. Check the backend URL.
      </div>
    );
  const pending = actions.filter((a) => a.status === "awaiting_review");

  const decide = (id: string, decision: "approved" | "rejected") => {
    setDecisions((prev) => ({ ...prev, [id]: decision }));
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <PageHeader
        title="Human Review Queue"
        description="Actions requiring your approval before the agent proceeds. All escalations and high-value messages are held here."
      />

      <div className="flex items-center gap-3 p-3 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg text-sm text-amber-800 dark:text-amber-300">
        <ShieldCheck className="w-4 h-4 shrink-0" />
        <span>
          <strong>{pending.length - Object.keys(decisions).length}</strong>{" "}
          action
          {pending.length - Object.keys(decisions).length !== 1 ? "s" : ""}{" "}
          pending your review. Agent is paused for these invoices until you
          approve or reject.
        </span>
      </div>

      <div className="space-y-3">
        {pending.map((action) => {
          const decided = decisions[action.id];
          return (
            <div
              key={action.id}
              className={`bg-card border rounded-lg overflow-hidden transition-all ${decided === "approved" ? "border-emerald-300 dark:border-emerald-800" : decided === "rejected" ? "border-red-300 dark:border-red-800 opacity-60" : "border-border"}`}
            >
              <div className="px-5 py-4">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs font-semibold text-primary">
                        {action.invoiceId}
                      </span>
                      <span className="text-sm font-medium text-foreground">
                        {action.customerName}
                      </span>
                      <RiskBadge
                        risk={
                          action.riskLevel as
                            | "LOW"
                            | "MEDIUM"
                            | "HIGH"
                            | "CRITICAL"
                        }
                      />
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formatDate(action.date)} ·{" "}
                      {formatINRFull(action.amountOutstanding)} outstanding ·{" "}
                      {action.daysOverdue} days overdue
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      <span className="font-medium text-foreground">
                        Recipient:
                      </span>{" "}
                      {action.recipientTier} ·{" "}
                      <span className="font-medium text-foreground">Rule:</span>{" "}
                      {action.policyRule}
                    </div>
                  </div>

                  {!decided ? (
                    <div className="flex gap-2 shrink-0">
                      <button
                        onClick={() => decide(action.id, "rejected")}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-400 text-xs font-medium hover:bg-red-100 dark:hover:bg-red-900 transition-colors"
                      >
                        <X className="w-3.5 h-3.5" /> Reject
                      </button>
                      <button
                        onClick={() => decide(action.id, "approved")}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 text-xs font-medium hover:bg-emerald-100 dark:hover:bg-emerald-900 transition-colors"
                      >
                        <Check className="w-3.5 h-3.5" /> Approve
                      </button>
                    </div>
                  ) : (
                    <div
                      className={`px-3 py-1.5 rounded-md text-xs font-semibold border ${decided === "approved" ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-400" : "bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-400"}`}
                    >
                      {decided === "approved" ? "✓ Approved" : "✗ Rejected"}
                    </div>
                  )}
                </div>

                <div className="mt-3 text-xs italic text-muted-foreground">
                  {action.reason}
                </div>

                {action.messageBody && (
                  <div className="mt-3 text-xs font-mono whitespace-pre-wrap bg-muted/40 rounded-md p-3 text-foreground leading-relaxed">
                    {action.messageBody}
                  </div>
                )}

                <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
                  <Link
                    href={`/invoices/${action.invoiceId}`}
                    className="hover:text-primary transition-colors"
                  >
                    View invoice →
                  </Link>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {pending.length === 0 && (
        <div className="py-16 text-center space-y-2">
          <ShieldCheck className="w-8 h-8 text-emerald-500 mx-auto" />
          <div className="text-sm font-medium text-foreground">
            Queue is clear
          </div>
          <div className="text-xs text-muted-foreground">
            No actions pending review
          </div>
        </div>
      )}
    </div>
  );
}
