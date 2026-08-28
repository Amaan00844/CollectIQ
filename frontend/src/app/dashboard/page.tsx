"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { KpiCard } from "@/components/shared/kpi-card";
import { PageHeader } from "@/components/shared/page-header";
import { DeliveryModeBadge, RiskBadge } from "@/components/shared/badges";
import {
  mockActions,
  mockReceivablesTrend,
  mockRiskDistribution,
} from "@/lib/mock-data";
import { formatINR, formatDate } from "@/lib/utils";
import { Zap, ShieldCheck, FileText } from "lucide-react";
import Link from "next/link";

const COLORS = {
  LOW: "#10b981",
  MEDIUM: "#f59e0b",
  HIGH: "#ef4444",
  CRITICAL: "#8b5cf6",
};

export default function DashboardPage() {
  const pendingReview = mockActions.filter(
    (a) => a.status === "awaiting_review",
  ).length;
  const totalOutstanding = 48_20_000;
  const totalOverdue = 18_48_500;

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Collections Overview"
        description="Monitor outstanding receivables, AI agent actions, and collection risk."
      />

      {/* KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Total Outstanding"
          value={totalOutstanding}
          subLabel="vs last period"
          trend="up"
          change="+8.4%"
        />
        <KpiCard
          label="Overdue"
          value={totalOverdue}
          subLabel="11 invoices need attention"
          trend="up"
          change="+12%"
          valueClassName="text-red-600 dark:text-red-400"
        />
        <KpiCard
          label="High Risk"
          value="8"
          subLabel="Invoices likely to go late"
          trend="up"
          change="+3"
          valueClassName="text-amber-600 dark:text-amber-400"
        />
        <KpiCard
          label="Agent Actions"
          value="358"
          subLabel={`${pendingReview} awaiting approval`}
          trend="neutral"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Trend chart */}
        <div className="lg:col-span-2 bg-card border border-border rounded-lg p-5">
          <div className="mb-4">
            <div className="text-sm font-semibold text-foreground">
              Outstanding Receivables Trend
            </div>
            <div className="text-xs text-muted-foreground">
              7-month view — outstanding vs overdue
            </div>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart
              data={mockReceivablesTrend}
              margin={{ top: 0, right: 0, left: 0, bottom: 0 }}
            >
              <defs>
                <linearGradient id="outstanding" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="overdue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                </linearGradient>
              </defs>
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
                width={55}
              />
              <Tooltip
                formatter={(v: number | undefined) => [formatINR(v ?? 0)]}
                contentStyle={{ fontSize: 12, borderRadius: 8 }}
              />
              <Area
                type="monotone"
                dataKey="outstanding"
                stroke="#3b82f6"
                strokeWidth={2}
                fill="url(#outstanding)"
                name="Outstanding"
              />
              <Area
                type="monotone"
                dataKey="overdue"
                stroke="#ef4444"
                strokeWidth={2}
                fill="url(#overdue)"
                name="Overdue"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Risk distribution */}
        <div className="bg-card border border-border rounded-lg p-5">
          <div className="mb-4">
            <div className="text-sm font-semibold text-foreground">
              Risk Distribution
            </div>
            <div className="text-xs text-muted-foreground">
              Open invoices by risk level
            </div>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={mockRiskDistribution}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={80}
                paddingAngle={3}
                dataKey="value"
              >
                {mockRiskDistribution.map((entry) => (
                  <Cell
                    key={entry.name}
                    fill={COLORS[entry.name as keyof typeof COLORS]}
                  />
                ))}
              </Pie>
              <Tooltip />
              <Legend iconSize={10} iconType="circle" />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Recent AI Actions */}
      <div className="bg-card border border-border rounded-lg">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div>
            <div className="text-sm font-semibold text-foreground">
              Recent AI Agent Actions
            </div>
            <div className="text-xs text-muted-foreground">
              Latest decisions made by the collections agent
            </div>
          </div>
          <Link
            href="/agent/actions"
            className="text-xs text-primary hover:underline font-medium"
          >
            View all
          </Link>
        </div>
        <div className="divide-y divide-border">
          {mockActions.slice(0, 5).map((action) => (
            <div
              key={action.id}
              className="flex items-center gap-4 px-5 py-3.5"
            >
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                  action.deliveryMode === "auto_send"
                    ? "bg-blue-100 dark:bg-blue-950"
                    : "bg-amber-100 dark:bg-amber-950"
                }`}
              >
                {action.deliveryMode === "auto_send" ? (
                  <Zap className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                ) : (
                  <ShieldCheck className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-foreground capitalize">
                    {action.action.replace(/_/g, " ")}
                  </span>
                  <DeliveryModeBadge mode={action.deliveryMode} />
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  <Link
                    href={`/invoices/${action.invoiceId}`}
                    className="font-mono hover:text-primary"
                  >
                    {action.invoiceId}
                  </Link>
                  {" · "}
                  {action.customerName}
                  {" · "}
                  {formatDate(action.date)}
                </div>
              </div>
              <div className="text-xs text-muted-foreground text-right shrink-0">
                <RiskBadge
                  risk={
                    action.riskLevel as "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"
                  }
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
