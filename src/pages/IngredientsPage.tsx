import { useState, useEffect, Fragment } from 'react'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { Plus, Search, Pencil, Trash2, ChevronDown, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { BufferSlider } from '@/components/ui/BufferSlider'
import { Dialog, ConfirmDialog } from '@/components/ui/Dialog'
import { PageLoader } from '@/components/ui/LoadingSpinner'
import { IngredientSupplierRows } from '@/components/ingredients/IngredientSupplierRows'
import {
  useIngredients,
  useCreateIngredient,
  useUpdateIngredient,
  useDeleteIngredient,
  useIngredientVendorCounts,
} from '@/hooks/useIngredients'
import { useSettings } from '@/hooks/useSettings'
import type { Ingredient, IngredientFormData, IngredientUnit } from '@/types/database'
import { formatUnitCost, cn } from '@/lib/utils'

const UNITS: { value: IngredientUnit; label: string }[] = [
  { value: 'g', label: 'Grams (g)' },
  { value: 'kg', label: 'Kilograms (kg)' },
  { value: 'ml', label: 'Millilitres (ml)' },
  { value: 'l', label: 'Litres (l)' },
  { value: 'unit', label: 'Unit' },
]

function IngredientFormDialog({
  open,
  onClose,
  ingredient,
  defaultBuffer,
}: {
  open: boolean
  onClose: () => void
  ingredient?: Ingredient
  defaultBuffer: number
}) {
  const createMutation = useCreateIngredient()
  const updateMutation = useUpdateIngredient()
  const isEditing = Boolean(ingredient)

  const { register, handleSubmit, watch, reset, setValue } = useForm<IngredientFormData>({
    defaultValues: {
      name: '',
      base_unit: 'g',
      default_buffer_percentage: defaultBuffer,
      notes: '',
    },
  })

  useEffect(() => {
    if (open) {
      reset(
        ingredient
          ? {
              name: ingredient.name,
              base_unit: ingredient.base_unit,
              default_buffer_percentage: ingredient.default_buffer_percentage,
              notes: ingredient.notes || '',
            }
          : {
              name: '',
              base_unit: 'g',
              default_buffer_percentage: defaultBuffer,
              notes: '',
            }
      )
    }
  }, [open, ingredient, defaultBuffer, reset])

  const buffer = watch('default_buffer_percentage')

  const onSubmit = async (form: IngredientFormData) => {
    if (isEditing && ingredient) {
      await updateMutation.mutateAsync({
        id: ingredient.id,
        form,
        version: ingredient.version,
      })
    } else {
      await createMutation.mutateAsync(form)
    }
    reset()
    onClose()
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={isEditing ? 'Edit Ingredient' : 'Add Ingredient'}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Input label="Name" {...register('name', { required: true })} />
        <Select
          label="Base Unit"
          {...register('base_unit')}
          options={UNITS}
        />
        <BufferSlider
          label="Supplier price buffer %"
          value={buffer}
          onChange={(v) => setValue('default_buffer_percentage', v)}
        />
        <div>
          <label className="mb-1.5 block text-sm font-medium">Notes</label>
          <textarea
            {...register('notes')}
            rows={2}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900"
          />
        </div>
        <div className="flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={createMutation.isPending || updateMutation.isPending}>
            {isEditing ? 'Save' : 'Add'}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}

export function IngredientsPage() {
  const { data: ingredients, isLoading } = useIngredients()
  const { data: vendorCounts } = useIngredientVendorCounts()
  const { data: settings } = useSettings()
  const deleteMutation = useDeleteIngredient()
  const [search, setSearch] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Ingredient | undefined>()
  const [deleteTarget, setDeleteTarget] = useState<Ingredient | undefined>()
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const currency = settings?.currency ?? '£'
  const defaultBuffer = settings?.default_buffer_percentage ?? 5

  const filtered = (ingredients ?? []).filter((i) =>
    i.name.toLowerCase().includes(search.toLowerCase())
  )

  const toggleExpanded = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  if (isLoading) return <PageLoader />

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Ingredients</h1>
          <p className="text-slate-500">Master ingredients with vendor pricing</p>
        </div>
        <Button onClick={() => { setEditing(undefined); setFormOpen(true) }}>
          <Plus className="h-4 w-4" /> Add Ingredient
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
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-slate-50 dark:border-slate-700 dark:bg-slate-800/50">
              <th className="w-10 px-2 py-3" />
              <th className="px-4 py-3 text-left">Name</th>
              <th className="px-4 py-3 text-left">Base Unit</th>
              <th className="px-4 py-3 text-right">Active Cost</th>
              <th className="px-4 py-3 text-right">Buffer %</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500">No ingredients</td></tr>
            ) : (
              filtered.map((ing) => {
                const isOpen = expanded.has(ing.id)
                const supplierCount = vendorCounts?.[ing.id] ?? 0

                return (
                  <Fragment key={ing.id}>
                    <tr
                      className={cn(
                        'border-b border-slate-100 dark:border-slate-800',
                        isOpen && 'bg-white dark:bg-slate-900'
                      )}
                    >
                      <td className="px-2 py-3">
                        <button
                          type="button"
                          onClick={() => toggleExpanded(ing.id)}
                          className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"
                          aria-expanded={isOpen}
                          aria-label={isOpen ? 'Collapse suppliers' : 'Expand suppliers'}
                        >
                          {isOpen ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => toggleExpanded(ing.id)}
                          className="text-left font-semibold text-slate-900 hover:text-emerald-700 dark:text-slate-100"
                        >
                          {ing.name}
                          <span className="ml-1.5 font-normal text-slate-500">
                            ({supplierCount})
                          </span>
                        </button>
                      </td>
                      <td className="px-4 py-3">{ing.base_unit}</td>
                      <td className="px-4 py-3 text-right text-emerald-600">
                        {ing.active_vendor_price
                          ? formatUnitCost(ing.active_vendor_price.cost_per_base_unit, currency)
                          : '—'}
                      </td>
                      <td className="px-4 py-3 text-right">{ing.default_buffer_percentage}%</td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          <Link to={`/ingredients/${ing.id}`}>
                            <Button variant="outline" size="sm">
                              Suppliers
                            </Button>
                          </Link>
                          <Button variant="ghost" size="sm" onClick={() => { setEditing(ing); setFormOpen(true) }}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(ing)}>
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                    {isOpen && <IngredientSupplierRows ingredient={ing} />}
                  </Fragment>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      <IngredientFormDialog
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditing(undefined) }}
        ingredient={editing}
        defaultBuffer={defaultBuffer}
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
        message={`Delete "${deleteTarget?.name}"?`}
        loading={deleteMutation.isPending}
      />
    </div>
  )
}
