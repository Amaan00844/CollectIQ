'use client'

import { useEffect, useState } from 'react'
import { api, ApiInvoice } from '@/lib/api'
import { PageHeader } from '@/components/shared/page-header'
import { StatusBadge, RiskBadge } from '@/components/shared/badges'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Search, ArrowUpDown } from 'lucide-react'
import Link from 'next/link'

function formatINR(n: number) { return '₹' + n.toLocaleString('en-IN') }

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<ApiInvoice[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [sort, setSort] = useState<'days_overdue' | 'amount' | 'due_date'>('days_overdue')

  useEffect(() => {
    api.invoices().then(r => setInvoices(r.invoices)).finally(() => setLoading(false))
  }, [])

  const filtered = invoices
    .filter(i => {
      const q = search.toLowerCase()
      const matchSearch = !q || i.invoice_id.toLowerCase().includes(q) || i.customer_name.toLowerCase().includes(q) || i.description.toLowerCase().includes(q)
      const matchStatus = statusFilter === 'all' || i.status === statusFilter
      return matchSearch && matchStatus
    })
    .sort((a, b) => {
      if (sort === 'days_overdue') return b.days_overdue - a.days_overdue
      if (sort === 'amount') return b.amount_outstanding - a.amount_outstanding
      return b.due_date.localeCompare(a.due_date)
    })

  const statuses = ['all', 'overdue', 'open', 'partial', 'paid']

  return (
    <div className="space-y-4 animate-fade-in">
      <PageHeader title="Invoices" description={`${invoices.length} total invoices`} />

      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search invoices…" className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-1">
          {statuses.map(s => (
            <Button key={s} variant={statusFilter === s ? 'default' : 'outline'} size="sm" onClick={() => setStatusFilter(s)}>
              {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
            </Button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-16 text-muted-foreground">Loading invoices…</div>
      ) : (
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Invoice</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Customer</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Amount</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground cursor-pointer" onClick={() => setSort('due_date')}>Due Date</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground cursor-pointer" onClick={() => setSort('days_overdue')}>Overdue</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Outstanding</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map(inv => (
                <tr key={inv.invoice_id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <Link href={`/invoices/${inv.invoice_id}`} className="font-mono text-primary hover:underline">{inv.invoice_id}</Link>
                  </td>
                  <td className="px-4 py-3 font-medium">{inv.customer_name}</td>
                  <td className="px-4 py-3">{formatINR(inv.amount)}</td>
                  <td className="px-4 py-3 text-muted-foreground">{inv.due_date}</td>
                  <td className="px-4 py-3">
                    {inv.days_overdue > 0 ? (
                      <span className={`font-medium ${inv.days_overdue > 30 ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400'}`}>
                        {inv.days_overdue}d
                      </span>
                    ) : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-4 py-3"><StatusBadge status={inv.status as any} /></td>
                  <td className="px-4 py-3 font-medium">{inv.amount_outstanding > 0 ? formatINR(inv.amount_outstanding) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && <div className="text-center py-12 text-muted-foreground">No invoices match your filters.</div>}
        </div>
      )}
    </div>
  )
}
