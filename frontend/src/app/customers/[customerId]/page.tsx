'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { api, ApiCustomerDetail } from '@/lib/api'
import { PageHeader } from '@/components/shared/page-header'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

function formatINR(n: number) { return '₹' + n.toLocaleString('en-IN') }

export default function CustomerDetailPage() {
  const { customerId } = useParams<{ customerId: string }>()
  const [cust, setCust] = useState<ApiCustomerDetail | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (customerId) api.customer(customerId).then(setCust).finally(() => setLoading(false))
  }, [customerId])

  if (loading) return <div className="py-16 text-center text-muted-foreground">Loading…</div>
  if (!cust) return <div className="py-16 text-center text-muted-foreground">Customer not found.</div>

  return (
    <div className="max-w-3xl space-y-5 animate-fade-in">
      <Link href="/customers" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="w-4 h-4" /> Back to customers
      </Link>
      <PageHeader title={cust.customer_name} description={`${cust.industry} · ${cust.contact_email}`} />

      <div className="bg-card border border-border rounded-lg p-5 grid grid-cols-2 sm:grid-cols-3 gap-4">
        <div><div className="text-xs text-muted-foreground">Credit Limit</div><div className="font-medium">{formatINR(cust.credit_limit)}</div></div>
        <div><div className="text-xs text-muted-foreground">Payment Terms</div><div className="font-medium">{cust.payment_terms_days} days</div></div>
        <div><div className="text-xs text-muted-foreground">Total Outstanding</div><div className={`font-medium ${cust.total_outstanding > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>{cust.total_outstanding > 0 ? formatINR(cust.total_outstanding) : 'Clear'}</div></div>
        <div><div className="text-xs text-muted-foreground">Open Invoices</div><div className="font-medium">{cust.open_invoices}</div></div>
        <div><div className="text-xs text-muted-foreground">Total Invoices</div><div className="font-medium">{cust.invoice_count}</div></div>
      </div>

      {/* Invoices */}
      <div className="bg-card border border-border rounded-lg">
        <div className="px-5 py-3 border-b border-border text-sm font-semibold">Invoices ({cust.invoice_count})</div>
        <div className="divide-y divide-border">
          {cust.invoices.map(inv => (
            <div key={inv.invoice_id} className="px-5 py-3 flex justify-between items-center">
              <div>
                <Link href={`/invoices/${inv.invoice_id}`} className="font-mono text-sm text-primary hover:underline">{inv.invoice_id}</Link>
                <div className="text-xs text-muted-foreground mt-0.5">{inv.description}</div>
              </div>
              <div className="text-right">
                <div className="text-sm font-medium">{formatINR(inv.amount)}</div>
                <div className="text-xs text-muted-foreground">Due {inv.due_date}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Emails */}
      {cust.emails.length > 0 && (
        <div className="bg-card border border-border rounded-lg">
          <div className="px-5 py-3 border-b border-border text-sm font-semibold">Inbound Emails ({cust.emails.length})</div>
          <div className="divide-y divide-border">
            {cust.emails.map(e => (
              <div key={e.email_id} className="px-5 py-3 flex justify-between items-center text-sm">
                <span className="truncate">{e.subject}</span>
                <span className="text-muted-foreground shrink-0 ml-4">{e.received_date}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
