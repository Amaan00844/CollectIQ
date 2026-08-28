'use client'

import { useEffect, useState } from 'react'
import { api, ApiCustomer } from '@/lib/api'
import { PageHeader } from '@/components/shared/page-header'
import Link from 'next/link'
import { Building2 } from 'lucide-react'

function formatINR(n: number) { return '₹' + n.toLocaleString('en-IN') }

export default function CustomersPage() {
  const [customers, setCustomers] = useState<ApiCustomer[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.customers().then(r => setCustomers(r.customers)).finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="py-16 text-center text-muted-foreground">Loading customers…</div>

  return (
    <div className="space-y-4 animate-fade-in">
      <PageHeader title="Customers" description={`${customers.length} customers, sorted by outstanding balance`} />

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {customers.map(c => (
          <Link key={c.customer_id} href={`/customers/${c.customer_id}`} className="bg-card border border-border rounded-lg p-5 hover:border-primary/50 hover:shadow-sm transition-all block">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <Building2 className="w-4 h-4 text-primary" />
              </div>
              <div className="min-w-0">
                <div className="font-semibold text-sm truncate">{c.customer_name}</div>
                <div className="text-xs text-muted-foreground">{c.industry} · {c.payment_terms_days}d terms</div>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div>
                <div className="text-xs text-muted-foreground">Outstanding</div>
                <div className={`text-sm font-semibold ${c.total_outstanding > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                  {c.total_outstanding > 0 ? formatINR(c.total_outstanding) : 'Clear'}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Open Invoices</div>
                <div className="text-sm font-semibold">{c.open_invoices}</div>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-border text-xs text-muted-foreground truncate">{c.contact_email}</div>
          </Link>
        ))}
      </div>
    </div>
  )
}
