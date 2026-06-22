import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Plus, Trash2, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { CostDisplay } from '@/components/ui/StatCard'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { PageLoader } from '@/components/ui/LoadingSpinner'
import { ConfirmDialog, Dialog } from '@/components/ui/Dialog'
import { Tabs, TabPanel } from '@/components/ui/Tabs'
import { HistoryLineChart } from '@/components/history/HistoryLineChart'
import {
  useVariety,
  useVarietyCostHistory,
  useVarietySellingPriceHistory,
  useAddVarietyIngredient,
  useUpdateVarietyIngredient,
  useRemoveVarietyIngredient,
  useRefreshVarietyFromBaseRecipe,
  useSetVarietyLocks,
  useUpdateVariety,
  useLatestAcceptance,
  useAcceptanceHistory,
  useAcceptVarietyCost,
  useAcceptVarietyAndReprice,
} from '@/hooks/useProducts'
import { useIngredients } from '@/hooks/useIngredients'
import { useSettings } from '@/hooks/useSettings'
import { calculateVarietyCost } from '@/lib/costCalculations'
import { mapVarietyToForm } from '@/lib/varietyForm'
import { VarietyCostBreakdownCard } from '@/components/products/VarietyCostBreakdownCard'
import { GrossMarginCard } from '@/components/products/GrossMarginCard'
import { VarietyAcceptancePanel } from '@/components/products/VarietyAcceptancePanel'
import { AcceptVarietyDialog } from '@/components/products/AcceptVarietyDialog'
import { ACCEPTANCE_REASON_OPTIONS } from '@/types/database'
import { isCostLocked, isPriceLocked } from '@/lib/varietyLocks'
import { formatCurrency, formatUnitCost, formatDate, formatDateTime } from '@/lib/utils'
import { getVarietyReviewStatus } from '@/lib/bufferStatus'
import type { CostStatus, IngredientUnit } from '@/types/database'

function worstReviewStatus(a: CostStatus, b: CostStatus): CostStatus {
  if (a === 'red' || b === 'red') return 'red'
  if (a === 'amber' || b === 'amber') return 'amber'
  return 'green'
}

