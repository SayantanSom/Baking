import { formatCurrency } from '@/lib/utils'
import type { VarietyCostBreakdown } from '@/types/database'

export function GrossMarginCard({
  breakdown,
  currency,
  taxPercentage,
}: {
  breakdown: VarietyCostBreakdown
  currency: string
  taxPercentage: number
}) {
  const rows = [
    {
      label: 'Pre-tax',
      hint: 'On full selling price',
      amount: breakdown.grossMarginPreTax,
      percentage: breakdown.grossMarginPreTaxPercentage,
    },
    {
      label: 'Post-tax',
      hint:
        taxPercentage > 0
          ? `On ex-tax revenue (${taxPercentage}% tax removed)`
          : 'Same as pre-tax when tax is 0%',
      amount: breakdown.grossMarginPostTax,
      percentage: breakdown.grossMarginPostTaxPercentage,
    },
  ]

  return (
    <div className="rounded-lg border border-border bg-surface-muted p-4 lg:col-span-2">
      <p className="text-sm font-medium text-fg-secondary">Gross margin</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {rows.map((row) => (
          <div
            key={row.label}
            className="rounded-lg border border-border bg-surface p-3"
          >
            <p className="text-xs font-medium uppercase tracking-wide text-fg-muted">
              {row.label}
            </p>
            <p className="mt-1 text-xl font-bold text-fg">
              {formatCurrency(row.amount, currency)}
            </p>
            <p className="mt-0.5 text-sm font-medium text-accent">
              {row.percentage.toFixed(1)}%
            </p>
            <p className="mt-1 text-xs text-fg-muted">{row.hint}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
