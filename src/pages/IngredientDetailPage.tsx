import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { Button } from '@/components/ui/Button'
import { BufferSlider } from '@/components/ui/BufferSlider'
import { Card, CardContent } from '@/components/ui/Card'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { PageLoader } from '@/components/ui/LoadingSpinner'
import { Tabs, TabPanel } from '@/components/ui/Tabs'
import { HistoryLineChart } from '@/components/history/HistoryLineChart'
import { VendorPricesSection } from '@/components/ingredients/VendorPricesSection'
import {
  useIngredient,
  useUpdateIngredient,
  useIngredientVendorPriceHistory,
  useProductsUsingIngredient,
  useIngredientPriceImpact,
} from '@/hooks/useIngredients'
import { useSettings } from '@/hooks/useSettings'
import type { IngredientFormData, IngredientUsedInVariety } from '@/types/database'
import { formatUnitCost, formatDateTime, formatCurrency, formatDate } from '@/lib/utils'

export function IngredientDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { data: ingredient, isLoading } = useIngredient(id!)
  const { data: usedIn } = useProductsUsingIngredient(id!)
  const { data: settings } = useSettings()
  const { register, handleSubmit, watch, setValue, reset } = useForm<IngredientFormData>()
  const updateMutation = useUpdateIngredient()
  const { data: impact } = useIngredientPriceImpact(id!)

  const [tab, setTab] = useState('suppliers')
  const [vendorFilter, setVendorFilter] = useState('')

  const { data: history, isLoading: historyLoading } = useIngredientVendorPriceHistory(id!, {
    enabled: tab === 'history',
  })

  useEffect(() => {
    if (ingredient) {
      reset({
        name: ingredient.name,
        base_unit: ingredient.base_unit,
        default_buffer_percentage: ingredient.default_buffer_percentage,
        notes: ingredient.notes || '',
      })
    }
  }, [ingredient, reset])

  const bufferValue = watch('default_buffer_percentage') ?? ingredient?.default_buffer_percentage ?? 5

  if (isLoading || !ingredient) return <PageLoader />

  const currency = settings?.currency ?? '£'
  const vendors = [...new Set((history ?? []).map((h) => h.vendor_name).filter(Boolean))] as string[]
  const filteredHistory = (history ?? []).filter(
    (h) => !vendorFilter || h.vendor_name === vendorFilter
  )
  const chartData = [...filteredHistory].reverse().map((h) => ({
    date: formatDate(h.created_at),
    value: h.new_cost_per_base_unit,
  }))

  const onSubmit = async (form: IngredientFormData) => {
    await updateMutation.mutateAsync({
      id: ingredient.id,
      form,
      version: ingredient.version,
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link to="/ingredients">
          <Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4" /> Back</Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">{ingredient.name}</h1>
          <p className="text-slate-500">Base unit: {ingredient.base_unit}</p>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <BufferSlider
              label="Supplier price buffer %"
              value={bufferValue}
              onChange={(v) => setValue('default_buffer_percentage', v)}
            />
            <p className="text-sm text-slate-500">
              Used for supplier price change alerts only — product costing uses each variety&apos;s own buffer.
            </p>
            <input type="hidden" {...register('name')} />
            <input type="hidden" {...register('base_unit')} />
            <input type="hidden" {...register('notes')} />
            <input type="hidden" {...register('default_buffer_percentage', { valueAsNumber: true })} />
            <Button type="submit" loading={updateMutation.isPending} size="sm">Save Buffer</Button>
          </form>
        </CardContent>
      </Card>

      <Tabs
        tabs={[
          { id: 'suppliers', label: 'Current Suppliers' },
          { id: 'history', label: 'Supplier Price History' },
          { id: 'products', label: 'Products Using Ingredient' },
          { id: 'impact', label: 'Price Impact Analysis' },
        ]}
        active={tab}
        onChange={setTab}
      />

      <TabPanel active={tab} id="suppliers">
        <VendorPricesSection ingredient={ingredient} />
      </TabPanel>

      <TabPanel active={tab} id="history">
        {historyLoading ? (
          <PageLoader />
        ) : (
          <>
            {vendors.length > 0 && (
              <select
                className="mb-4 rounded border px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-900"
                value={vendorFilter}
                onChange={(e) => setVendorFilter(e.target.value)}
              >
                <option value="">All suppliers</option>
                {vendors.map((v) => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
            )}
            <HistoryLineChart
              key={`history-chart-${filteredHistory.length}`}
              data={chartData}
              valueFormatter={(v) => formatUnitCost(v, currency)}
            />
            <table className="mt-4 w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="py-2 text-left">Date</th>
              <th className="py-2 text-left">Supplier</th>
              <th className="py-2 text-right">Pack</th>
              <th className="py-2 text-right">Prev cost</th>
              <th className="py-2 text-right">New cost</th>
              <th className="py-2 text-right">Change</th>
              <th className="py-2 text-left">Status</th>
            </tr>
          </thead>
          <tbody>
            {filteredHistory.length === 0 ? (
              <tr><td colSpan={7} className="py-6 text-center text-slate-500">No price changes</td></tr>
            ) : (
              filteredHistory.map((h) => (
                <tr key={h.id} className="border-b">
                  <td className="py-2">{formatDateTime(h.created_at)}</td>
                  <td className="py-2">{h.vendor_name ?? '—'}</td>
                  <td className="py-2 text-right">{h.pack_size}{h.pack_unit}</td>
                  <td className="py-2 text-right">{formatUnitCost(h.previous_cost_per_base_unit, currency)}</td>
                  <td className="py-2 text-right">{formatUnitCost(h.new_cost_per_base_unit, currency)}</td>
                  <td className="py-2 text-right">{h.percentage_change.toFixed(2)}%</td>
                  <td className="py-2"><StatusBadge status={h.status} /></td>
                </tr>
              ))
            )}
          </tbody>
        </table>
          </>
        )}
      </TabPanel>

      <TabPanel active={tab} id="products">
        <p className="mb-2 text-sm text-slate-500">
          {ingredient.name} — used in {(usedIn ?? []).length} recipe line(s)
        </p>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="py-2 text-left">Product</th>
              <th className="py-2 text-left">Variety</th>
              <th className="py-2 text-right">Quantity Used</th>
            </tr>
          </thead>
          <tbody>
            {(usedIn ?? []).length === 0 ? (
              <tr><td colSpan={3} className="py-6 text-center text-slate-500">Not used in any recipes yet</td></tr>
            ) : (
              (usedIn ?? []).map((row: IngredientUsedInVariety) => (
                <tr key={`${row.variety_id}-${row.quantity_used}`} className="border-b">
                  <td className="py-2">{row.product_name}</td>
                  <td className="py-2">
                    <Link
                      to={`/products/${row.product_id}/varieties/${row.variety_id}`}
                      className="text-emerald-600 hover:underline"
                    >
                      {row.size_label || row.variety_name}
                    </Link>
                  </td>
                  <td className="py-2 text-right">{row.quantity_used} {row.unit}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </TabPanel>

      <TabPanel active={tab} id="impact">
        <p className="mb-3 text-sm text-slate-500">
          Simulates applying the latest supplier price to this ingredient. Cost and margin statuses use each variety&apos;s buffer vs its latest acceptance snapshot.
        </p>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="py-2 text-left">Product</th>
              <th className="py-2 text-right">Qty</th>
              <th className="py-2 text-right">Old contrib.</th>
              <th className="py-2 text-right">New contrib.</th>
              <th className="py-2 text-right">Total before</th>
              <th className="py-2 text-right">Total after</th>
              <th className="py-2 text-left">Cost status</th>
              <th className="py-2 text-right">Margin value</th>
              <th className="py-2 text-right">Margin %</th>
            </tr>
          </thead>
          <tbody>
            {(impact ?? []).length === 0 ? (
              <tr><td colSpan={9} className="py-6 text-center text-slate-500">No products use this ingredient</td></tr>
            ) : (
              (impact ?? []).map((row) => (
                <tr key={row.variety_id} className="border-b">
                  <td className="py-2">
                    <Link
                      to={`/products/${row.product_id}/varieties/${row.variety_id}`}
                      className="text-emerald-600 hover:underline"
                    >
                      {row.product_name} {row.variety_label}
                    </Link>
                  </td>
                  <td className="py-2 text-right">{row.quantity_used} {row.unit}</td>
                  <td className="py-2 text-right">{formatCurrency(row.old_contribution, currency)}</td>
                  <td className="py-2 text-right">{formatCurrency(row.new_contribution, currency)}</td>
                  <td className="py-2 text-right">{formatCurrency(row.total_cost_before, currency)}</td>
                  <td className="py-2 text-right">{formatCurrency(row.total_cost_after, currency)}</td>
                  <td className="py-2"><StatusBadge status={row.cost_status} /></td>
                  <td className="py-2 text-right">
                    {row.margin_value_delta >= 0 ? '+' : ''}
                    {formatCurrency(row.margin_value_delta, currency)}
                  </td>
                  <td className="py-2 text-right">
                    {row.margin_pp_delta >= 0 ? '+' : ''}
                    {row.margin_pp_delta.toFixed(1)}pp
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </TabPanel>
    </div>
  )
}
