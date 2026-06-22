import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, Plus, Trash2 } from 'lucide-react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { CostDisplay } from '@/components/ui/StatCard'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { PageLoader } from '@/components/ui/LoadingSpinner'
import { ConfirmDialog } from '@/components/ui/Dialog'
import {
  useProduct,
  useCostHistory,
  useAddProductIngredient,
  useUpdateProductIngredient,
  useRemoveProductIngredient,
} from '@/hooks/useProducts'
import { useIngredients } from '@/hooks/useIngredients'
import { useSettings } from '@/hooks/useSettings'
import { calculateProductCost } from '@/lib/costCalculations'
import { formatCurrency, formatUnitCost, formatDate, formatDateTime } from '@/lib/utils'

export function ProductDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { data: product, isLoading } = useProduct(id!)
  const { data: costHistory } = useCostHistory(id!)
  const { data: ingredients } = useIngredients()
  const { data: settings } = useSettings()

  const addMutation = useAddProductIngredient()
  const removeMutation = useRemoveProductIngredient()
  const updateMutation = useUpdateProductIngredient()

  const [selectedIngredient, setSelectedIngredient] = useState('')
  const [quantity, setQuantity] = useState('')
  const [removeTarget, setRemoveTarget] = useState<{
    id: string
    name: string
  } | null>(null)

  const currency = settings?.currency ?? '£'

  if (isLoading || !product) return <PageLoader />

  const breakdown = calculateProductCost(
    product.product_ingredients,
    product.buffer_percentage,
    product.units_per_batch,
    settings
  )

  const usedIngredientIds = new Set(
    product.product_ingredients.map((pi) => pi.ingredient_id)
  )
  const availableIngredients = (ingredients ?? []).filter(
    (i) => !usedIngredientIds.has(i.id)
  )

  const chartData = [...(costHistory ?? [])]
    .reverse()
    .map((entry) => ({
      date: formatDate(entry.created_at),
      cost: entry.new_cost,
      change: entry.percentage_change,
    }))

  const handleAddIngredient = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedIngredient || !quantity) return
    await addMutation.mutateAsync({
      productId: product.id,
      ingredientId: selectedIngredient,
      quantityUsed: parseFloat(quantity),
    })
    setSelectedIngredient('')
    setQuantity('')
  }

  const handleQuantityChange = (itemId: string, newQty: number) => {
    if (newQty > 0) {
      updateMutation.mutate({
        id: itemId,
        quantityUsed: newQty,
        productId: product.id,
      })
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link to="/products">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            {product.name}
          </h1>
          {product.description && (
            <p className="text-slate-500">{product.description}</p>
          )}
        </div>
      </div>

      {/* Cost Calculator */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <CostDisplay
          label="Cost Price"
          amount={breakdown.costPrice}
          currency={currency}
        />
        <CostDisplay
          label="Buffered Cost"
          amount={breakdown.bufferedCost}
          currency={currency}
          highlight
        />
        <CostDisplay
          label="Cost Per Unit"
          amount={breakdown.costPerUnit}
          currency={currency}
        />
        <CostDisplay
          label="Ingredient Cost"
          amount={breakdown.ingredientCost}
          currency={currency}
        />
      </div>

      {/* Recipe Builder */}
      <Card>
        <CardHeader>
          <CardTitle>Recipe Builder</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form
            onSubmit={handleAddIngredient}
            className="flex flex-col gap-3 sm:flex-row sm:items-end"
          >
            <div className="flex-1">
              <Select
                label="Ingredient"
                value={selectedIngredient}
                onChange={(e) => setSelectedIngredient(e.target.value)}
                options={[
                  { value: '', label: 'Select ingredient...' },
                  ...availableIngredients.map((i) => ({
                    value: i.id,
                    label: `${i.name} (${formatUnitCost(i.unit_cost, currency)}/${i.unit})`,
                  })),
                ]}
              />
            </div>
            <div className="w-full sm:w-32">
              <Input
                label="Quantity"
                type="number"
                step="0.01"
                min="0.01"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
            </div>
            <Button
              type="submit"
              disabled={!selectedIngredient || !quantity}
              loading={addMutation.isPending}
            >
              <Plus className="h-4 w-4" />
              Add
            </Button>
          </form>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700">
                  <th className="px-3 py-2 text-left">Ingredient</th>
                  <th className="px-3 py-2 text-right">Qty</th>
                  <th className="px-3 py-2 text-right">Unit Cost</th>
                  <th className="px-3 py-2 text-right">Contribution</th>
                  <th className="px-3 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {product.product_ingredients.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-6 text-center text-slate-500">
                      No ingredients in recipe yet
                    </td>
                  </tr>
                ) : (
                  product.product_ingredients.map((item) => {
                    const unitCost = item.ingredient?.unit_cost ?? 0
                    const contribution = item.quantity_used * unitCost
                    return (
                      <tr
                        key={item.id}
                        className="border-b border-slate-100 dark:border-slate-800"
                      >
                        <td className="px-3 py-2 font-medium">
                          {item.ingredient?.name ?? 'Unknown'}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <input
                            type="number"
                            step="0.01"
                            min="0.01"
                            defaultValue={item.quantity_used}
                            onBlur={(e) =>
                              handleQuantityChange(
                                item.id,
                                parseFloat(e.target.value)
                              )
                            }
                            className="w-20 rounded border border-slate-300 px-2 py-1 text-right text-sm dark:border-slate-600 dark:bg-slate-800"
                          />{' '}
                          {item.ingredient?.unit}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {formatUnitCost(unitCost, currency)}
                        </td>
                        <td className="px-3 py-2 text-right font-medium text-emerald-600">
                          {formatCurrency(contribution, currency)}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              setRemoveTarget({
                                id: item.id,
                                name: item.ingredient?.name ?? 'ingredient',
                              })
                            }
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
              {product.product_ingredients.length > 0 && (
                <tfoot>
                  <tr className="font-semibold">
                    <td colSpan={3} className="px-3 py-2 text-right">
                      Total Ingredient Cost
                    </td>
                    <td className="px-3 py-2 text-right text-emerald-600">
                      {formatCurrency(breakdown.ingredientCost, currency)}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Cost History */}
      <Card>
        <CardHeader>
          <CardTitle>Cost History</CardTitle>
        </CardHeader>
        <CardContent>
          {chartData.length > 0 && (
            <div className="mb-6 h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-700" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                  <YAxis
                    tick={{ fontSize: 12 }}
                    tickFormatter={(v) => `${currency}${v}`}
                  />
                  <Tooltip
                    formatter={(value) => [
                      formatCurrency(Number(value), currency),
                      'Cost',
                    ]}
                  />
                  <Line
                    type="monotone"
                    dataKey="cost"
                    stroke="#16a34a"
                    strokeWidth={2}
                    dot={{ r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700">
                  <th className="px-3 py-2 text-left">Date</th>
                  <th className="px-3 py-2 text-right">Previous</th>
                  <th className="px-3 py-2 text-right">New</th>
                  <th className="px-3 py-2 text-right">Change</th>
                  <th className="px-3 py-2 text-left">Status</th>
                </tr>
              </thead>
              <tbody>
                {(costHistory ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-6 text-center text-slate-500">
                      No cost changes recorded yet
                    </td>
                  </tr>
                ) : (
                  (costHistory ?? []).map((entry) => (
                    <tr
                      key={entry.id}
                      className="border-b border-slate-100 dark:border-slate-800"
                    >
                      <td className="px-3 py-2">
                        {formatDateTime(entry.created_at)}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {formatCurrency(entry.previous_cost, currency)}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {formatCurrency(entry.new_cost, currency)}
                      </td>
                      <td
                        className={`px-3 py-2 text-right font-medium ${
                          entry.percentage_change > 0
                            ? 'text-red-600'
                            : 'text-emerald-600'
                        }`}
                      >
                        {entry.percentage_change > 0 ? '+' : ''}
                        {entry.percentage_change.toFixed(2)}%
                      </td>
                      <td className="px-3 py-2">
                        <StatusBadge status={entry.status} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={Boolean(removeTarget)}
        onClose={() => setRemoveTarget(null)}
        onConfirm={async () => {
          if (removeTarget) {
            await removeMutation.mutateAsync({
              id: removeTarget.id,
              productId: product.id,
            })
            setRemoveTarget(null)
          }
        }}
        title="Remove Ingredient"
        message={`Remove "${removeTarget?.name}" from this recipe?`}
        confirmLabel="Remove"
        loading={removeMutation.isPending}
      />
    </div>
  )
}
