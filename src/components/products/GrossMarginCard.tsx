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
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/50 lg:col-span-2">
      <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Gross margin</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {rows.map((row) => (
          <div
            key={row.label}
            className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900"
          >
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              {row.label}
            </p>
            <p className="mt-1 text-xl font-bold text-slate-900 dark:text-slate-100">
              {formatCurrency(row.amount, currency)}
            </p>
            <p className="mt-0.5 text-sm font-medium text-emerald-600">
              {row.percentage.toFixed(1)}%
            </p>
            <p className="mt-1 text-xs text-slate-500">{row.hint}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
