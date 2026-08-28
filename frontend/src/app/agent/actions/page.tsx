"use client";

import { useState } from "react";
import { PageHeader } from "@/components/shared/page-header";
import {
  DeliveryModeBadge,
  RiskBadge,
  ActionStatusBadge,
} from "@/components/shared/badges";
import { useLiveReplay } from "@/lib/live-data";
import { formatINRFull, formatDate } from "@/lib/utils";
import Link from "next/link";
import { ChevronDown, ChevronUp } from "lucide-react";

export default function AgentActionsPage() {
  const { data: allActions = [], isLoading, error } = useLiveReplay();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [modeFilter, setModeFilter] = useState<
    "all" | "auto_send" | "human_signoff"
  >("all");

  if (isLoading)
    return (
      <div className="text-sm text-muted-foreground">
        Loading agent actions...
      </div>
    );
  if (error)
    return (
      <div className="text-sm text-red-600">
        Unable to load agent actions. Check the backend URL.
      </div>
    );
  const actions = allActions.filter(
    (a) => modeFilter === "all" || a.deliveryMode === modeFilter,
  );

  return (
    <div className="space-y-4 animate-fade-in">
      <PageHeader
        title="AI Agent Actions"
        description="All collection decisions made by the agent — auto-sent and human-reviewed."
      />

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-card border border-border rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-foreground">
            {allActions.length}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            Total Actions (18 months)
          </div>
        </div>
        <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-900 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-blue-700 dark:text-blue-400">
            {allActions.filter((a) => a.deliveryMode === "auto_send").length}
          </div>
          <div className="text-xs text-blue-600 dark:text-blue-500 mt-1">
            Auto-Sent
          </div>
        </div>
        <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-900 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-amber-700 dark:text-amber-400">
            {allActions.filter((a) => a.status === "awaiting_review").length}
          </div>
          <div className="text-xs text-amber-600 dark:text-amber-500 mt-1">
            Pending Human Review
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        {(["all", "auto_send", "human_signoff"] as const).map((m) => (
          <button
            key={m}
            onClick={() => setModeFilter(m)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${modeFilter === m ? "bg-primary text-primary-foreground border-primary" : "bg-card text-muted-foreground border-border hover:bg-muted"}`}
          >
            {m === "all"
              ? "All Actions"
              : m === "auto_send"
                ? "Auto-Sent"
                : "Human Review"}
          </button>
        ))}
      </div>

      {/* Actions list */}
      <div className="bg-card border border-border rounded-lg divide-y divide-border">
        {actions.map((action) => (
          <div key={action.id}>
            <div
              className="flex items-center gap-4 px-5 py-3.5 cursor-pointer hover:bg-muted/20 transition-colors"
              onClick={() =>
                setExpanded(expanded === action.id ? null : action.id)
              }
            >
              <DeliveryModeBadge mode={action.deliveryMode} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-foreground capitalize">
                    {action.action.replace(/_/g, " ")}
                  </span>
                  <span className="text-xs text-muted-foreground">→</span>
                  <span className="text-xs text-muted-foreground capitalize">
                    {action.recipientTier}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  <Link
                    href={`/invoices/${action.invoiceId}`}
                    className="font-mono hover:text-primary"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {action.invoiceId}
                  </Link>
                  {" · "}
                  {action.customerName}
                  {" · "}
                  {formatDate(action.date)}
                  {" · "}
                  {formatINRFull(action.amountOutstanding)}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <RiskBadge
                  risk={
                    action.riskLevel as "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"
                  }
                />
                <ActionStatusBadge status={action.status} />
                {expanded === action.id ? (
                  <ChevronUp className="w-4 h-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                )}
              </div>
            </div>
            {expanded === action.id && (
              <div className="px-5 pb-4 space-y-3 bg-muted/10">
                <div className="text-xs text-muted-foreground pt-2">
                  <strong className="text-foreground">Policy rule:</strong>{" "}
                  {action.policyRule} ·{" "}
                  <strong className="text-foreground">Risk score:</strong>{" "}
                  {action.riskScore}/100 ·{" "}
                  <strong className="text-foreground">Days overdue:</strong>{" "}
                  {action.daysOverdue}
                </div>
                <div className="text-xs text-muted-foreground italic">
                  {action.reason}
                </div>
                {action.messageBody && (
                  <div className="text-xs bg-card border border-border rounded-md p-3 font-mono whitespace-pre-wrap leading-relaxed text-foreground">
                    {action.messageBody}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
