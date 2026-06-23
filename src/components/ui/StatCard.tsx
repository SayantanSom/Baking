import { cn, formatCurrency } from '@/lib/utils'
import { theme } from '@/lib/theme'
import type { LucideIcon } from 'lucide-react'

interface StatCardProps {
  title: string
  value: string | number
  icon: LucideIcon
  trend?: string
  variant?: 'default' | 'warning' | 'danger'
}

export function StatCard({
  title,
  value,
  icon: Icon,
  trend,
  variant = 'default',
}: StatCardProps) {
  const variants = {
    default: 'text-accent',
    warning: 'text-warning-secondary',
    danger: 'text-danger',
  }

  return (
    <div className={cn(theme.surface, 'p-6')}>
      <div className="flex items-start justify-between">
        <div>
          <p className={cn('text-sm font-medium', theme.textMuted)}>{title}</p>
          <p className="mt-2 text-3xl font-bold text-fg">{value}</p>
          {trend && <p className={cn('mt-1 text-sm', theme.textMuted)}>{trend}</p>}
        </div>
        <div className={cn('rounded-lg bg-surface-muted p-3', variants[variant])}>
          <Icon className="h-6 w-6" />
        </div>
      </div>
    </div>
  )
}

interface CostDisplayProps {
  label: string
  amount: number
  currency?: string
  highlight?: boolean
}

export function CostDisplay({
  label,
  amount,
  currency = '£',
  highlight,
}: CostDisplayProps) {
  return (
    <div
      className={cn(
        'rounded-lg border p-4',
        highlight
          ? 'border-accent/30 bg-accent-muted'
          : 'border-border bg-surface-muted'
      )}
    >
      <p className={cn('text-sm', theme.textMuted)}>{label}</p>
      <p
        className={cn(
          'mt-1 text-2xl font-bold',
          highlight ? 'text-accent-muted-fg' : 'text-fg'
        )}
      >
        {formatCurrency(amount, currency)}
      </p>
    </div>
  )
}
