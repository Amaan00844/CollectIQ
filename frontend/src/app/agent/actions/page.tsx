"use client";

import { useEffect, useState } from "react";
import { api, ApiAction } from "@/lib/api";
import { PageHeader } from "@/components/shared/page-header";
import { DeliveryModeBadge, RiskBadge } from "@/components/shared/badges";
import { Input } from "@/components/ui/input";
import { Search, ChevronDown, ChevronRight } from "lucide-react";
import Link from "next/link";

export default function AgentActionsPage() {
  const [actions, setActions] = useState<ApiAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<number | null>(null);

  useEffect(() => {
    api
      .replay(1000)
      .then((r) => setActions(r.actions))
      .finally(() => setLoading(false));
  }, []);

  const filtered = actions
    .filter((a) => {
      const q = search.toLowerCase();
      return (
        !q ||
        a.invoice_id.toLowerCase().includes(q) ||
        a.customer_name.toLowerCase().includes(q) ||
        a.action.includes(q) ||
        a.recipient_tier.includes(q)
      );
    })
    .sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="space-y-4 animate-fade-in">
      <PageHeader
        title="Agent Actions"
        description={`${actions.length} total actions logged across the 18-month replay`}
      />

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search by invoice, customer, action…"
          className="pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="py-16 text-center text-muted-foreground">
          Loading actions…
        </div>
      ) : (
        <div className="bg-card border border-border rounded-lg divide-y divide-border">
          {filtered.slice(0, 200).map((a, i) => (
            <div key={i}>
              <div
                className="px-5 py-3 flex items-center gap-4 cursor-pointer hover:bg-muted/30"
                onClick={() => setExpanded(expanded === i ? null : i)}
              >
                <span className="text-muted-foreground text-xs w-24 shrink-0">
                  {a.date}
                </span>
                <Link
                  href={`/invoices/${a.invoice_id}`}
                  className="font-mono text-xs text-primary hover:underline w-20 shrink-0"
                  onClick={(e) => e.stopPropagation()}
                >
                  {a.invoice_id}
                </Link>
                <span className="text-sm flex-1 truncate">
                  {a.customer_name}
                </span>
                <span className="text-xs text-muted-foreground hidden sm:block w-20 shrink-0">
                  {a.recipient_tier}
                </span>
                <RiskBadge risk={a.risk_level as any} />
                <DeliveryModeBadge mode={a.delivery_mode as any} />
                {expanded === i ? (
                  <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                )}
              </div>
              {expanded === i && (
                <div className="px-5 pb-4 bg-muted/20 text-xs text-muted-foreground space-y-2">
                  <div className="font-medium text-foreground">{a.reason}</div>
                  <pre className="whitespace-pre-wrap bg-card border border-border rounded p-3 text-xs leading-relaxed overflow-auto max-h-60">
                    {a.message_body}
                  </pre>
                </div>
              )}
            </div>
          ))}
          {filtered.length > 200 && (
            <div className="px-5 py-3 text-xs text-muted-foreground text-center">
              Showing 200 of {filtered.length} — use search to filter
            </div>
          )}
        </div>
      )}
    </div>
  );
}
