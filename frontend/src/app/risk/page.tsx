'use client'

import { useEffect, useState } from 'react'
import { api, ApiRiskItem } from '@/lib/api'
import { PageHeader } from '@/components/shared/page-header'
import { RiskBadge } from '@/components/shared/badges'

function formatINR(n: number) { return '₹' + n.toLocaleString('en-IN') }

export default function RiskPage() {
  const [items, setItems] = useState<ApiRiskItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.risk().then(setItems).finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="py-16 text-center text-muted-foreground">Loading risk report…</div>

  const sorted = [...items].sort((a, b) => b.risk_score - a.risk_score)

  return (
    <div className="space-y-4 animate-fade-in">
      <PageHeader title="Risk Intelligence" description="Explainable risk scores for all open invoices." />

      <div className="space-y-3">
        {sorted.map(item => (
          <div key={item.invoice_id} className="bg-card border border-border rounded-lg p-5">
            <div className="flex items-start justify-between gap-4 mb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm text-primary font-semibold">{item.invoice_id}</span>
                  <span className="font-medium text-sm">{item.customer_name}</span>
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {item.amount_outstanding ? formatINR(item.amount_outstanding) : ''}{item.days_overdue ? ` · ${item.days_overdue}d overdue` : ''}
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="text-2xl font-bold text-foreground">{Math.round(item.risk_score)}</span>
                <RiskBadge level={item.risk_level as any} />
              </div>
            </div>

            {/* Score bar */}
            <div className="h-2 bg-muted rounded-full overflow-hidden mb-3">
              <div
                className={`h-full rounded-full ${item.risk_level === 'CRITICAL' ? 'bg-red-600' : item.risk_level === 'HIGH' ? 'bg-orange-500' : item.risk_level === 'MEDIUM' ? 'bg-amber-500' : 'bg-emerald-500'}`}
                style={{ width: `${item.risk_score}%` }}
              />
            </div>

            {/* Reasons */}
            <ul className="space-y-1">
              {item.reasons.map((r, i) => (
                <li key={i} className="text-xs text-muted-foreground flex gap-2">
                  <span className="text-amber-500 shrink-0">•</span>{r}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  )
}
