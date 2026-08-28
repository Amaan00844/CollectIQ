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
import {
  mockReceivablesTrend,
  mockRiskDistribution,
  mockActions,
} from "@/lib/mock-data";
import { formatINR } from "@/lib/utils";

const actionsByTier = [
  { tier: "Customer", count: 1, auto: 1, manual: 0 },
  { tier: "Sales", count: 4, auto: 0, manual: 4 },
  { tier: "Controller", count: 2, auto: 0, manual: 2 },
  { tier: "CEO", count: 1, auto: 0, manual: 1 },
  { tier: "Internal", count: 2, auto: 0, manual: 2 },
];

const riskByCustomer = [
  { name: "Sunrise Exports", score: 89 },
  { name: "Metro Infra", score: 71 },
  { name: "Acme Construction", score: 65 },
  { name: "Precision Eng", score: 58 },
  { name: "Bharat Mfg", score: 42 },
];

export default function AnalyticsPage() {
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
              data={mockReceivablesTrend}
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
            {mockRiskDistribution.map((d) => (
              <div key={d.name} className="flex items-center gap-3">
                <div className="w-16 text-xs font-medium text-foreground">
                  {d.name}
                </div>
                <div className="flex-1 h-5 bg-muted rounded-sm overflow-hidden">
                  <div
                    className="h-5 flex items-center pl-2 text-[10px] text-white font-semibold transition-all"
                    style={{
                      width: `${(d.value / 11) * 100}%`,
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
          <div className="text-2xl font-bold">358</div>
          <div className="text-xs text-muted-foreground mt-1">
            Replay Actions Total
          </div>
        </div>
        <div className="bg-card border border-border rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-emerald-600">100%</div>
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
          <div className="text-2xl font-bold">30</div>
          <div className="text-xs text-muted-foreground mt-1">
            Emails Classified by AI
          </div>
        </div>
      </div>
    </div>
  );
}
