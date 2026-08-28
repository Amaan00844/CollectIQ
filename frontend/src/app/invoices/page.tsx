'use client'

import { useState } from 'react'
import Link from 'next/link'
import { PageHeader } from '@/components/shared/page-header'
import { StatusBadge, RiskBadge } from '@/components/shared/badges'
import { mockInvoices } from '@/lib/mock-data'
import { formatINRFull, formatDate } from '@/lib/utils'
import { Search, ArrowUpDown, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

const statusOptions = ['all', 'open', 'overdue', 'disputed', 'promise_to_pay', 'paid']
const riskOptions = ['all', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW']

export default function InvoicesPage() {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [riskFilter, setRiskFilter] = useState('all')
  const [sort, setSort] = useState<{ key: string; dir: 'asc' | 'desc' }>({ key: 'daysOverdue', dir: 'desc' })

  let invoices = mockInvoices.filter(inv => {
    const q = search.toLowerCase()
    const matchSearch = !q || inv.id.toLowerCase().includes(q) || inv.customerName.toLowerCase().includes(q)
    const matchStatus = statusFilter === 'all' || inv.status === statusFilter
    const matchRisk = riskFilter === 'all' || inv.risk === riskFilter
    return matchSearch && matchStatus && matchRisk
  })

  invoices = [...invoices].sort((a, b) => {
    let av: number | string = 0, bv: number | string = 0
    if (sort.key === 'daysOverdue') { av = a.daysOverdue; bv = b.daysOverdue }
    if (sort.key === 'amount') { av = a.amount; bv = b.amount }
    if (sort.key === 'riskScore') { av = a.riskScore; bv = b.riskScore }
    if (sort.key === 'dueDate') { av = a.dueDate; bv = b.dueDate }
    return sort.dir === 'desc' ? (bv > av ? 1 : -1) : (av > bv ? 1 : -1)
  })

  const toggleSort = (key: string) => {
    setSort(prev => prev.key === key ? { key, dir: prev.dir === 'desc' ? 'asc' : 'desc' } : { key, dir: 'desc' })
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <PageHeader title="All Invoices" description="Track and manage all invoice collection activities." />

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search invoices or customers..." className="pl-9 h-9 text-sm" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-1 flex-wrap">
          {statusOptions.map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-colors capitalize ${statusFilter === s ? 'bg-primary text-primary-foreground border-primary' : 'bg-card text-muted-foreground border-border hover:bg-muted'}`}>
              {s === 'all' ? 'All Status' : s.replace(/_/g, ' ')}
            </button>
          ))}
        </div>
        <div className="flex gap-1">
          {riskOptions.map(r => (
            <button key={r} onClick={() => setRiskFilter(r)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-colors capitalize ${riskFilter === r ? 'bg-primary text-primary-foreground border-primary' : 'bg-card text-muted-foreground border-border hover:bg-muted'}`}>
              {r === 'all' ? 'All Risk' : r}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Invoice</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Customer</th>
                <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide cursor-pointer" onClick={() => toggleSort('amount')}>
                  <div className="flex items-center gap-1">Amount <ArrowUpDown className="w-3 h-3" /></div>
                </th>
                <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide cursor-pointer" onClick={() => toggleSort('dueDate')}>
                  <div className="flex items-center gap-1">Due Date <ArrowUpDown className="w-3 h-3" /></div>
                </th>
                <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</th>
                <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide cursor-pointer" onClick={() => toggleSort('daysOverdue')}>
                  <div className="flex items-center gap-1">Days OD <ArrowUpDown className="w-3 h-3" /></div>
                </th>
                <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide cursor-pointer" onClick={() => toggleSort('riskScore')}>
                  <div className="flex items-center gap-1">Risk <ArrowUpDown className="w-3 h-3" /></div>
                </th>
                <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {invoices.map(inv => (
                <tr key={inv.id} className="hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-primary font-semibold">{inv.id}</td>
                  <td className="px-4 py-3 text-sm text-foreground font-medium">{inv.customerName}</td>
                  <td className="px-4 py-3 text-sm font-semibold text-foreground">{formatINRFull(inv.amountOutstanding)}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{formatDate(inv.dueDate)}</td>
                  <td className="px-4 py-3"><StatusBadge status={inv.status} /></td>
                  <td className="px-4 py-3 text-sm font-medium">
                    {inv.daysOverdue > 0 ? <span className="text-red-600 dark:text-red-400">{inv.daysOverdue}d</span> : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-4 py-3"><RiskBadge risk={inv.risk} /></td>
                  <td className="px-4 py-3">
                    <Link href={`/invoices/${inv.id}`} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors">
                      View <ChevronRight className="w-3 h-3" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 border-t border-border text-xs text-muted-foreground">
          Showing {invoices.length} of {mockInvoices.length} invoices
        </div>
      </div>
    </div>
  )
}
