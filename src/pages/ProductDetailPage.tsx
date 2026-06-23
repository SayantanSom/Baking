import { useState, useEffect, useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { ArrowLeft, Plus, Pencil, Trash2, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Dialog, ConfirmDialog } from '@/components/ui/Dialog'
import { PageLoader } from '@/components/ui/LoadingSpinner'
import { Tabs, TabPanel } from '@/components/ui/Tabs'
import {
  useProduct,
  useCreateVariety,
  useUpdateVariety,
  useDeleteVariety,
  useProductRecipeVersions,
  useAddBaseRecipeIngredient,
  useRemoveBaseRecipeIngredient,
  useSaveRecipeVersionAsNew,
  useSetCurrentRecipeVersion,
  useEnsureRecipeVersion,
  useVariety,
} from '@/hooks/useProducts'
import { useIngredients } from '@/hooks/useIngredients'
import { useSettings } from '@/hooks/useSettings'
import { getCurrentRecipeVersion } from '@/services/recipeVersions'
import { scaleQuantity } from '@/lib/recipeScaling'
import type {
  ProductVariety,
  ProductVarietyFormData,
  IngredientUnit,
  RecipeScalingMode,
} from '@/types/database'
import { BufferSlider } from '@/components/ui/BufferSlider'
import { formatCurrency } from '@/lib/utils'
import { emptyVarietyForm, mapVarietyToForm, newVarietyFormDefaults } from '@/lib/varietyForm'

function varietyLabel(v: ProductVariety): string {
  return [v.size_label, v.variety_name].filter(Boolean).join(' ') || v.variety_name
}

function VarietyFormDialog({
  open,
  onClose,
  productId,
  variety,
  baseLines,
  varieties,
}: {
  open: boolean
  onClose: () => void
  productId: string
  variety?: ProductVariety
  baseLines: { name: string; qty: number; unit: string; scaling: RecipeScalingMode }[]
  varieties: ProductVariety[]
}) {
  const createMutation = useCreateVariety()
  const updateMutation = useUpdateVariety()
  const { data: settings } = useSettings()
  const isEditing = Boolean(variety)
  const [recipeSource, setRecipeSource] = useState<'base' | string>('base')

  const sourceVarietyId = !isEditing && recipeSource !== 'base' ? recipeSource : ''
  const { data: sourceVariety } = useVariety(sourceVarietyId)

  const { register, handleSubmit, watch, reset, setValue } = useForm<ProductVarietyFormData>({
    defaultValues: emptyVarietyForm,
  })

  useEffect(() => {
    if (open) {
      reset(
        variety
          ? mapVarietyToForm(variety)
          : newVarietyFormDefaults(settings)
      )
      if (!variety) {
        setRecipeSource(baseLines.length > 0 ? 'base' : varieties[0]?.id ?? 'base')
      }
    }
  }, [open, variety, settings, reset, baseLines.length, varieties])

  const factor = watch('base_recipe_factor') ?? 1
  const bufferValue = watch('buffer_percentage') ?? 5

  const preview = useMemo(() => {
    if (recipeSource === 'base') {
      return baseLines.map((l) => ({
        name: l.name,
        qty: l.qty,
        unit: l.unit,
        scaled: scaleQuantity(l.qty, factor, l.scaling),
      }))
    }
    return (sourceVariety?.product_variety_ingredients ?? []).map((l) => ({
      name: l.ingredient?.name ?? 'Ingredient',
      qty: l.quantity_used,
      unit: l.unit,
      scaled: l.quantity_used * factor,
    }))
  }, [recipeSource, baseLines, sourceVariety, factor])

  const sourceOptions = useMemo(() => {
    const options: { value: string; label: string }[] = []
    if (baseLines.length > 0) {
      options.push({ value: 'base', label: 'Base recipe (current)' })
    }
    for (const v of varieties) {
      options.push({ value: v.id, label: varietyLabel(v) })
    }
    return options
  }, [baseLines.length, varieties])

  const onSubmit = async (form: ProductVarietyFormData) => {
    if (isEditing && variety) {
      await updateMutation.mutateAsync({ id: variety.id, form })
    } else {
      await createMutation.mutateAsync({
        productId,
        form,
        sourceVarietyId: recipeSource === 'base' ? undefined : recipeSource,
      })
    }
    reset(newVarietyFormDefaults(settings))
    onClose()
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={isEditing ? 'Edit Variety' : 'Create Variety'}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {!isEditing && sourceOptions.length > 0 && (
          <Select
            label="Copy recipe from"
            value={recipeSource}
            onChange={(e) => setRecipeSource(e.target.value)}
            options={sourceOptions}
          />
        )}
        <Input label="Variety Name" {...register('variety_name', { required: true })} />
        <Input label="Size Label" {...register('size_label')} placeholder="e.g. 8 inch" />
        <Input label="SKU" {...register('sku')} />
        <div className="grid grid-cols-2 gap-4">
          <Input label="Selling Price" type="number" step="0.01" {...register('selling_price', { valueAsNumber: true })} />
          <Input label="Recipe Yield" type="number" min="1" {...register('recipe_yield', { valueAsNumber: true })} />
          <Input label="Packaging Cost" type="number" step="0.01" {...register('packaging_cost', { valueAsNumber: true })} />
          <Input label="Labour Cost" type="number" step="0.01" {...register('labour_cost', { valueAsNumber: true })} />
          <Input label="Shipping Cost" type="number" step="0.01" {...register('shipping_cost', { valueAsNumber: true })} />
          {!isEditing && (
            <Input
              label="Recipe factor"
              type="number"
              step="0.1"
              {...register('base_recipe_factor', { valueAsNumber: true })}
            />
          )}
        </div>
        <BufferSlider
          label="Cost buffer %"
          value={bufferValue}
          onChange={(v) => setValue('buffer_percentage', v)}
        />
        <input type="hidden" {...register('buffer_percentage', { valueAsNumber: true })} />
        {!isEditing && preview.length > 0 && (
          <div className="rounded border p-3 text-sm border-border">
            <p className="mb-2 font-medium">Recipe preview (factor {factor})</p>
            <table className="w-full">
              <tbody>
                {preview.map((p) => (
                  <tr key={p.name}>
                    <td className="py-1">{p.name}</td>
                    <td className="py-1 text-right">
                      {p.qty} {p.unit} → {p.scaled.toFixed(2)} {p.unit}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" {...register('is_catalogue_visible')} />
          Visible in catalogue
        </label>
        <div className="flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={createMutation.isPending || updateMutation.isPending}>
            {isEditing ? 'Save' : 'Create Variety'}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}

export function ProductDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { data: product, isLoading } = useProduct(id!)
  const { data: recipeProduct, isLoading: recipeLoading } = useProductRecipeVersions(id!)
  const { data: ingredients } = useIngredients()
  const { data: settings } = useSettings()
  const deleteMutation = useDeleteVariety()
  const ensureVersion = useEnsureRecipeVersion()
  const addBaseIng = useAddBaseRecipeIngredient()
  const removeBaseIng = useRemoveBaseRecipeIngredient()
  const saveVersion = useSaveRecipeVersionAsNew()
  const setCurrent = useSetCurrentRecipeVersion()

  const [tab, setTab] = useState('varieties')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<ProductVariety | undefined>()
  const [deleteTarget, setDeleteTarget] = useState<ProductVariety | undefined>()
  const [viewVersionId, setViewVersionId] = useState<string | null>(null)
  const [newVersionName, setNewVersionName] = useState('')
  const [showNewVersion, setShowNewVersion] = useState(false)
  const [baseIngId, setBaseIngId] = useState('')
  const [baseQty, setBaseQty] = useState('')
  const [baseUnit, setBaseUnit] = useState<IngredientUnit>('g')
  const [baseScaling, setBaseScaling] = useState<RecipeScalingMode>('proportional')

  const currency = settings?.currency ?? '£'

  useEffect(() => {
    if (id) ensureVersion.mutate(id)
  }, [id])

  if (isLoading || !product) return <PageLoader />

  const versions = recipeProduct?.product_recipe_versions ?? []
  const currentVersion = recipeProduct ? getCurrentRecipeVersion(recipeProduct) : undefined
  const activeVersion =
    versions.find((v) => v.id === viewVersionId) ?? currentVersion
  const isCurrentEditable = activeVersion?.is_current ?? false
  const baseLines =
    activeVersion?.product_base_recipe_ingredients?.map((l) => ({
      name: l.ingredient?.name ?? 'Ingredient',
      qty: l.quantity_used,
      unit: l.unit,
      scaling: l.scaling_mode,
    })) ?? []

  const baseTotal =
    activeVersion?.product_base_recipe_ingredients?.reduce(
      (s, l) => s + l.calculated_cost,
      0
    ) ?? 0

  const varieties = product.product_varieties ?? []
  const canCreateVariety =
    (currentVersion?.product_base_recipe_ingredients?.length ?? 0) > 0 ||
    varieties.length > 0

  const handleAddBaseIngredient = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!activeVersion || !baseIngId || !baseQty) return
    await addBaseIng.mutateAsync({
      versionId: activeVersion.id,
      productId: product.id,
      ingredientId: baseIngId,
      quantityUsed: parseFloat(baseQty),
      unit: baseUnit,
      scalingMode: baseScaling,
    })
    setBaseIngId('')
    setBaseQty('')
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link to="/products">
          <Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4" /> Back</Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">{product.name}</h1>
          {product.category && <p className="text-sm text-fg-subtle">{product.category}</p>}
        </div>
      </div>

      <Tabs
        tabs={[
          { id: 'overview', label: 'Overview' },
          { id: 'base', label: 'Base Recipe' },
          { id: 'varieties', label: 'Varieties' },
        ]}
        active={tab}
        onChange={setTab}
      />

      <TabPanel active={tab} id="overview">
        {product.description && <p className="text-fg-secondary">{product.description}</p>}
        <p className="text-sm text-fg-muted">
          Workflow: define base recipe → create varieties with a scaling factor → optionally override per variety.
        </p>
      </TabPanel>

      <TabPanel active={tab} id="base">
        {recipeLoading ? (
          <PageLoader />
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {versions.map((v) => (
                <Button
                  key={v.id}
                  size="sm"
                  variant={activeVersion?.id === v.id ? 'primary' : 'outline'}
                  onClick={() => setViewVersionId(v.id)}
                >
                  v{v.version_number} {v.name}
                  {v.is_current && ' (Current)'}
                </Button>
              ))}
              {activeVersion && !activeVersion.is_current && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    setCurrent.mutate({ productId: product.id, versionId: activeVersion.id })
                  }
                >
                  Set as current
                </Button>
              )}
              <Button size="sm" variant="ghost" onClick={() => setShowNewVersion(true)}>
                Save as new version
              </Button>
            </div>

            {activeVersion && (
              <>
                <p className="text-sm text-fg-muted">
                  Yield: {activeVersion.recipe_yield} · Total cost: {formatCurrency(baseTotal, currency)}
                  {!isCurrentEditable && ' · Read-only historical version'}
                </p>

                {isCurrentEditable && (
                  <form onSubmit={handleAddBaseIngredient} className="flex flex-wrap items-end gap-2">
                    <Select
                      label="Ingredient"
                      value={baseIngId}
                      onChange={(e) => {
                        setBaseIngId(e.target.value)
                        const ing = ingredients?.find((i) => i.id === e.target.value)
                        if (ing) setBaseUnit(ing.base_unit)
                      }}
                      options={[
                        { value: '', label: 'Select...' },
                        ...(ingredients ?? []).map((i) => ({ value: i.id, label: i.name })),
                      ]}
                    />
                    <Input label="Qty" type="number" step="0.01" value={baseQty} onChange={(e) => setBaseQty(e.target.value)} />
                    <Select label="Unit" value={baseUnit} onChange={(e) => setBaseUnit(e.target.value as IngredientUnit)} options={[
                      { value: 'g', label: 'g' }, { value: 'kg', label: 'kg' },
                      { value: 'ml', label: 'ml' }, { value: 'l', label: 'l' }, { value: 'unit', label: 'unit' },
                    ]} />
                    <Select label="Scaling" value={baseScaling} onChange={(e) => setBaseScaling(e.target.value as RecipeScalingMode)} options={[
                      { value: 'proportional', label: 'Proportional' },
                      { value: 'fixed', label: 'Fixed' },
                    ]} />
                    <Button type="submit" disabled={!baseIngId}>Add</Button>
                  </form>
                )}

                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="py-2 text-left">Ingredient</th>
                      <th className="py-2 text-right">Qty</th>
                      <th className="py-2 text-left">Scaling</th>
                      <th className="py-2 text-right">Cost</th>
                      {isCurrentEditable && <th className="py-2" />}
                    </tr>
                  </thead>
                  <tbody>
                    {(activeVersion.product_base_recipe_ingredients ?? []).length === 0 ? (
                      <tr><td colSpan={5} className="py-6 text-center text-fg-muted">Add ingredients to your base recipe</td></tr>
                    ) : (
                      (activeVersion.product_base_recipe_ingredients ?? []).map((line) => (
                        <tr key={line.id} className="border-b">
                          <td className="py-2">
                            {line.ingredient_id ? (
                              <Link
                                to={`/ingredients/${line.ingredient_id}`}
                                className="text-accent hover:underline"
                              >
                                {line.ingredient?.name}
                              </Link>
                            ) : (
                              line.ingredient?.name
                            )}
                          </td>
                          <td className="py-2 text-right">{line.quantity_used} {line.unit}</td>
                          <td className="py-2 capitalize">{line.scaling_mode}</td>
                          <td className="py-2 text-right text-accent">
                            {formatCurrency(line.calculated_cost, currency)}
                          </td>
                          {isCurrentEditable && (
                            <td className="py-2 text-right">
                              <Button variant="ghost" size="sm" onClick={() =>
                                removeBaseIng.mutate({ id: line.id, versionId: activeVersion.id, productId: product.id })
                              }>
                                <Trash2 className="h-4 w-4 text-red-500" />
                              </Button>
                            </td>
                          )}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </>
            )}
          </div>
        )}
      </TabPanel>

      <TabPanel active={tab} id="varieties">
        <div className="mb-4 flex justify-between">
          <p className="text-sm text-fg-muted">
            {canCreateVariety
              ? 'Create varieties from the base recipe or copy an existing variety. Set packaging, labour, and shipping when creating or editing.'
              : 'Add a base recipe or create a first variety before adding more'}
          </p>
          <Button
            disabled={!canCreateVariety}
            onClick={() => { setEditing(undefined); setFormOpen(true) }}
          >
            <Plus className="h-4 w-4" /> Create Variety
          </Button>
        </div>
        <div className="overflow-hidden rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-surface-muted">
                <th className="px-4 py-3 text-left">Variety</th>
                <th className="px-4 py-3 text-left">Size</th>
                <th className="px-4 py-3 text-right">Factor</th>
                <th className="px-4 py-3 text-right">Selling</th>
                <th className="px-4 py-3 text-right">Pack</th>
                <th className="px-4 py-3 text-right">Labour</th>
                <th className="px-4 py-3 text-right">Ship</th>
                <th className="px-4 py-3 text-right">Total Cost</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {varieties.length === 0 ? (
                <tr><td colSpan={9} className="px-4 py-8 text-center text-fg-muted">No varieties yet</td></tr>
              ) : (
                varieties.map((v) => (
                  <tr key={v.id} className="border-b border-border">
                    <td className="px-4 py-3 font-medium">
                      {v.variety_name}
                      {v.has_manual_recipe_overrides && (
                        <span className="ml-2 text-xs text-warning-secondary">modified</span>
                      )}
                    </td>
                    <td className="px-4 py-3">{v.size_label || '—'}</td>
                    <td className="px-4 py-3 text-right">{v.base_recipe_factor}</td>
                    <td className="px-4 py-3 text-right">{formatCurrency(v.selling_price, currency)}</td>
                    <td className="px-4 py-3 text-right text-fg-secondary">{formatCurrency(v.packaging_cost, currency)}</td>
                    <td className="px-4 py-3 text-right text-fg-secondary">{formatCurrency(v.labour_cost, currency)}</td>
                    <td className="px-4 py-3 text-right text-fg-secondary">{formatCurrency(v.shipping_cost ?? 0, currency)}</td>
                    <td className="px-4 py-3 text-right text-accent">{formatCurrency(v.current_cost_price, currency)}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <Link to={`/products/${product.id}/varieties/${v.id}`}>
                          <Button variant="outline" size="sm">Open <ChevronRight className="h-4 w-4" /></Button>
                        </Link>
                        <Button variant="ghost" size="sm" onClick={() => { setEditing(v); setFormOpen(true) }}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(v)}>
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
      </TabPanel>

      <VarietyFormDialog
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditing(undefined) }}
        productId={product.id}
        variety={editing}
        baseLines={baseLines}
        varieties={varieties}
      />

      <Dialog open={showNewVersion} onClose={() => setShowNewVersion(false)} title="Save as new version">
        <div className="space-y-4">
          <Input label="Version name" value={newVersionName} onChange={(e) => setNewVersionName(e.target.value)} placeholder="e.g. Reduced Biscuit Base" />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setShowNewVersion(false)}>Cancel</Button>
            <Button
              onClick={async () => {
                await saveVersion.mutateAsync({ productId: product.id, name: newVersionName })
                setNewVersionName('')
                setShowNewVersion(false)
              }}
              disabled={!newVersionName.trim()}
            >
              Save
            </Button>
          </div>
        </div>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(undefined)}
        onConfirm={async () => {
          if (deleteTarget) {
            await deleteMutation.mutateAsync({ id: deleteTarget.id, productId: product.id })
            setDeleteTarget(undefined)
          }
        }}
        title="Delete Variety"
        message={`Delete "${deleteTarget?.variety_name}"?`}
        loading={deleteMutation.isPending}
      />
    </div>
  )
}
