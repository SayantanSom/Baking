import { cn, formatCurrency } from '@/lib/utils'
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
    default: 'text-emerald-600 dark:text-emerald-400',
    warning: 'text-amber-600 dark:text-amber-400',
    danger: 'text-red-600 dark:text-red-400',
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
            {title}
          </p>
          <p className="mt-2 text-3xl font-bold text-slate-900 dark:text-slate-100">
            {value}
          </p>
          {trend && (
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {trend}
            </p>
          )}
        </div>
        <div
          className={cn(
            'rounded-lg bg-slate-50 p-3 dark:bg-slate-800',
            variants[variant]
          )}
        >
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
          ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-900/20'
          : 'border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/50'
      )}
    >
      <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
      <p
        className={cn(
          'mt-1 text-2xl font-bold',
          highlight
            ? 'text-emerald-700 dark:text-emerald-300'
            : 'text-slate-900 dark:text-slate-100'
        )}
      >
        {formatCurrency(amount, currency)}
      </p>
    </div>
  )
}