export function VarietyDetailPage() {
  const { productId, varietyId } = useParams<{ productId: string; varietyId: string }>()
  const { data: variety, isLoading } = useVariety(varietyId!)
  const { data: latestAcceptance } = useLatestAcceptance(varietyId!)
  const { data: acceptanceHistory } = useAcceptanceHistory(varietyId!)
  const { data: costHistory } = useVarietyCostHistory(varietyId!)
  const { data: sellingHistory } = useVarietySellingPriceHistory(varietyId!)
  const { data: ingredients } = useIngredients()
  const { data: settings } = useSettings()

  const addMutation = useAddVarietyIngredient()
  const removeMutation = useRemoveVarietyIngredient()
  const updateMutation = useUpdateVarietyIngredient()
  const refreshMutation = useRefreshVarietyFromBaseRecipe()
  const lockMutation = useSetVarietyLocks()
  const updateVarietyMutation = useUpdateVariety()
  const acceptCostMutation = useAcceptVarietyCost()
  const acceptRepriceMutation = useAcceptVarietyAndReprice()

  const [acceptMode, setAcceptMode] = useState<'cost' | 'reprice' | null>(null)

  const [tab, setTab] = useState('overview')
  const [selectedIngredient, setSelectedIngredient] = useState('')
  const [quantity, setQuantity] = useState('')
  const [unit, setUnit] = useState<IngredientUnit>('g')
  const [removeTarget, setRemoveTarget] = useState<{ id: string; name: string } | null>(null)
  const [refreshOpen, setRefreshOpen] = useState(false)
  const [refreshFactor, setRefreshFactor] = useState('1')
  const [priceLockUntil, setPriceLockUntil] = useState('')
  const [costLockUntil, setCostLockUntil] = useState('')
  const [packagingCost, setPackagingCost] = useState('')
  const [labourCost, setLabourCost] = useState('')
  const [shippingCost, setShippingCost] = useState('')

  const currency = settings?.currency ?? '£'
  const taxPercentage = settings?.tax_percentage ?? 0

  if (isLoading || !variety) return <PageLoader />

  const product = variety.product
  const displayName = [variety.size_label, product?.name].filter(Boolean).join(' ')
  const breakdown = calculateVarietyCost(
    variety.product_variety_ingredients,
    variety.packaging_cost,
    variety.labour_cost,
    variety.shipping_cost ?? 0,
    variety.selling_price,
    variety.recipe_yield,
    taxPercentage
  )
  const review = getVarietyReviewStatus(variety, latestAcceptance)
  const positionStatus = review
    ? worstReviewStatus(review.costStatus, review.marginStatus)
    : null

  const usedIds = new Set(variety.product_variety_ingredients.map((i) => i.ingredient_id))
  const available = (ingredients ?? []).filter((i) => !usedIds.has(i.id))

  const costChart = [...(costHistory ?? [])].reverse().map((e) => ({
    date: formatDate(e.created_at),
    value: e.new_cost_price,
  }))
  const sellingChart = [...(sellingHistory ?? [])].reverse().map((e) => ({
    date: formatDate(e.created_at),
    value: e.new_selling_price,
  }))

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedIngredient || !quantity) return
    await addMutation.mutateAsync({
      varietyId: variety.id,
      ingredientId: selectedIngredient,
      quantityUsed: parseFloat(quantity),
      unit,
    })
    setSelectedIngredient('')
    setQuantity('')
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link to={`/products/${productId}`}>
          <Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4" /> Back</Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">{displayName || variety.variety_name}</h1>
          <p className="text-slate-500">{variety.variety_name}{variety.sku ? ` · ${variety.sku}` : ''}</p>
        </div>
      </div>

      <Tabs
        tabs={[
          { id: 'overview', label: 'Overview' },
          { id: 'recipe', label: 'Recipe' },
          { id: 'acceptance', label: 'Acceptance History' },
          { id: 'selling', label: 'Selling Price History' },
          { id: 'cost', label: 'Production Cost History' },
        ]}
        active={tab}
        onChange={setTab}
      />

      <TabPanel active={tab} id="overview">
        <div className="mb-4 flex flex-wrap gap-2">
          {positionStatus && <StatusBadge status={positionStatus} />}
          {isPriceLocked(variety) && variety.price_locked_until && (
            <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs text-emerald-800">
              Price protected until {formatDate(variety.price_locked_until)}
            </span>
          )}
        </div>
        <VarietyAcceptancePanel
          variety={variety}
          acceptance={latestAcceptance}
          currency={currency}
          onAcceptCost={() => setAcceptMode('cost')}
          onAcceptReprice={() => setAcceptMode('reprice')}
        />
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <CostDisplay label="Selling Price" amount={variety.selling_price} currency={currency} />
          <CostDisplay label="Total Cost" amount={breakdown.totalCost} currency={currency} highlight />
          <GrossMarginCard
            breakdown={breakdown}
            currency={currency}
            taxPercentage={taxPercentage}
          />
        </div>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <VarietyCostBreakdownCard
            breakdown={breakdown}
            currency={currency}
            taxPercentage={taxPercentage}
          />
          <Card>
            <CardHeader><CardTitle>Production overheads</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-slate-500">
                Fixed costs added on top of ingredients. Changes update total production cost and cost history.
              </p>
              <div className="grid gap-3 sm:grid-cols-3">
                <Input
                  label="Packaging"
                  type="number"
                  step="0.01"
                  value={packagingCost !== '' ? packagingCost : String(variety.packaging_cost)}
                  onChange={(e) => setPackagingCost(e.target.value)}
                />
                <Input
                  label="Labour"
                  type="number"
                  step="0.01"
                  value={labourCost !== '' ? labourCost : String(variety.labour_cost)}
                  onChange={(e) => setLabourCost(e.target.value)}
                />
                <Input
                  label="Shipping"
                  type="number"
                  step="0.01"
                  value={shippingCost !== '' ? shippingCost : String(variety.shipping_cost ?? 0)}
                  onChange={(e) => setShippingCost(e.target.value)}
                />
              </div>
              <Button
                onClick={async () => {
                  const form = mapVarietyToForm(variety)
                  await updateVarietyMutation.mutateAsync({
                    id: variety.id,
                    form: {
                      ...form,
                      packaging_cost: parseFloat(packagingCost || String(variety.packaging_cost)) || 0,
                      labour_cost: parseFloat(labourCost || String(variety.labour_cost)) || 0,
                      shipping_cost: parseFloat(shippingCost || String(variety.shipping_cost ?? 0)) || 0,
                    },
                  })
                  setPackagingCost('')
                  setLabourCost('')
                  setShippingCost('')
                }}
                loading={updateVarietyMutation.isPending}
              >
                Save overheads
              </Button>
            </CardContent>
          </Card>
        </div>
        <p className="mt-4 text-sm text-slate-500">
          Selling price history tracks catalogue price changes. Production cost history tracks ingredient, packaging, labour, and shipping changes — not selling price.
        </p>
        <Card className="mt-4">
          <CardHeader><CardTitle>Catalogue locks</CardTitle></CardHeader>
          <CardContent className="flex flex-wrap items-end gap-4">
            <Input label="Price locked until" type="date" value={priceLockUntil} onChange={(e) => setPriceLockUntil(e.target.value)} />
            <Input label="Cost locked until" type="date" value={costLockUntil} onChange={(e) => setCostLockUntil(e.target.value)} />
            <Button
              onClick={() =>
                lockMutation.mutate({
                  varietyId: variety.id,
                  form: {
                    price_locked_until: priceLockUntil ? new Date(priceLockUntil).toISOString() : null,
                    cost_locked_until: costLockUntil ? new Date(costLockUntil).toISOString() : null,
                  },
                })
              }
              loading={lockMutation.isPending}
            >
              Save locks
            </Button>
            {(isPriceLocked(variety) || isCostLocked(variety)) && (
              <Button
                variant="ghost"
                onClick={() =>
                  lockMutation.mutate({
                    varietyId: variety.id,
                    form: { price_locked_until: null, cost_locked_until: null },
                  })
                }
              >
                Clear locks
              </Button>
            )}
          </CardContent>
        </Card>
      </TabPanel>

      <TabPanel active={tab} id="recipe">
        {variety.created_from_base_recipe_at && (
          <div className="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-900/20 dark:text-amber-200">
            {variety.has_manual_recipe_overrides
              ? `Created from base recipe v${variety.source_recipe_version?.version_number ?? '?'} — may have manual changes.`
              : `Copied from base recipe (factor ${variety.base_recipe_factor}).`}
            <Button variant="outline" size="sm" className="ml-3" onClick={() => setRefreshOpen(true)}>
              <RefreshCw className="h-3 w-3" /> Refresh from Base Recipe
            </Button>
          </div>
        )}
        <Card>
          <CardContent className="space-y-4 pt-6">
            <form onSubmit={handleAdd} className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="flex-1">
                <Select
                  label="Ingredient"
                  value={selectedIngredient}
                  onChange={(e) => {
                    setSelectedIngredient(e.target.value)
                    const ing = ingredients?.find((i) => i.id === e.target.value)
                    if (ing) setUnit(ing.base_unit)
                  }}
                  options={[
                    { value: '', label: 'Select...' },
                    ...available.map((i) => ({
                      value: i.id,
                      label: `${i.name} (${formatUnitCost(i.active_vendor_price?.cost_per_base_unit ?? 0, currency)}/${i.base_unit})`,
                    })),
                  ]}
                />
              </div>
              <Input label="Quantity" type="number" step="0.01" value={quantity} onChange={(e) => setQuantity(e.target.value)} className="sm:w-28" />
              <Select label="Unit" value={unit} onChange={(e) => setUnit(e.target.value as IngredientUnit)} options={[
                { value: 'g', label: 'g' }, { value: 'kg', label: 'kg' },
                { value: 'ml', label: 'ml' }, { value: 'l', label: 'l' }, { value: 'unit', label: 'unit' },
              ]} />
              <Button type="submit" disabled={!selectedIngredient || !quantity} loading={addMutation.isPending}>
                <Plus className="h-4 w-4" /> Add
              </Button>
            </form>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="py-2 text-left">Ingredient</th>
                  <th className="py-2 text-right">Qty</th>
                  <th className="py-2 text-right">Cost</th>
                  <th className="py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {variety.product_variety_ingredients.length === 0 ? (
                  <tr><td colSpan={4} className="py-6 text-center text-slate-500">No ingredients</td></tr>
                ) : (
                  variety.product_variety_ingredients.map((item) => (
                    <tr key={item.id} className="border-b border-slate-100">
                      <td className="py-2 font-medium">
                        {item.ingredient_id ? (
                          <Link to={`/ingredients/${item.ingredient_id}`} className="text-emerald-600 hover:underline">
                            {item.ingredient?.name}
                          </Link>
                        ) : (
                          item.ingredient?.name
                        )}
                      </td>
                      <td className="py-2 text-right">
                        <input
                          type="number"
                          step="0.01"
                          defaultValue={item.quantity_used}
                          onBlur={(e) =>
                            updateMutation.mutate({
                              id: item.id,
                              quantityUsed: parseFloat(e.target.value),
                              unit: item.unit,
                              varietyId: variety.id,
                            })
                          }
                          className="w-20 rounded border px-2 py-1 text-right text-sm dark:border-slate-600 dark:bg-slate-800"
                        /> {item.unit}
                      </td>
                      <td className="py-2 text-right text-emerald-600">
                        {formatCurrency(item.calculated_cost, currency)}
                      </td>
                      <td className="py-2 text-right">
                        <Button variant="ghost" size="sm" onClick={() => setRemoveTarget({ id: item.id, name: item.ingredient?.name ?? '' })}>
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </TabPanel>

      <TabPanel active={tab} id="acceptance">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="py-2 text-left">Date</th>
              <th className="py-2 text-left">Reason</th>
              <th className="py-2 text-right">Cost</th>
              <th className="py-2 text-right">Price</th>
              <th className="py-2 text-right">Margin</th>
              <th className="py-2 text-right">Margin %</th>
              <th className="py-2 text-right">Buffer</th>
            </tr>
          </thead>
          <tbody>
            {(acceptanceHistory ?? []).length === 0 ? (
              <tr><td colSpan={7} className="py-6 text-center text-slate-500">No acceptance history</td></tr>
            ) : (
              (acceptanceHistory ?? []).map((a) => (
                <tr key={a.id} className="border-b">
                  <td className="py-2">{formatDateTime(a.accepted_at)}</td>
                  <td className="py-2">
                    {ACCEPTANCE_REASON_OPTIONS.find((o) => o.value === a.accepted_reason_type)?.label ?? a.accepted_reason_type}
                    {a.accepted_reason_notes && (
                      <span className="block text-slate-500">{a.accepted_reason_notes}</span>
                    )}
                  </td>
                  <td className="py-2 text-right">{formatCurrency(a.accepted_cost_price, currency)}</td>
                  <td className="py-2 text-right">{formatCurrency(a.accepted_selling_price, currency)}</td>
                  <td className="py-2 text-right">{formatCurrency(a.accepted_margin_value, currency)}</td>
                  <td className="py-2 text-right">{a.accepted_margin_percentage.toFixed(1)}%</td>
                  <td className="py-2 text-right">{a.buffer_percentage_at_time}%</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </TabPanel>

      <TabPanel active={tab} id="selling">
        <HistoryLineChart data={sellingChart} valueFormatter={(v) => formatCurrency(v, currency)} />
        <table className="mt-4 w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="py-2 text-left">Date</th>
              <th className="py-2 text-right">Previous</th>
              <th className="py-2 text-right">New</th>
              <th className="py-2 text-right">Change</th>
              <th className="py-2 text-left">Reason</th>
            </tr>
          </thead>
          <tbody>
            {(sellingHistory ?? []).length === 0 ? (
              <tr><td colSpan={5} className="py-6 text-center text-slate-500">No selling price changes</td></tr>
            ) : (
              (sellingHistory ?? []).map((e) => (
                <tr key={e.id} className="border-b">
                  <td className="py-2">{formatDateTime(e.created_at)}</td>
                  <td className="py-2 text-right">{formatCurrency(e.previous_selling_price, currency)}</td>
                  <td className="py-2 text-right">{formatCurrency(e.new_selling_price, currency)}</td>
                  <td className="py-2 text-right">{e.percentage_change.toFixed(2)}%</td>
                  <td className="py-2 text-slate-500">{e.reason ?? '—'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </TabPanel>

      <TabPanel active={tab} id="cost">
        <p className="mb-2 text-sm text-slate-500">Production cost changes from ingredients, packaging, labour, or shipping — not selling price.</p>
        <HistoryLineChart data={costChart} valueFormatter={(v) => formatCurrency(v, currency)} />
        <table className="mt-4 w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="py-2 text-left">Date</th>
              <th className="py-2 text-right">Previous</th>
              <th className="py-2 text-right">New</th>
              <th className="py-2 text-right">Change</th>
              <th className="py-2 text-left">Status</th>
              <th className="py-2 text-left">Reason</th>
            </tr>
          </thead>
          <tbody>
            {(costHistory ?? []).length === 0 ? (
              <tr><td colSpan={6} className="py-6 text-center text-slate-500">No cost changes</td></tr>
            ) : (
              (costHistory ?? []).map((e) => (
                <tr key={e.id} className="border-b">
                  <td className="py-2">{formatDateTime(e.created_at)}</td>
                  <td className="py-2 text-right">{formatCurrency(e.previous_cost_price, currency)}</td>
                  <td className="py-2 text-right">{formatCurrency(e.new_cost_price, currency)}</td>
                  <td className="py-2 text-right">{e.percentage_change.toFixed(2)}%</td>
                  <td className="py-2"><StatusBadge status={e.status} /></td>
                  <td className="py-2 text-slate-500">{e.reason}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </TabPanel>

      <Dialog open={refreshOpen} onClose={() => setRefreshOpen(false)} title="Refresh from Base Recipe">
        <p className="mb-4 text-sm text-slate-600">
          This will replace this variety recipe with the current product base recipe using the selected factor. Manual changes will be lost.
        </p>
        <Input label="Factor" type="number" step="0.1" value={refreshFactor} onChange={(e) => setRefreshFactor(e.target.value)} />
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setRefreshOpen(false)}>Cancel</Button>
          <Button
            variant="danger"
            loading={refreshMutation.isPending}
            onClick={async () => {
              await refreshMutation.mutateAsync({
                varietyId: variety.id,
                factor: parseFloat(refreshFactor) || 1,
              })
              setRefreshOpen(false)
            }}
          >
            Replace recipe
          </Button>
        </div>
      </Dialog>

      <ConfirmDialog
        open={Boolean(removeTarget)}
        onClose={() => setRemoveTarget(null)}
        onConfirm={async () => {
          if (removeTarget) {
            await removeMutation.mutateAsync({ id: removeTarget.id, varietyId: variety.id })
            setRemoveTarget(null)
          }
        }}
        title="Remove Ingredient"
        message={`Remove "${removeTarget?.name}"?`}
        confirmLabel="Remove"
        loading={removeMutation.isPending}
      />

      <AcceptVarietyDialog
        open={acceptMode !== null}
        onClose={() => setAcceptMode(null)}
        variety={variety}
        latestAcceptance={latestAcceptance}
        currency={currency}
        mode={acceptMode ?? 'cost'}
        loading={acceptCostMutation.isPending || acceptRepriceMutation.isPending}
        onAcceptCost={async (reasonType, notes) => {
          await acceptCostMutation.mutateAsync({
            varietyId: variety.id,
            form: {
              accepted_reason_type: reasonType,
              accepted_reason_notes: notes || undefined,
            },
          })
        }}
        onAcceptReprice={async (reasonType, notes, newSellingPrice) => {
          await acceptRepriceMutation.mutateAsync({
            varietyId: variety.id,
            form: {
              accepted_reason_type: reasonType,
              accepted_reason_notes: notes || undefined,
              new_selling_price: newSellingPrice,
            },
          })
        }}
      />
    </div>
  )
}
