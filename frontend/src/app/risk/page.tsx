"use client";

import { PageHeader } from "@/components/shared/page-header";
import { RiskBadge } from "@/components/shared/badges";
import { useLiveRisk } from "@/lib/live-data";
import { formatINRFull, formatDate } from "@/lib/utils";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";

function RiskBar({ score, level }: { score: number; level: string }) {
  const color =
    level === "CRITICAL"
      ? "bg-purple-500"
      : level === "HIGH"
        ? "bg-red-500"
        : level === "MEDIUM"
          ? "bg-amber-500"
          : "bg-emerald-500";
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-1.5 bg-muted rounded-full">
        <div
          className={`h-1.5 rounded-full ${color}`}
          style={{ width: `${score}%` }}
        />
      </div>
      <span className="text-xs font-semibold text-foreground w-8 text-right">
        {score}
      </span>
    </div>
  );
}

export default function RiskPage() {
  const { data: riskReport = [], isLoading, error } = useLiveRisk();
  if (isLoading)
    return (
      <div className="text-sm text-muted-foreground">Loading risk data...</div>
    );
  if (error)
    return (
      <div className="text-sm text-red-600">
        Unable to load risk data. Check the backend URL.
      </div>
    );
  const totalExposure = riskReport.reduce((s, r) => s + r.amountOutstanding, 0);
  const critical = riskReport.filter((r) => r.riskLevel === "CRITICAL");
  const high = riskReport.filter((r) => r.riskLevel === "HIGH");

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Risk Intelligence"
        description="Explainable risk scores for all open invoices. Every score has a plain-language reason — no black-box ML."
      />

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-card border border-border rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-foreground">
            {formatINRFull(totalExposure)}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            Total Open Exposure
          </div>
        </div>
        <div className="bg-purple-50 dark:bg-purple-950 border border-purple-200 dark:border-purple-900 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-purple-700 dark:text-purple-400">
            {critical.length}
          </div>
          <div className="text-xs text-purple-600 dark:text-purple-500 mt-1">
            Critical Risk
          </div>
        </div>
        <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-900 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-red-700 dark:text-red-400">
            {high.length}
          </div>
          <div className="text-xs text-red-600 dark:text-red-500 mt-1">
            High Risk
          </div>
        </div>
      </div>

      {/* Risk cards */}
      <div className="space-y-3">
        {riskReport.map((r) => (
          <div
            key={r.invoiceId}
            className="bg-card border border-border rounded-lg p-5"
          >
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Link
                    href={`/invoices/${r.invoiceId}`}
                    className="font-mono text-sm font-bold text-primary hover:underline"
                  >
                    {r.invoiceId}
                  </Link>
                  <RiskBadge risk={r.riskLevel} />
                </div>
                <div className="text-sm text-foreground font-medium">
                  {r.customerName}
                </div>
                <div className="text-xs text-muted-foreground">
                  {formatINRFull(r.amountOutstanding)} outstanding ·{" "}
                  {r.daysOverdue} days overdue · Due {formatDate(r.dueDate)}
                </div>
              </div>
              <div className="w-40">
                <div className="text-xs text-muted-foreground mb-1 text-right">
                  Risk Score
                </div>
                <RiskBar score={r.riskScore} level={r.riskLevel} />
              </div>
            </div>

            <div className="mt-4 space-y-1.5">
              {r.reasons.map((reason, i) => (
                <div
                  key={i}
                  className="flex items-start gap-2 text-xs text-foreground"
                >
                  <AlertTriangle
                    className={`w-3 h-3 mt-0.5 shrink-0 ${r.riskLevel === "CRITICAL" ? "text-purple-500" : r.riskLevel === "HIGH" ? "text-red-500" : "text-amber-500"}`}
                  />
                  {reason}
                </div>
              ))}
            </div>

            <div className="mt-4 pt-4 border-t border-border grid grid-cols-3 md:grid-cols-6 gap-3">
              {Object.entries(r.features).map(([key, val]) => (
                <div key={key} className="text-center">
                  <div className="text-[10px] text-muted-foreground capitalize leading-tight">
                    {key.replace(/_/g, " ")}
                  </div>
                  <div className="text-sm font-semibold text-foreground mt-0.5">
                    {val}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
