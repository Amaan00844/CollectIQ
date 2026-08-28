import { cn } from '@/lib/utils'

type Status = 'paid' | 'open' | 'due_soon' | 'overdue' | 'disputed' | 'promise_to_pay'
type Risk = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
type DeliveryMode = 'auto_send' | 'human_signoff'

const statusMap: Record<Status, { label: string; className: string }> = {
  paid:           { label: 'Paid',           className: 'status-paid' },
  open:           { label: 'Open',           className: 'status-open' },
  due_soon:       { label: 'Due Soon',       className: 'status-due-soon' },
  overdue:        { label: 'Overdue',        className: 'status-overdue' },
  disputed:       { label: 'Disputed',       className: 'status-disputed' },
  promise_to_pay: { label: 'Promise to Pay', className: 'status-promise' },
}

const riskMap: Record<Risk, { label: string; className: string }> = {
  LOW:      { label: 'Low',      className: 'risk-low' },
  MEDIUM:   { label: 'Medium',   className: 'risk-medium' },
  HIGH:     { label: 'High',     className: 'risk-high' },
  CRITICAL: { label: 'Critical', className: 'risk-critical' },
}

export function StatusBadge({ status }: { status: Status }) {
  const { label, className } = statusMap[status] ?? { label: status, className: 'status-open' }
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border', className)}>
      {label}
    </span>
  )
}

export function RiskBadge({ risk }: { risk: Risk }) {
  const { label, className } = riskMap[risk] ?? { label: risk, className: 'risk-low' }
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border', className)}>
      {label}
    </span>
  )
}

export function DeliveryModeBadge({ mode }: { mode: DeliveryMode }) {
  if (mode === 'auto_send') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950 dark:text-blue-400 dark:border-blue-900">
        AUTO-SEND
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-900">
      HUMAN REVIEW
    </span>
  )
}

export function ActionStatusBadge({ status }: { status: 'auto_sent' | 'awaiting_review' | 'approved' | 'rejected' }) {
  const map = {
    auto_sent:       'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-400',
    awaiting_review: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-400',
    approved:        'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-400',
    rejected:        'bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-400',
  }
  const labels = { auto_sent: 'Auto-Sent', awaiting_review: 'Awaiting Review', approved: 'Approved', rejected: 'Rejected' }
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border', map[status])}>
      {labels[status]}
    </span>
  )
}
