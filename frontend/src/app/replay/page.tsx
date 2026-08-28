"use client";

import { useState } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { DeliveryModeBadge, RiskBadge } from "@/components/shared/badges";
import { useLiveReplay } from "@/lib/live-data";
import { formatINRFull, formatDate } from "@/lib/utils";
import Link from "next/link";
import { History, ChevronDown, ChevronUp, Info } from "lucide-react";

export default function ReplayPage() {
  const { data: events = [], isLoading, error } = useLiveReplay();
  const [expanded, setExpanded] = useState<string | null>(null);
  if (isLoading)
    return (
      <div className="text-sm text-muted-foreground">Loading replay log...</div>
    );
  if (error)
    return (
      <div className="text-sm text-red-600">
        Unable to load replay log. Check the backend URL.
      </div>
    );

  return (
    <div className="space-y-4 animate-fade-in">
      <PageHeader
        title="Replay Log"
        description="Historical dry-run of every agent decision across 18 months of data, made with only information available at that moment."
      />

      <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-900 rounded-lg text-xs text-blue-700 dark:text-blue-300">
        <Info className="w-3.5 h-3.5 shrink-0" />
        <span>
          The replay engine simulated <strong>358 actions</strong> across{" "}
          <strong>18 months</strong> using strict point-in-time filtering — no
          future data was visible at each decision point. Below is a sample of
          key events.
        </span>
      </div>

      {/* Timeline */}
      <div className="relative">
        <div className="absolute left-6 top-0 bottom-0 w-px bg-border" />
        <div className="space-y-3">
          {events.map((evt) => (
            <div key={evt.id} className="relative flex gap-4 pl-14">
              {/* Timeline dot */}
              <div
                className={`absolute left-4 w-4 h-4 rounded-full border-2 border-background flex items-center justify-center shrink-0 ${evt.deliveryMode === "auto_send" ? "bg-blue-500" : "bg-amber-500"}`}
                style={{ top: "14px" }}
              />

              <div className="flex-1 bg-card border border-border rounded-lg overflow-hidden">
                <div
                  className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/20 transition-colors"
                  onClick={() =>
                    setExpanded(expanded === evt.id ? null : evt.id)
                  }
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs font-semibold text-primary">
                        {evt.invoiceId}
                      </span>
                      <span className="text-sm text-foreground">
                        {evt.customerName}
                      </span>
                      <DeliveryModeBadge mode={evt.deliveryMode} />
                      <RiskBadge
                        risk={
                          evt.riskLevel as
                            | "LOW"
                            | "MEDIUM"
                            | "HIGH"
                            | "CRITICAL"
                        }
                      />
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {formatDate(evt.date)} ·{" "}
                      <span className="capitalize">
                        {evt.action.replace(/_/g, " ")}
                      </span>{" "}
                      → {evt.recipientTier} ·{" "}
                      {formatINRFull(evt.amountOutstanding)}
                    </div>
                  </div>
                  {expanded === evt.id ? (
                    <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                  )}
                </div>

                {expanded === evt.id && (
                  <div className="px-4 pb-4 space-y-3 border-t border-border bg-muted/10">
                    <div className="text-xs text-muted-foreground pt-3 italic">
                      {evt.reason}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      <strong className="text-foreground">Policy rule:</strong>{" "}
                      {evt.policyRule} ·{" "}
                      <strong className="text-foreground">Risk score:</strong>{" "}
                      {evt.riskScore}/100 ·{" "}
                      <strong className="text-foreground">Days overdue:</strong>{" "}
                      {evt.daysOverdue}
                    </div>
                    {evt.messageBody && (
                      <div className="text-xs font-mono whitespace-pre-wrap bg-card border border-border rounded-md p-3 text-foreground leading-relaxed">
                        {evt.messageBody}
                      </div>
                    )}
                    <Link
                      href={`/invoices/${evt.invoiceId}`}
                      className="text-xs text-primary hover:underline"
                    >
                      View invoice →
                    </Link>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="text-center text-xs text-muted-foreground py-4 flex items-center justify-center gap-2">
        <History className="w-3.5 h-3.5" />
        Showing {events.length} replay actions from the backend
      </div>
    </div>
  );
}
