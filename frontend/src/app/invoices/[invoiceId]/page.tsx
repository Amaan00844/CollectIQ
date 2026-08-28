'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { api, ApiInvoiceDetail } from '@/lib/api'
import { PageHeader } from '@/components/shared/page-header'
import { StatusBadge, DeliveryModeBadge } from '@/components/shared/badges'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

function formatINR(n: number) { return '₹' + n.toLocaleString('en-IN') }

export default function InvoiceDetailPage() {
  const { invoiceId } = useParams<{ invoiceId: string }>()
  const [inv, setInv] = useState<ApiInvoiceDetail | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (invoiceId) api.invoice(invoiceId).then(setInv).finally(() => setLoading(false))
  }, [invoiceId])

  if (loading) return <div className="py-16 text-center text-muted-foreground">Loading…</div>
  if (!inv) return <div className="py-16 text-center text-muted-foreground">Invoice not found.</div>

  const pct = Math.round((inv.total_paid / inv.amount) * 100)

  return (
    <div className="max-w-3xl space-y-5 animate-fade-in">
      <Link href="/invoices" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="w-4 h-4" /> Back to invoices
      </Link>
      <PageHeader title={inv.invoice_id} description={inv.description} />

      {/* Summary */}
      <div className="bg-card border border-border rounded-lg p-5 grid grid-cols-2 sm:grid-cols-3 gap-4">
        <div><div className="text-xs text-muted-foreground">Customer</div><div className="font-medium">{inv.customer_name}</div></div>
        <div><div className="text-xs text-muted-foreground">Amount</div><div className="font-medium">{formatINR(inv.amount)}</div></div>
        <div><div className="text-xs text-muted-foreground">Status</div><div className="mt-0.5"><StatusBadge status={inv.status as any} /></div></div>
        <div><div className="text-xs text-muted-foreground">Due Date</div><div className="font-medium">{inv.due_date}</div></div>
        <div><div className="text-xs text-muted-foreground">Days Overdue</div><div className={`font-medium ${inv.days_overdue > 0 ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'}`}>{inv.days_overdue > 0 ? `${inv.days_overdue} days` : '—'}</div></div>
        <div><div className="text-xs text-muted-foreground">Outstanding</div><div className="font-medium">{formatINR(inv.amount_outstanding)}</div></div>
      </div>

      {/* Payment progress */}
      <div className="bg-card border border-border rounded-lg p-5">
        <div className="flex justify-between text-sm mb-2">
          <span className="font-medium">Payment Progress</span>
          <span className="text-muted-foreground">{formatINR(inv.total_paid)} of {formatINR(inv.amount)}</span>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
        </div>
        <div className="text-xs text-muted-foreground mt-1">{pct}% paid</div>
      </div>

      {/* Payments */}
      {inv.payments.length > 0 && (
        <div className="bg-card border border-border rounded-lg">
          <div className="px-5 py-3 border-b border-border text-sm font-semibold">Payments Received</div>
          <div className="divide-y divide-border">
            {inv.payments.map((p, i) => (
              <div key={i} className="px-5 py-3 flex justify-between text-sm">
                <div><span className="font-medium">{formatINR(p.amount)}</span><span className="text-muted-foreground ml-2">via {p.method}</span></div>
                <div className="text-muted-foreground">{p.date} · {p.reference}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Emails */}
      {inv.emails.length > 0 && (
        <div className="bg-card border border-border rounded-lg">
          <div className="px-5 py-3 border-b border-border text-sm font-semibold">Customer Emails</div>
          <div className="divide-y divide-border">
            {inv.emails.map(e => (
              <div key={e.email_id} className="px-5 py-3">
                <div className="flex justify-between text-sm">
                  <span className="font-medium">{e.subject}</span>
                  <span className="text-muted-foreground">{e.received_date}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{e.body}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Agent actions */}
      {inv.actions.length > 0 && (
        <div className="bg-card border border-border rounded-lg">
          <div className="px-5 py-3 border-b border-border text-sm font-semibold">Agent Actions ({inv.actions.length})</div>
          <div className="divide-y divide-border">
            {inv.actions.slice(0, 15).map((a, i) => (
              <div key={i} className="px-5 py-3 flex items-center justify-between gap-4">
                <div>
                  <div className="text-sm font-medium">{a.action.replace(/_/g, ' ')} → {a.recipient_tier}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{a.date} · {a.reason.slice(0, 80)}</div>
                </div>
                <DeliveryModeBadge mode={a.delivery_mode as any} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
