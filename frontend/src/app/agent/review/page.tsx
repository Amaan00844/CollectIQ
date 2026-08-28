'use client'

import { useEffect, useState } from 'react'
import { api, ApiAction } from '@/lib/api'
import { PageHeader } from '@/components/shared/page-header'
import { Button } from '@/components/ui/button'
import { Check, X } from 'lucide-react'
import Link from 'next/link'

function formatINR(n: number) { return '₹' + n.toLocaleString('en-IN') }

export default function HumanReviewPage() {
  const [actions, setActions] = useState<ApiAction[]>([])
  const [loading, setLoading] = useState(true)
  const [approved, setApproved] = useState<Set<number>>(new Set())
  const [rejected, setRejected] = useState<Set<number>>(new Set())

  useEffect(() => {
    api.replay(1000)
      .then(r => setActions(r.actions.filter(a => a.delivery_mode === 'human_signoff').sort((a, b) => b.date.localeCompare(a.date))))
      .finally(() => setLoading(false))
  }, [])

  const pending = actions.filter((_, i) => !approved.has(i) && !rejected.has(i))

  return (
    <div className="space-y-4 animate-fade-in">
      <PageHeader
        title="Human Review Queue"
        description={`${pending.length} simulated actions awaiting sign-off`}
      />

      <div className="p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-900 rounded-lg text-xs text-blue-700 dark:text-blue-300">
        Simulation only: Approve and Reject update this replay view. No customer email is sent.
      </div>

      {loading ? (
        <div className="py-16 text-center text-muted-foreground">Loading queue…</div>
      ) : pending.length === 0 ? (
        <div className="py-16 text-center text-muted-foreground">All items reviewed.</div>
      ) : (
        <div className="space-y-3">
          {pending.slice(0, 30).map((a, i) => (
            <div key={i} className="bg-card border border-border rounded-lg p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 text-sm">
                    <Link href={`/invoices/${a.invoice_id}`} className="font-mono text-primary hover:underline">{a.invoice_id}</Link>
                    <span className="font-medium">{a.customer_name}</span>
                    <span className="text-muted-foreground">·</span>
                    <span className="text-muted-foreground capitalize">{a.recipient_tier}</span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">{a.date} · {formatINR(a.amount_outstanding)} outstanding · {a.days_overdue}d overdue</div>
                  <div className="text-xs text-muted-foreground mt-1 italic">{a.reason}</div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button size="sm" variant="outline" className="border-emerald-400 text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400" onClick={() => setApproved(s => new Set([...s, i]))}>
                    <Check className="w-3.5 h-3.5 mr-1" /> Approve Simulation
                  </Button>
                  <Button size="sm" variant="outline" className="border-red-400 text-red-600 hover:bg-red-50 dark:text-red-400" onClick={() => setRejected(s => new Set([...s, i]))}>
                    <X className="w-3.5 h-3.5 mr-1" /> Reject Simulation
                  </Button>
                </div>
              </div>
              <pre className="mt-3 whitespace-pre-wrap bg-muted/40 border border-border rounded p-3 text-xs leading-relaxed max-h-36 overflow-auto">{a.message_body}</pre>
            </div>
          ))}
          {pending.length > 30 && <div className="text-center text-xs text-muted-foreground">Showing 30 of {pending.length}</div>}
        </div>
      )}
    </div>
  )
}
