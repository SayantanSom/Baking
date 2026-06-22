import { StatusBadge } from '@/components/ui/StatusBadge'
import { Button } from '@/components/ui/Button'
import {
  ACCEPTANCE_REASON_OPTIONS,
  type ProductVariety,
  type ProductVarietyAcceptance,
} from '@/types/database'
import { getVarietyReviewStatus } from '@/lib/bufferStatus'
import { formatCurrency, formatDate } from '@/lib/utils'

function reasonLabel(type: string): string {
  return (
    ACCEPTANCE_REASON_OPTIONS.find((o) => o.value === type)?.label ?? type
  )
}

export function VarietyAcceptancePanel({
  variety,
  acceptance,
  currency,
  onAcceptCost,
  onAcceptReprice,
}: {
  variety: ProductVariety
  acceptance: ProductVarietyAcceptance | null | undefined
  currency: string
  onAcceptCost: () => void
  onAcceptReprice: () => void
}) {
  const review = getVarietyReviewStatus(variety, acceptance)
  const currentMarginValue = variety.selling_price - variety.current_cost_price
  const currentMarginPct =
    variety.selling_price > 0
      ? (currentMarginValue / variety.selling_price) * 100
      : 0

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
      <h3 className="mb-3 font-semibold">Business position</h3>
      <div className="grid gap-4 sm:grid-cols-2 text-sm">
        <div>
          <p className="text-slate-500">Current cost</p>
          <p className="font-medium">{formatCurrency(variety.current_cost_price, currency)}</p>
          <p className="mt-2 text-slate-500">Accepted cost</p>
          <p className="font-medium">
            {acceptance
              ? formatCurrency(acceptance.accepted_cost_price, currency)
              : '—'}
          </p>
        </div>
        <div>
          <p className="text-slate-500">Current price</p>
          <p className="font-medium">{formatCurrency(variety.selling_price, currency)}</p>
          <p className="mt-2 text-slate-500">Accepted price</p>
          <p className="font-medium">
            {acceptance
              ? formatCurrency(acceptance.accepted_selling_price, currency)
              : '—'}
          </p>
        </div>
        <div>
          <p className="text-slate-500">Margin value</p>
          <p className="font-medium">{formatCurrency(currentMarginValue, currency)}</p>
          <p className="mt-2 text-slate-500">Accepted margin</p>
          <p className="font-medium">
            {acceptance
              ? formatCurrency(acceptance.accepted_margin_value, currency)
              : '—'}
          </p>
        </div>
        <div>
          <p className="text-slate-500">Margin %</p>
          <p className="font-medium">{currentMarginPct.toFixed(1)}%</p>
          <p className="mt-2 text-slate-500">Accepted margin %</p>
          <p className="font-medium">
            {acceptance
              ? `${acceptance.accepted_margin_percentage.toFixed(1)}%`
              : '—'}
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {review?.costStatus && (
          <span className="flex items-center gap-1 text-sm">
            Cost: <StatusBadge status={review.costStatus} />
          </span>
        )}
        {review?.marginStatus && (
          <span className="flex items-center gap-1 text-sm">
            Margin: <StatusBadge status={review.marginStatus} />
          </span>
        )}
        {review && (
          <span className="text-sm text-slate-500">
            {review.marginValueDelta >= 0 ? '+' : ''}
            {formatCurrency(review.marginValueDelta, currency)} ·{' '}
            {review.marginPpDelta >= 0 ? '+' : ''}
            {review.marginPpDelta.toFixed(1)}pp
          </span>
        )}
      </div>

      {acceptance ? (
        <div className="mt-3 text-sm text-slate-500">
          <p>Last accepted: {formatDate(acceptance.accepted_at)}</p>
          <p>Reason: {reasonLabel(acceptance.accepted_reason_type)}</p>
          {acceptance.accepted_reason_notes && (
            <p>Notes: {acceptance.accepted_reason_notes}</p>
          )}
        </div>
      ) : (
        <p className="mt-3 text-sm text-slate-500">
          No baseline yet. Finish the recipe and production overheads, then use{' '}
          <strong>Accept Cost</strong> to lock in your starting position.
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <Button size="sm" onClick={onAcceptCost}>
          Accept Cost
        </Button>
        <Button size="sm" variant="outline" onClick={onAcceptReprice}>
          Accept & Reprice
        </Button>
      </div>
    </div>
  )
}
