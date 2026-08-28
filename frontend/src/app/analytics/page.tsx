"use client";

import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api, ApiAction, ApiInvoice } from "@/lib/api";
import { PageHeader } from "@/components/shared/page-header";

export default function AnalyticsPage() {
  const [invoices, setInvoices] = useState<ApiInvoice[]>([]);
  const [actions, setActions] = useState<ApiAction[]>([]);
  useEffect(() => {
    Promise.all([api.invoices(), api.replay(5000)]).then(
      ([invoiceData, replayData]) => {
        setInvoices(invoiceData.invoices);
        setActions(replayData.actions);
      },
    );
  }, []);
  const customerTotals: Record<string, number> = {};
  invoices.forEach((invoice) => {
    if (invoice.amount_outstanding > 0)
      customerTotals[invoice.customer_name] =
        (customerTotals[invoice.customer_name] || 0) +
        invoice.amount_outstanding;
  });
  const chartData = Object.entries(customerTotals)
    .map(([name, value]) => ({ name: name.split(" ")[0], value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);
  const auto = actions.filter(
    (action) => action.delivery_mode === "auto_send",
  ).length;
  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Analytics"
        description="Live metrics from the collections pack and replay log."
      />
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-lg border border-border bg-card p-4 text-center">
          <div className="text-2xl font-bold">{actions.length}</div>
          <div className="text-xs text-muted-foreground">Replay actions</div>
        </div>
        <div className="rounded-lg border border-border bg-card p-4 text-center">
          <div className="text-2xl font-bold text-emerald-600">{auto}</div>
          <div className="text-xs text-muted-foreground">
            Auto-send eligible
          </div>
        </div>
        <div className="rounded-lg border border-border bg-card p-4 text-center">
          <div className="text-2xl font-bold text-amber-600">
            {actions.length - auto}
          </div>
          <div className="text-xs text-muted-foreground">Human sign-off</div>
        </div>
      </div>
      <section className="rounded-lg border border-border bg-card p-5">
        <h2 className="mb-4 text-sm font-semibold">Outstanding by customer</h2>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={chartData} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" />
            <YAxis type="category" dataKey="name" width={100} />
            <Tooltip />
            <Bar dataKey="value" fill="#2563eb" />
          </BarChart>
        </ResponsiveContainer>
      </section>
    </div>
  );
}
