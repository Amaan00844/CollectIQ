'use client'

import { useEffect, useState } from 'react'
import { api, ApiAction, ApiInvoice } from '@/lib/api'
import { PageHeader } from '@/components/shared/page-header'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, Legend } from 'recharts'

function formatINR(n: number) { return '₹' + n.toLocaleString('en-IN') }
const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444']

export default function AnalyticsPage() {
  const [invoices, setInvoices] = useState<ApiInvoice[]>([])
  const [actions, setActions] = useState<ApiAction[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([api.invoices(), api.replay(1000)])
      .then(([inv, rep]) => { setInvoices(inv.invoices); setActions(rep.actions) })
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="py-16 text-center text-muted-foreground">Loading analytics…</div>

  // Actions per month
  const monthly: Record<string, { auto: number; human: number }> = {}
  actions.forEach(a => {
    const m = a.date.slice(0, 7)
    if (!monthly[m]) monthly[m] = { auto: 0, human: 0 }
    if (a.delivery_mode === 'auto_send') monthly[m].auto++
    else monthly[m].human++
  })
  const monthlyData = Object.entries(monthly).sort().map(([month, v]) => ({ month, ...v }))

  // Actions by tier
  const tierMap: Record<string, number> = {}
  actions.forEach(a => { tierMap[a.recipient_tier] = (tierMap[a.recipient_tier] || 0) + 1 })
  const tierData = Object.entries(tierMap).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)

  // Outstanding by customer
  const custMap: Record<string, number> = {}
  invoices.forEach(i => { if (i.amount_outstanding > 0) custMap[i.customer_name] = (custMap[i.customer_name] || 0) + i.amount_outstanding })
  const custData = Object.entries(custMap).map(([name, value]) => ({ name: name.split(' ')[0], value })).sort((a, b) => b.value - a.value).slice(0, 8)

  // Status breakdown
  const statusMap: Record<string, number> = {}
  invoices.forEach(i => { statusMap[i.status] = (statusMap[i.status] || 0) + 1 })
  const statusData = Object.entries(statusMap).map(([name, value]) => ({ name, value }))

  const totalActions = actions.length
  const autoActions = actions.filter(a => a.delivery_mode === 'auto_send').length
  const humanActions = actions.filter(a => a.delivery_mode === 'human_signoff').length

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader title="Analytics" description="18-month collections performance overview." />

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-card border border-border rounded-lg p-4 text-center">
          <div className="text-2xl font-bold">{totalActions}</div>
          <div className="text-xs text-muted-foreground">Total Actions</div>
        </div>
        <div className="bg-card border border-border rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-emerald-600">{autoActions}</div>
          <div className="text-xs text-muted-foreground">Auto-sent</div>
        </div>
        <div className="bg-card border border-border rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-amber-600">{humanActions}</div>
          <div className="text-xs text-muted-foreground">Human Sign-off</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-card border border-border rounded-lg p-5">
          <h2 className="text-sm font-semibold mb-4">Actions per Month</h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={monthlyData}>
              <XAxis dataKey="month" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="auto" stackId="a" fill="#10b981" name="Auto" />
              <Bar dataKey="human" stackId="a" fill="#f59e0b" name="Human" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-card border border-border rounded-lg p-5">
          <h2 className="text-sm font-semibold mb-4">Outstanding by Customer</h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={custData} layout="vertical">
              <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={70} />
              <Tooltip formatter={(v: number) => formatINR(v)} />
              <Bar dataKey="value" fill="#3b82f6" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-card border border-border rounded-lg p-5">
          <h2 className="text-sm font-semibold mb-4">Actions by Recipient Tier</h2>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={tierData} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                {tierData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-card border border-border rounded-lg p-5">
          <h2 className="text-sm font-semibold mb-4">Invoice Status Breakdown</h2>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={statusData} cx="50%" cy="50%" outerRadius={80} dataKey="value">
                {statusData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Legend />
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
