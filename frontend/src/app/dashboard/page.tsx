"use client";

import { useEffect, useState } from "react";
import { api, ApiInvoice, ApiAction, ApiRiskItem } from "@/lib/api";
import { KpiCard } from "@/components/shared/kpi-card";
import { PageHeader } from "@/components/shared/page-header";
import {
  StatusBadge,
  RiskBadge,
  DeliveryModeBadge,
} from "@/components/shared/badges";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import {
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Clock,
  IndianRupee,
  Activity,
} from "lucide-react";

function formatINR(n: number) {
  return "₹" + n.toLocaleString("en-IN");
}

const COLORS = ["#10b981", "#f59e0b", "#ef4444", "#3b82f6"];

export default function DashboardPage() {
  const [invoices, setInvoices] = useState<ApiInvoice[]>([]);
  const [actions, setActions] = useState<ApiAction[]>([]);
  const [risk, setRisk] = useState<ApiRiskItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.invoices(), api.replay(1000), api.risk()])
      .then(([inv, rep, rsk]) => {
        setInvoices(inv.invoices);
        setActions(rep.actions);
        setRisk(rsk);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading)
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        Loading dashboard…
      </div>
    );

  // KPIs
  const totalOutstanding = invoices
    .filter((i) => i.status !== "paid")
    .reduce((s, i) => s + i.amount_outstanding, 0);
  const overdueCount = invoices.filter((i) => i.status === "overdue").length;
  const paidCount = invoices.filter((i) => i.status === "paid").length;
  const highRisk = risk.filter(
    (r) => r.risk_level === "HIGH" || r.risk_level === "CRITICAL",
  ).length;

  // Donut data
  const statusCounts = [
    { name: "Paid", value: invoices.filter((i) => i.status === "paid").length },
    { name: "Open", value: invoices.filter((i) => i.status === "open").length },
    {
      name: "Overdue",
      value: invoices.filter((i) => i.status === "overdue").length,
    },
    {
      name: "Partial",
      value: invoices.filter((i) => i.status === "partial").length,
    },
  ];

  // Area chart: actions per month
  const monthlyMap: Record<string, number> = {};
  actions.forEach((a) => {
    const m = a.date.slice(0, 7);
    monthlyMap[m] = (monthlyMap[m] || 0) + 1;
  });
  const chartData = Object.entries(monthlyMap)
    .sort()
    .map(([month, count]) => ({ month, actions: count }));

  // Recent 8 actions
  const recent = [...actions]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 8);

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader title="Dashboard" description="Live collections overview." />

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Total Outstanding"
          value={formatINR(totalOutstanding)}
          icon={IndianRupee}
          trend="up"
          trendValue=""
        />
        <KpiCard
          title="Overdue Invoices"
          value={overdueCount.toString()}
          icon={AlertTriangle}
          trend="up"
          trendValue=""
          className="border-amber-200 dark:border-amber-900"
        />
        <KpiCard
          title="Paid Invoices"
          value={paidCount.toString()}
          icon={CheckCircle}
          trend="neutral"
          trendValue=""
        />
        <KpiCard
          title="High Risk"
          value={highRisk.toString()}
          icon={Activity}
          trend={highRisk > 0 ? "up" : "neutral"}
          trendValue=""
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-card border border-border rounded-lg p-5">
          <h2 className="text-sm font-semibold mb-4">
            Agent Actions per Month
          </h2>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Area
                type="monotone"
                dataKey="actions"
                stroke="#3b82f6"
                fill="url(#grad)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-card border border-border rounded-lg p-5">
          <h2 className="text-sm font-semibold mb-4">Invoice Status</h2>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={statusCounts}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={80}
                dataKey="value"
              >
                {statusCounts.map((_, i) => (
                  <Cell key={i} fill={COLORS[i]} />
                ))}
              </Pie>
              <Legend />
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Recent actions */}
      <div className="bg-card border border-border rounded-lg">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="text-sm font-semibold">Recent Agent Actions</h2>
        </div>
        <div className="divide-y divide-border">
          {recent.map((a, i) => (
            <div
              key={i}
              className="px-5 py-3 flex items-center justify-between gap-4"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <span className="font-mono text-xs text-muted-foreground">
                    {a.invoice_id}
                  </span>
                  <span className="text-foreground truncate">
                    {a.customer_name}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {a.date} · {a.recipient_tier} · {a.action.replace(/_/g, " ")}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <RiskBadge risk={a.risk_level as any} />
                <DeliveryModeBadge mode={a.delivery_mode as any} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
