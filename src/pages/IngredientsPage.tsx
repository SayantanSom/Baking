import { useState } from 'react'
import { Plus, Search, Pencil, Trash2, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Dialog, ConfirmDialog } from '@/components/ui/Dialog'
import { PageLoader } from '@/components/ui/LoadingSpinner'
import {
  useIngredients,
  useCreateIngredient,
  useUpdateIngredient,
  useDeleteIngredient,
} from '@/hooks/useIngredients'
import type { Ingredient, IngredientFormData, IngredientUnit } from '@/types/database'
import { formatCurrency, formatUnitCost, formatDate, calculateUnitCost } from '@/lib/utils'
import { useSettings } from '@/hooks/useSettings'
import { RETAILERS, openRetailerSearch } from '@/services/retailerUrls'
import { SupplierPriceSection } from '@/components/ingredients/SupplierPriceSection'

const UNITS: { value: IngredientUnit; label: string }[] = [
  { value: 'g', label: 'Grams (g)' },
  { value: 'kg', label: 'Kilograms (kg)' },
  { value: 'ml', label: 'Millilitres (ml)' },
  { value: 'l', label: 'Litres (l)' },
  { value: 'unit', label: 'Unit' },
]

const emptyForm: IngredientFormData = {
  name: '',
  unit: 'g',
  supplier: '',
  pack_size: 0,
  pack_cost: 0,
}

export function IngredientFormDialog({
  open,
  onClose,
  ingredient,
}: {
  open: boolean
  onClose: () => void
  ingredient?: Ingredient
}) {
  const [form, setForm] = useState<IngredientFormData>(
    ingredient
      ? {
          name: ingredient.name,
          unit: ingredient.unit,
          supplier: ingredient.supplier || '',
          pack_size: ingredient.pack_size,
          pack_cost: ingredient.pack_cost,
        }
      : emptyForm
  )

  const createMutation = useCreateIngredient()
  const updateMutation = useUpdateIngredient()
  const isEditing = Boolean(ingredient)

  const unitCost = calculateUnitCost(form.pack_cost, form.pack_size)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isEditing && ingredient) {
      await updateMutation.mutateAsync({ id: ingredient.id, form })
    } else {
      await createMutation.mutateAsync(form)
    }
    onClose()
    setForm(emptyForm)
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={isEditing ? 'Edit Ingredient' : 'Add Ingredient'}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          required
        />
        <Select
          label="Unit"
          value={form.unit}
          onChange={(e) =>
            setForm({ ...form, unit: e.target.value as IngredientUnit })
          }
          options={UNITS}
        />
        <Input
          label="Supplier"
          value={form.supplier}
          onChange={(e) => setForm({ ...form, supplier: e.target.value })}
        />
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Pack Size"
            type="number"
            step="0.01"
            min="0.01"
            value={form.pack_size || ''}
            onChange={(e) =>
              setForm({ ...form, pack_size: parseFloat(e.target.value) || 0 })
            }
            required
          />
          <Input
            label="Pack Cost (£)"
            type="number"
            step="0.01"
            min="0"
            value={form.pack_cost || ''}
            onChange={(e) =>
              setForm({ ...form, pack_cost: parseFloat(e.target.value) || 0 })
            }
            required
          />
        </div>
        <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800">
          <p className="text-sm text-slate-500">Calculated Unit Cost</p>
          <p className="text-lg font-semibold text-emerald-600 dark:text-emerald-400">
            {formatUnitCost(unitCost)} / {form.unit}
          </p>
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            loading={createMutation.isPending || updateMutation.isPending}
          >
            {isEditing ? 'Save Changes' : 'Add Ingredient'}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}

export function IngredientsPage() {
  const { data: ingredients, isLoading } = useIngredients()
  const { data: settings } = useSettings()
  const deleteMutation = useDeleteIngredient()
  const [search, setSearch] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Ingredient | undefined>()
  const [deleteTarget, setDeleteTarget] = useState<Ingredient | undefined>()
  const [lookupIngredient, setLookupIngredient] = useState<Ingredient | undefined>()

  const currency = settings?.currency ?? '£'

  const filtered = (ingredients ?? []).filter((i) =>
    i.name.toLowerCase().includes(search.toLowerCase())
  )

  if (isLoading) return <PageLoader />

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            Ingredients
          </h1>
          <p className="text-slate-500 dark:text-slate-400">
            Manage ingredient costs and suppliers
          </p>
        </div>
        <Button onClick={() => { setEditing(undefined); setFormOpen(true) }}>
          <Plus className="h-4 w-4" />
          Add Ingredient
        </Button>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          placeholder="Search ingredients..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-10 pr-4 text-sm dark:border-slate-600 dark:bg-slate-900"
        />
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/50">
                <th className="px-4 py-3 text-left font-medium">Name</th>
                <th className="px-4 py-3 text-left font-medium">Unit</th>
                <th className="px-4 py-3 text-left font-medium">Supplier</th>
                <th className="px-4 py-3 text-right font-medium">Pack</th>
                <th className="px-4 py-3 text-right font-medium">Unit Cost</th>
                <th className="px-4 py-3 text-left font-medium">Updated</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                    No ingredients found
                  </td>
                </tr>
              ) : (
                filtered.map((ingredient) => (
                  <tr
                    key={ingredient.id}
                    className="border-b border-slate-100 dark:border-slate-800"
                  >
                    <td className="px-4 py-3 font-medium">{ingredient.name}</td>
                    <td className="px-4 py-3">{ingredient.unit}</td>
                    <td className="px-4 py-3">{ingredient.supplier || '—'}</td>
                    <td className="px-4 py-3 text-right">
                      {ingredient.pack_size} {ingredient.unit} /{' '}
                      {formatCurrency(ingredient.pack_cost, currency)}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-emerald-600 dark:text-emerald-400">
                      {formatUnitCost(ingredient.unit_cost, currency)}
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {formatDate(ingredient.last_updated)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setLookupIngredient(ingredient)}
                          title="Retailer lookup"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setEditing(ingredient)
                            setFormOpen(true)
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeleteTarget(ingredient)}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <IngredientFormDialog
        open={formOpen}
        onClose={() => {
          setFormOpen(false)
          setEditing(undefined)
        }}
        ingredient={editing}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(undefined)}
        onConfirm={async () => {
          if (deleteTarget) {
            await deleteMutation.mutateAsync(deleteTarget.id)
            setDeleteTarget(undefined)
          }
        }}
        title="Delete Ingredient"
        message={`Are you sure you want to delete "${deleteTarget?.name}"? This cannot be undone if used in recipes.`}
        loading={deleteMutation.isPending}
      />

      <Dialog
        open={Boolean(lookupIngredient)}
        onClose={() => setLookupIngredient(undefined)}
        title={`Retailer Lookup: ${lookupIngredient?.name ?? ''}`}
        className="max-w-2xl"
      >
        {lookupIngredient && (
          <div className="space-y-6">
            <div>
              <p className="mb-3 text-sm text-slate-500">
                Search for prices at UK retailers:
              </p>
              <div className="flex flex-wrap gap-2">
                {RETAILERS.map((retailer) => (
                  <Button
                    key={retailer}
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      openRetailerSearch(retailer, lookupIngredient.name)
                    }
                  >
                    <ExternalLink className="h-3 w-3" />
                    Search {retailer}
                  </Button>
                ))}
              </div>
            </div>
            <SupplierPriceSection ingredientId={lookupIngredient.id} />
          </div>
        )}
      </Dialog>
    </div>
  )
}
