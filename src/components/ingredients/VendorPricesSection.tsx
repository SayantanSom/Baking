import { useState, useMemo } from 'react'
import { Pencil, Trash2, Check, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { ConfirmDialog } from '@/components/ui/Dialog'
import { VendorPriceFormDialog } from '@/components/ingredients/VendorPriceFormDialog'
import {
  useVendorPrices,
  useCreateVendorPrice,
  useUpdateVendorPrice,
  useDeleteVendorPrice,
  useSetActiveVendorPrice,
  useCheapestVendor,
} from '@/hooks/useIngredients'
import type { Ingredient, IngredientVendorPrice, VendorPriceFormData } from '@/types/database'
import { formatCurrency, formatUnitCost, formatDateTime } from '@/lib/utils'
import { convertToBaseUnit } from '@/lib/unitConversion'
import { useSettings } from '@/hooks/useSettings'
import { openRetailerSearch } from '@/services/retailerUrls'
import { RetailerPriceLookup } from '@/components/ingredients/RetailerPriceLookup'

export function VendorPricesSection({ ingredient }: { ingredient: Ingredient }) {
  const { data: prices, isLoading } = useVendorPrices(ingredient.id)
  const { data: settings } = useSettings()
  const createMutation = useCreateVendorPrice()
  const updateMutation = useUpdateVendorPrice()
  const deleteMutation = useDeleteVendorPrice()
  const setActiveMutation = useSetActiveVendorPrice()
  const cheapestMutation = useCheapestVendor()

  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<IngredientVendorPrice | undefined>()

  const currency = settings?.currency ?? '£'

  const sorted = useMemo(() => {
    const list = [...(prices ?? [])]
    list.sort((a, b) => a.cost_per_base_unit - b.cost_per_base_unit)
    return list
  }, [prices])

  const cheapestId = sorted[0]?.id

  const handleSubmit = async (form: VendorPriceFormData) => {
    const payload = {
      ...form,
      last_checked_at: form.last_checked_at
        ? new Date(form.last_checked_at).toISOString()
        : new Date().toISOString(),
    }
    if (editing) {
      await updateMutation.mutateAsync({
        id: editing.id,
        ingredientId: ingredient.id,
        form: payload,
        baseUnit: ingredient.base_unit,
      })
    } else {
      await createMutation.mutateAsync({
        ingredientId: ingredient.id,
        form: payload,
        baseUnit: ingredient.base_unit,
      })
    }
    setEditing(undefined)
  }

  if (isLoading) return <p className="text-sm text-slate-500">Loading...</p>

  return (
    <div className="space-y-4">
      <RetailerPriceLookup ingredientName={ingredient.name} />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-semibold">Normalised Cost View</h3>
          <p className="text-xs text-slate-500">Sorted by cost per {ingredient.base_unit} — compare pack sizes fairly</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => cheapestMutation.mutate(ingredient.id)}
            loading={cheapestMutation.isPending}
            disabled={(prices ?? []).length === 0}
          >
            Use cheapest vendor
          </Button>
          <Button size="sm" onClick={() => { setEditing(undefined); setFormOpen(true) }}>
            Add Vendor
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-slate-50 dark:border-slate-700 dark:bg-slate-800/50">
              <th className="px-3 py-2 text-left">Supplier</th>
              <th className="px-3 py-2 text-right">Pack</th>
              <th className="px-3 py-2 text-right">Price</th>
              <th className="px-3 py-2 text-right">Cost/{ingredient.base_unit}</th>
              <th className="px-3 py-2 text-left">Active</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-slate-500">
                  No vendor prices yet
                </td>
              </tr>
            ) : (
              sorted.map((p) => {
                let converted = p.pack_size
                try {
                  converted = convertToBaseUnit(p.pack_size, p.pack_unit, ingredient.base_unit)
                } catch { /* keep pack_size */ }
                const isCheapest = p.id === cheapestId
                return (
                  <tr
                    key={p.id}
                    className={`border-b border-slate-100 dark:border-slate-800 ${isCheapest ? 'bg-emerald-50/50 dark:bg-emerald-900/10' : ''}`}
                  >
                    <td className="px-3 py-2">
                      <p className="font-medium">{p.vendor_name}</p>
                      {isCheapest && (
                        <span className="text-xs text-emerald-600">Best price</span>
                      )}
                      <p className="text-xs text-slate-400">{formatDateTime(p.last_checked_at)}</p>
                    </td>
                    <td className="px-3 py-2 text-right">
                      {p.pack_size}{p.pack_unit}
                      <span className="block text-xs text-slate-400">
                        ({converted.toFixed(2)} {ingredient.base_unit})
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right">{formatCurrency(p.pack_cost, currency)}</td>
                    <td className="px-3 py-2 text-right font-medium text-emerald-600">
                      {formatUnitCost(p.cost_per_base_unit, currency)}/{ingredient.base_unit}
                    </td>
                    <td className="px-3 py-2">
                      {p.is_active ? (
                        <StatusBadge status="green" label="Active" />
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            setActiveMutation.mutate({
                              ingredientId: ingredient.id,
                              vendorPriceId: p.id,
                            })
                          }
                        >
                          <Check className="h-3 w-3" /> Activate
                        </Button>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => { setEditing(p); setFormOpen(true) }}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        {p.product_url && (
                          <a href={p.product_url} target="_blank" rel="noreferrer">
                            <Button variant="ghost" size="sm"><ExternalLink className="h-4 w-4" /></Button>
                          </a>
                        )}
                        <Button variant="ghost" size="sm" onClick={() => openRetailerSearch(p.vendor_name, ingredient.name)}>
                          Search
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setDeleteId(p.id)}>
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      <VendorPriceFormDialog
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditing(undefined) }}
        ingredient={ingredient}
        vendor={editing}
        onSubmit={handleSubmit}
        loading={createMutation.isPending || updateMutation.isPending}
      />

      <ConfirmDialog
        open={Boolean(deleteId)}
        onClose={() => setDeleteId(null)}
        onConfirm={async () => {
          if (deleteId) {
            await deleteMutation.mutateAsync({ id: deleteId, ingredientId: ingredient.id })
            setDeleteId(null)
          }
        }}
        title="Delete Vendor Price"
        message="Remove this vendor price record?"
        loading={deleteMutation.isPending}
      />
    </div>
  )
}
