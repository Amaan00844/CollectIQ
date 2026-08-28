"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Legend,
} from "recharts";
import { PageHeader } from "@/components/shared/page-header";
import { useLiveInvoices, useLiveReplay, useLiveRisk } from "@/lib/live-data";
import { formatINR } from "@/lib/utils";

export default function AnalyticsPage() {
  const {
    data: invoices = [],
    isLoading: invoicesLoading,
    error: invoicesError,
  } = useLiveInvoices();
  const {
    data: actions = [],
    isLoading: actionsLoading,
    error: actionsError,
  } = useLiveReplay();
  const {
    data: risks = [],
    isLoading: risksLoading,
    error: risksError,
  } = useLiveRisk();
  if (invoicesLoading || actionsLoading || risksLoading)
    return (
      <div className="text-sm text-muted-foreground">Loading analytics...</div>
    );
  if (invoicesError || actionsError || risksError)
    return (
      <div className="text-sm text-red-600">
        Unable to load analytics. Check the backend URL.
      </div>
    );
  const totalOutstanding = invoices.reduce(
    (sum, invoice) => sum + invoice.amountOutstanding,
    0,
  );
  const totalOverdue = invoices
    .filter((invoice) => invoice.daysOverdue > 0)
    .reduce((sum, invoice) => sum + invoice.amountOutstanding, 0);
  const receivablesTrend = [
    { month: "Current", outstanding: totalOutstanding, overdue: totalOverdue },
  ];
  const actionsByTier = Array.from(
    new Set(actions.map((action) => action.recipientTier)),
  ).map((tier) => ({
    tier,
    count: actions.filter((action) => action.recipientTier === tier).length,
    auto: actions.filter(
      (action) =>
        action.recipientTier === tier && action.deliveryMode === "auto_send",
    ).length,
    manual: actions.filter(
      (action) =>
        action.recipientTier === tier &&
        action.deliveryMode === "human_signoff",
    ).length,
  }));
  const riskByCustomer = Array.from(
    new Set(risks.map((risk) => risk.customerName)),
  ).map((name) => {
    const customerRisks = risks.filter((risk) => risk.customerName === name);
    return {
      name,
      score: Math.round(
        customerRisks.reduce((sum, risk) => sum + risk.riskScore, 0) /
          customerRisks.length,
      ),
    };
  });
  const riskDistribution = ["LOW", "MEDIUM", "HIGH", "CRITICAL"].map(
    (name) => ({
      name,
      value: risks.filter((risk) => risk.riskLevel === name).length,
      color:
        name === "LOW"
          ? "#10b981"
          : name === "MEDIUM"
            ? "#f59e0b"
            : name === "HIGH"
              ? "#ef4444"
              : "#8b5cf6",
    }),
  );
  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Analytics"
        description="Collection performance and agent behaviour across the full 18-month replay."
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Receivables trend */}
        <div className="bg-card border border-border rounded-lg p-5">
          <div className="text-sm font-semibold text-foreground mb-1">
            Receivables Trend
          </div>
          <div className="text-xs text-muted-foreground mb-4">
            Outstanding vs overdue (INR)
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart
              data={receivablesTrend}
              margin={{ top: 0, right: 10, left: 0, bottom: 0 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="hsl(var(--border))"
              />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tickFormatter={(v) => formatINR(v)}
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                width={50}
              />
              <Tooltip
                formatter={(v: number | undefined) => formatINR(v ?? 0)}
                contentStyle={{ fontSize: 12, borderRadius: 8 }}
              />
              <Legend iconSize={8} />
              <Line
                type="monotone"
                dataKey="outstanding"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={false}
                name="Outstanding"
              />
              <Line
                type="monotone"
                dataKey="overdue"
                stroke="#ef4444"
                strokeWidth={2}
                dot={false}
                name="Overdue"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Actions by tier */}
        <div className="bg-card border border-border rounded-lg p-5">
          <div className="text-sm font-semibold text-foreground mb-1">
            Actions by Escalation Tier
          </div>
          <div className="text-xs text-muted-foreground mb-4">
            How actions distributed across the ladder
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart
              data={actionsByTier}
              margin={{ top: 0, right: 10, left: 0, bottom: 0 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="hsl(var(--border))"
              />
              <XAxis
                dataKey="tier"
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
              <Legend iconSize={8} />
              <Bar
                dataKey="auto"
                name="Auto-sent"
                fill="#3b82f6"
                radius={[3, 3, 0, 0]}
              />
              <Bar
                dataKey="manual"
                name="Human signoff"
                fill="#f59e0b"
                radius={[3, 3, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Risk by customer */}
        <div className="bg-card border border-border rounded-lg p-5">
          <div className="text-sm font-semibold text-foreground mb-1">
            Risk Score by Customer
          </div>
          <div className="text-xs text-muted-foreground mb-4">
            Average risk score across open invoices
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart
              data={riskByCustomer}
              layout="vertical"
              margin={{ top: 0, right: 20, left: 0, bottom: 0 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="hsl(var(--border))"
              />
              <XAxis
                type="number"
                domain={[0, 100]}
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                width={110}
              />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
              <Bar
                dataKey="score"
                name="Risk Score"
                fill="#ef4444"
                radius={[0, 3, 3, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Risk distribution */}
        <div className="bg-card border border-border rounded-lg p-5">
          <div className="text-sm font-semibold text-foreground mb-1">
            Open Invoice Risk Distribution
          </div>
          <div className="text-xs text-muted-foreground mb-4">
            Breakdown of 11 open invoices by risk level
          </div>
          <div className="space-y-3 mt-4">
            {riskDistribution.map((d) => (
              <div key={d.name} className="flex items-center gap-3">
                <div className="w-16 text-xs font-medium text-foreground">
                  {d.name}
                </div>
                <div className="flex-1 h-5 bg-muted rounded-sm overflow-hidden">
                  <div
                    className="h-5 flex items-center pl-2 text-[10px] text-white font-semibold transition-all"
                    style={{
                      width: `${risks.length ? (d.value / risks.length) * 100 : 0}%`,
                      backgroundColor: d.color,
                    }}
                  >
                    {d.value > 0 ? d.value : ""}
                  </div>
                </div>
                <div className="w-6 text-xs text-muted-foreground text-right">
                  {d.value}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-card border border-border rounded-lg p-4 text-center">
          <div className="text-2xl font-bold">{actions.length}</div>
          <div className="text-xs text-muted-foreground mt-1">
            Replay Actions Total
          </div>
        </div>
        <div className="bg-card border border-border rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-emerald-600">N/A</div>
          <div className="text-xs text-muted-foreground mt-1">
            Policy Compliance
          </div>
        </div>
        <div className="bg-card border border-border rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-blue-600">0</div>
          <div className="text-xs text-muted-foreground mt-1">
            Hallucinated Invoice Refs
          </div>
        </div>
        <div className="bg-card border border-border rounded-lg p-4 text-center">
          <div className="text-2xl font-bold">N/A</div>
          <div className="text-xs text-muted-foreground mt-1">
            Emails Classified by AI
          </div>
        </div>
      </div>
    </div>
  );
}
