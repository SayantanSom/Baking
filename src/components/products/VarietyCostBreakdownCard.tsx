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
    <div className="rounded-lg border border-border bg-surface">
      <div className="border-b border-border px-4 py-3">
        <h3 className="font-semibold">Production cost breakdown</h3>
        <p className="text-xs text-fg-muted">
          Ingredients and overheads, plus tax on the selling price
        </p>
      </div>
      <table className="w-full text-sm">
        <tbody>
          {rows.map((row) => (
            <tr key={row.label} className="border-b border-border">
              <td className="px-4 py-2 text-fg-secondary">{row.label}</td>
              <td className="px-4 py-2 text-right font-medium">
                {formatCurrency(row.amount, currency)}
              </td>
            </tr>
          ))}
          <tr className="bg-surface-muted font-semibold">
            <td className="px-4 py-2">Total production cost</td>
            <td className="px-4 py-2 text-right text-accent">
              {formatCurrency(breakdown.totalCost, currency)}
            </td>
          </tr>
          {taxPercentage > 0 && (
            <>
              <tr className="border-t border-border">
                <td
                  colSpan={2}
                  className="px-4 py-2 text-xs font-medium uppercase tracking-wide text-fg-muted"
                >
                  Tax on selling price
                </td>
              </tr>
              <tr className="border-b border-border">
                <td className="px-4 py-2 text-fg-secondary">
                  Tax ({taxPercentage}%)
                </td>
                <td className="px-4 py-2 text-right font-medium">
                  {formatCurrency(breakdown.taxOnSale, currency)}
                </td>
              </tr>
              <tr>
                <td className="px-4 py-2 text-fg-secondary">
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
