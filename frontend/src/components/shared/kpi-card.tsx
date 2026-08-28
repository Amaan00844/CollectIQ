import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { cn, formatINR } from '@/lib/utils'

interface KpiCardProps {
  label: string
  value: string | number
  subLabel?: string
  trend?: 'up' | 'down' | 'neutral'
  change?: string
  valueClassName?: string
}

export function KpiCard({ label, value, subLabel, trend, change, valueClassName }: KpiCardProps) {
  return (
    <div className="bg-card border border-border rounded-lg p-5 space-y-2">
      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</div>
      <div className={cn('text-2xl font-bold tracking-tight text-foreground', valueClassName)}>
        {typeof value === 'number' && value > 10000 ? formatINR(value) : value}
      </div>
      {(subLabel || change) && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          {trend === 'up' && <TrendingUp className="w-3 h-3 text-red-500" />}
          {trend === 'down' && <TrendingDown className="w-3 h-3 text-emerald-500" />}
          {trend === 'neutral' && <Minus className="w-3 h-3" />}
          {change && <span className={cn(trend === 'up' ? 'text-red-600' : trend === 'down' ? 'text-emerald-600' : '')}>{change}</span>}
          {subLabel && <span>{subLabel}</span>}
        </div>
      )}
    </div>
  )
}
