import { cn, getStatusColor, getStatusLabel } from '@/lib/utils'
import type { CostStatus } from '@/types/database'

interface StatusBadgeProps {
  status: CostStatus
  label?: string
  className?: string
}

export function StatusBadge({ status, label, className }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        getStatusColor(status),
        className
      )}
    >
      {label ?? getStatusLabel(status)}
    </span>
  )
}
