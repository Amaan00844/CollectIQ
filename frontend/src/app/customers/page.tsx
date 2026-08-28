"use client";

import { PageHeader } from "@/components/shared/page-header";
import { RiskBadge } from "@/components/shared/badges";
import { useLiveCustomers } from "@/lib/live-data";
import { formatINR, formatINRFull } from "@/lib/utils";
import Link from "next/link";
import { Building2, ChevronRight } from "lucide-react";

export default function CustomersPage() {
  const { data: customers = [], isLoading, error } = useLiveCustomers();
  if (isLoading)
    return (
      <div className="text-sm text-muted-foreground">Loading customers...</div>
    );
  if (error)
    return (
      <div className="text-sm text-red-600">
        Unable to load customers. Check the backend URL.
      </div>
    );
  const riskOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
  const sorted = [...customers].sort(
    (a, b) => riskOrder[a.risk] - riskOrder[b.risk],
  );

  return (
    <div className="space-y-4 animate-fade-in">
      <PageHeader
        title="Customers"
        description="All 12 customers with receivables profile and risk standing."
      />

      <div className="bg-card border border-border rounded-lg divide-y divide-border">
        {sorted.map((c) => (
          <Link
            key={c.id}
            href={`/customers/${c.id}`}
            className="flex items-center gap-4 px-5 py-4 hover:bg-muted/20 transition-colors group"
          >
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm shrink-0">
              {c.name.slice(0, 2).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-foreground">
                  {c.name}
                </span>
                <RiskBadge risk={c.risk} />
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {c.industry} · {c.invoiceCount} invoices · {c.latePaymentRate}%
                late-pay rate · avg {c.avgPaymentDelayDays}d delay
              </div>
            </div>
            <div className="text-right shrink-0 hidden md:block">
              {c.totalOutstanding > 0 ? (
                <>
                  <div className="text-sm font-bold text-foreground">
                    {formatINR(c.totalOutstanding)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    outstanding
                  </div>
                  {c.totalOverdue > 0 && (
                    <div className="text-xs text-red-600 dark:text-red-400">
                      {formatINR(c.totalOverdue)} overdue
                    </div>
                  )}
                </>
              ) : (
                <div className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                  All paid
                </div>
              )}
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors shrink-0" />
          </Link>
        ))}
      </div>
    </div>
  );
}
