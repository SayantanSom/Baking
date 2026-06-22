import type { VarietyCostBreakdown } from '@/types/database'
import { formatCurrency } from '@/lib/utils'

export function VarietyCostBreakdownCard({
  breakdown,
  currency,
  taxPercentage = 0,
}: {
  breakdown: VarietyCostBreakdown
  currency: string
  taxPercentage?: number
}) {
  const rows = [
    { label: 'Ingredients', amount: breakdown.ingredientCost },
    { label: 'Packaging', amount: breakdown.packagingCost },
    { label: 'Labour', amount: breakdown.labourCost },
    { label: 'Shipping', amount: breakdown.shippingCost },
  ]

  return (
    <div className="rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
      <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-700">
        <h3 className="font-semibold">Production cost breakdown</h3>
        <p className="text-xs text-slate-500">
          Ingredients and overheads, plus tax on the selling price
        </p>
      </div>
      <table className="w-full text-sm">
        <tbody>
          {rows.map((row) => (
            <tr key={row.label} className="border-b border-slate-100 dark:border-slate-800">
              <td className="px-4 py-2 text-slate-600 dark:text-slate-300">{row.label}</td>
              <td className="px-4 py-2 text-right font-medium">
                {formatCurrency(row.amount, currency)}
              </td>
            </tr>
          ))}
          <tr className="bg-slate-50 font-semibold dark:bg-slate-800/50">
            <td className="px-4 py-2">Total production cost</td>
            <td className="px-4 py-2 text-right text-emerald-600">
              {formatCurrency(breakdown.totalCost, currency)}
            </td>
          </tr>
          {taxPercentage > 0 && (
            <>
              <tr className="border-t border-slate-200 dark:border-slate-700">
                <td
                  colSpan={2}
                  className="px-4 py-2 text-xs font-medium uppercase tracking-wide text-slate-500"
                >
                  Tax on selling price
                </td>
              </tr>
              <tr className="border-b border-slate-100 dark:border-slate-800">
                <td className="px-4 py-2 text-slate-600 dark:text-slate-300">
                  Tax ({taxPercentage}%)
                </td>
                <td className="px-4 py-2 text-right font-medium">
                  {formatCurrency(breakdown.taxOnSale, currency)}
                </td>
              </tr>
              <tr>
                <td className="px-4 py-2 text-slate-600 dark:text-slate-300">
                  Ex-tax revenue
                </td>
                <td className="px-4 py-2 text-right font-medium">
                  {formatCurrency(breakdown.netRevenue, currency)}
                </td>
              </tr>
            </>
          )}
        </tbody>
      </table>
    </div>
  )
}
