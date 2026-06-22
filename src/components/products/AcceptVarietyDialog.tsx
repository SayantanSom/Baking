import { useEffect, useState } from 'react'
import { Dialog } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import {
  ACCEPTANCE_REASON_OPTIONS,
  type AcceptanceReasonType,
  type ProductVariety,
  type ProductVarietyAcceptance,
} from '@/types/database'
import {
  suggestSellingPriceForTargetMargin,
} from '@/lib/bufferStatus'
import { formatCurrency } from '@/lib/utils'

type Mode = 'cost' | 'reprice'

export function AcceptVarietyDialog({
  open,
  onClose,
  variety,
  latestAcceptance,
  currency,
  mode,
  onAcceptCost,
  onAcceptReprice,
  loading,
}: {
  open: boolean
  onClose: () => void
  variety: ProductVariety
  latestAcceptance: ProductVarietyAcceptance | null | undefined
  currency: string
  mode: Mode
  onAcceptCost: (reasonType: AcceptanceReasonType, notes: string) => Promise<void>
  onAcceptReprice: (
    reasonType: AcceptanceReasonType,
    notes: string,
    newSellingPrice: number
  ) => Promise<void>
  loading?: boolean
}) {
  const [reasonType, setReasonType] = useState<AcceptanceReasonType>(
    'supplier_increase_accepted'
  )
  const [notes, setNotes] = useState('')
  const targetMargin =
    latestAcceptance?.accepted_margin_percentage ??
    (variety.selling_price > 0
      ? ((variety.selling_price - variety.current_cost_price) / variety.selling_price) * 100
      : 0)
  const suggested = suggestSellingPriceForTargetMargin(
    variety.current_cost_price,
    targetMargin
  )
  const [newPrice, setNewPrice] = useState(String(suggested))

  useEffect(() => {
    if (open) {
      setReasonType('supplier_increase_accepted')
      setNotes('')
      setNewPrice(suggested.toFixed(2))
    }
  }, [open, suggested])

  const handleSubmit = async () => {
    if (mode === 'cost') {
      await onAcceptCost(reasonType, notes)
    } else {
      await onAcceptReprice(reasonType, notes, parseFloat(newPrice) || suggested)
    }
    onClose()
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={mode === 'cost' ? 'Accept Cost' : 'Accept & Reprice'}
    >
      <div className="space-y-4">
        <div className="rounded-lg border p-3 text-sm dark:border-slate-700">
          <p>Current cost: {formatCurrency(variety.current_cost_price, currency)}</p>
          <p>Current price: {formatCurrency(variety.selling_price, currency)}</p>
          {mode === 'reprice' && (
            <>
              <p className="mt-2">Target margin: {targetMargin.toFixed(1)}%</p>
              <p>Suggested price: {formatCurrency(suggested, currency)}</p>
              <Input
                label="New selling price"
                type="number"
                step="0.01"
                value={newPrice}
                onChange={(e) => setNewPrice(e.target.value)}
                className="mt-2"
              />
            </>
          )}
        </div>
        <Select
          label="Reason"
          value={reasonType}
          onChange={(e) => setReasonType(e.target.value as AcceptanceReasonType)}
          options={ACCEPTANCE_REASON_OPTIONS.map((o) => ({
            value: o.value,
            label: o.label,
          }))}
        />
        <Input
          label="Notes (optional)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} loading={loading}>
            {mode === 'cost' ? 'Accept Cost' : 'Accept & Reprice'}
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
