'use client'

import { useEffect, useState } from 'react'
import { api, ApiAction } from '@/lib/api'
import { PageHeader } from '@/components/shared/page-header'
import { DeliveryModeBadge } from '@/components/shared/badges'
import Link from 'next/link'

export default function ReplayPage() {
  const [actions, setActions] = useState<ApiAction[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.replay(1000).then(r => setActions(r.actions)).finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="py-16 text-center text-muted-foreground">Loading replay…</div>

  // Group by month
  const byMonth: Record<string, ApiAction[]> = {}
  actions.forEach(a => {
    const m = a.date.slice(0, 7)
    if (!byMonth[m]) byMonth[m] = []
    byMonth[m].push(a)
  })

  return (
    <div className="space-y-4 animate-fade-in">
      <PageHeader title="Replay Timeline" description={`${actions.length} simulated actions across 18 months — no emails were sent`} />

      <div className="space-y-6">
        {Object.entries(byMonth).sort().reverse().map(([month, acts]) => (
          <div key={month}>
            <div className="flex items-center gap-3 mb-3">
              <div className="text-sm font-semibold text-foreground">{month}</div>
              <div className="flex-1 h-px bg-border" />
              <div className="text-xs text-muted-foreground">{acts.length} actions</div>
            </div>
            <div className="space-y-2">
              {acts.map((a, i) => (
                <div key={i} className="bg-card border border-border rounded-lg px-4 py-3 flex items-center gap-4">
                  <span className="text-xs text-muted-foreground w-20 shrink-0">{a.date}</span>
                  <Link href={`/invoices/${a.invoice_id}`} className="font-mono text-xs text-primary hover:underline w-20 shrink-0">{a.invoice_id}</Link>
                  <span className="text-sm flex-1 truncate">{a.customer_name}</span>
                  <span className="text-xs text-muted-foreground hidden sm:block capitalize">{a.recipient_tier}</span>
                  <DeliveryModeBadge mode={a.delivery_mode as any} />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
