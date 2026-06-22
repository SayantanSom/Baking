import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { Dialog } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import type {
  Ingredient,
  IngredientVendorPrice,
  IngredientUnit,
  VendorPriceFormData,
} from '@/types/database'
import { VENDOR_OPTIONS } from '@/types/database'
import { calculateCostPerBaseUnit } from '@/lib/unitConversion'
import { formatUnitCost } from '@/lib/utils'
import { useSettings } from '@/hooks/useSettings'

const UNITS: { value: IngredientUnit; label: string }[] = [
  { value: 'g', label: 'g' },
  { value: 'kg', label: 'kg' },
  { value: 'ml', label: 'ml' },
  { value: 'l', label: 'l' },
  { value: 'unit', label: 'unit' },
]

const emptyForm: VendorPriceFormData = {
  vendor_name: 'Tesco',
  pack_size: 0,
  pack_unit: 'g',
  pack_cost: 0,
  product_url: '',
  is_active: false,
}

function toLocalDatetimeInput(value: Date): string {
  return new Date(value.getTime() - value.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16)
}

function todayLocalDatetime(): string {
  return toLocalDatetimeInput(new Date())
}

function toForm(vendor: IngredientVendorPrice): VendorPriceFormData {
  const local = toLocalDatetimeInput(new Date(vendor.last_checked_at))
  return {
    vendor_name: vendor.vendor_name,
    pack_size: vendor.pack_size,
    pack_unit: vendor.pack_unit,
    pack_cost: vendor.pack_cost,
    product_url: vendor.product_url ?? '',
    is_active: vendor.is_active,
    last_checked_at: local,
  }
}

export function VendorPriceFormDialog({
  open,
  onClose,
  ingredient,
  vendor,
  isFirstVendor = false,
  onSubmit,
  loading,
}: {
  open: boolean
  onClose: () => void
  ingredient: Ingredient
  vendor?: IngredientVendorPrice
  isFirstVendor?: boolean
  onSubmit: (form: VendorPriceFormData) => Promise<void>
  loading?: boolean
}) {
  const { data: settings } = useSettings()
  const currency = settings?.currency ?? '£'
  const isEdit = Boolean(vendor)

  const { register, handleSubmit, watch, reset } = useForm<VendorPriceFormData>({
    defaultValues: emptyForm,
  })

  useEffect(() => {
    if (open) {
      reset(
        vendor
          ? toForm(vendor)
          : {
              ...emptyForm,
              pack_unit: ingredient.base_unit,
              last_checked_at: todayLocalDatetime(),
              is_active: isFirstVendor,
            }
      )
    }
  }, [open, vendor, ingredient.base_unit, isFirstVendor, reset])

  const packCost = watch('pack_cost')
  const packSize = watch('pack_size')
  const packUnit = watch('pack_unit')
  const previewCost =
    packSize > 0
      ? calculateCostPerBaseUnit(
          packCost,
          packSize,
          packUnit,
          ingredient.base_unit
        )
      : 0

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit Vendor Price' : 'Add Vendor Price'}
    >
      <form
        onSubmit={handleSubmit(async (form) => {
          await onSubmit(form)
          onClose()
        })}
        className="space-y-4"
      >
        <Select
          label="Vendor"
          {...register('vendor_name')}
          options={VENDOR_OPTIONS.map((v) => ({ value: v, label: v }))}
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            label={`Pack Cost (${currency})`}
            type="number"
            step="0.01"
            {...register('pack_cost', { valueAsNumber: true })}
          />
          <Input
            label="Pack Size"
            type="number"
            step="0.01"
            {...register('pack_size', { valueAsNumber: true })}
          />
          <Select label="Pack Unit" {...register('pack_unit')} options={UNITS} />
          <Input
            label="Last Checked"
            type="datetime-local"
            {...register('last_checked_at')}
          />
        </div>
        <Input label="Product URL" type="url" {...register('product_url')} />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" {...register('is_active')} />
          Set as active vendor
        </label>
        <div className="rounded bg-slate-50 p-2 text-sm dark:bg-slate-800">
          Cost per {ingredient.base_unit}:{' '}
          <span className="font-medium text-emerald-600">
            {formatUnitCost(previewCost, currency)}
          </span>
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={loading}>
            {isEdit ? 'Save' : 'Add'}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
