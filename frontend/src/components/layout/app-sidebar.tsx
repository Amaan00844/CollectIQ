'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, FileText, Receipt, AlertCircle, Bot, Zap,
  ShieldCheck, History, Building2, TriangleAlert, BarChart3,
  GitBranch, Settings, ChevronLeft, ChevronRight
} from 'lucide-react'
import { cn } from '@/lib/utils'

const nav = [
  { label: 'Overview', items: [
    { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  ]},
  { label: 'Collections', items: [
    { href: '/invoices', icon: FileText, label: 'All Invoices' },
    { href: '/invoices?status=open', icon: Receipt, label: 'Open Invoices' },
    { href: '/invoices?status=overdue', icon: AlertCircle, label: 'Overdue' },
  ]},
  { label: 'AI Agent', items: [
    { href: '/agent/actions', icon: Zap, label: 'Actions' },
    { href: '/agent/review', icon: ShieldCheck, label: 'Human Review' },
    { href: '/replay', icon: History, label: 'Replay Log' },
  ]},
  { label: 'Management', items: [
    { href: '/customers', icon: Building2, label: 'Customers' },
    { href: '/risk', icon: TriangleAlert, label: 'Risk Intelligence' },
    { href: '/analytics', icon: BarChart3, label: 'Analytics' },
  ]},
  { label: 'Configuration', items: [
    { href: '/policy', icon: GitBranch, label: 'Policy & Escalation' },
    { href: '/settings', icon: Settings, label: 'Settings' },
  ]},
]

export function AppSidebar() {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)

  return (
    <aside className={cn(
      'flex flex-col border-r border-border bg-card transition-all duration-200 ease-in-out shrink-0',
      collapsed ? 'w-16' : 'w-60'
    )}>
      {/* Brand */}
      <div className="flex items-center gap-3 px-4 h-14 border-b border-border">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary shrink-0">
          <Bot className="w-4 h-4 text-primary-foreground" />
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <div className="font-bold text-sm tracking-tight text-foreground">CollectIQ</div>
            <div className="text-[10px] text-muted-foreground leading-tight truncate">AI-Powered AR Ops</div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-6">
        {nav.map(group => (
          <div key={group.label}>
            {!collapsed && (
              <div className="px-2 mb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
                {group.label}
              </div>
            )}
            <div className="space-y-0.5">
              {group.items.map(item => {
                const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href.split('?')[0]))
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'flex items-center gap-3 px-2 py-2 rounded-md text-sm transition-colors',
                      active
                        ? 'bg-primary/10 text-primary font-medium'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                      collapsed && 'justify-center'
                    )}
                    title={collapsed ? item.label : undefined}
                  >
                    <item.icon className={cn('shrink-0', collapsed ? 'w-5 h-5' : 'w-4 h-4')} />
                    {!collapsed && <span className="truncate">{item.label}</span>}
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Collapse toggle */}
      <div className="p-2 border-t border-border">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center justify-center w-full h-8 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>
    </aside>
  )
}
