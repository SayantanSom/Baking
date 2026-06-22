import { Link } from 'react-router-dom'
import { ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { RetailerPriceLookup } from '@/components/ingredients/RetailerPriceLookup'
import { useVendorPrices } from '@/hooks/useIngredients'
import { useSettings } from '@/hooks/useSettings'
import type { Ingredient } from '@/types/database'
import { formatCurrency, formatUnitCost } from '@/lib/utils'
import { convertToBaseUnit } from '@/lib/unitConversion'
import { openRetailerSearch } from '@/services/retailerUrls'

export function IngredientSupplierRows({ ingredient }: { ingredient: Ingredient }) {
  const { data: prices, isLoading } = useVendorPrices(ingredient.id, { enabled: true })
  const { data: settings } = useSettings()
  const currency = settings?.currency ?? '£'

  if (isLoading) {
    return (
      <tr className="border-b border-slate-100 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-800/30">
        <td colSpan={6} className="px-4 py-3 pl-12 text-sm text-slate-500">
          Loading suppliers…
        </td>
      </tr>
    )
  }

  const sorted = [...(prices ?? [])].sort(
    (a, b) => a.cost_per_base_unit - b.cost_per_base_unit
  )
  const cheapestId = sorted[0]?.id

  return (
    <tr className="border-b border-slate-100 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-800/30">
      <td colSpan={6} className="px-4 py-3">
        <div className="space-y-3 pl-8">
          <RetailerPriceLookup ingredientName={ingredient.name} />

          {sorted.length === 0 ? (
            <p className="text-sm text-slate-500">
              No suppliers yet.{' '}
              <Link
                to={`/ingredients/${ingredient.id}`}
                className="text-emerald-600 hover:underline"
              >
                Add supplier prices
              </Link>
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-slate-500 dark:border-slate-700">
                  <th className="py-1.5 pr-3 font-medium">Supplier</th>
                  <th className="py-1.5 pr-3 text-right font-medium">Pack</th>
                  <th className="py-1.5 pr-3 text-right font-medium">Price</th>
                  <th className="py-1.5 pr-3 text-right font-medium">
                    Cost/{ingredient.base_unit}
                  </th>
                  <th className="py-1.5 pr-3 font-medium">Active</th>
                  <th className="py-1.5 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((p) => {
                  let converted = p.pack_size
                  try {
                    converted = convertToBaseUnit(
                      p.pack_size,
                      p.pack_unit,
                      ingredient.base_unit
                    )
                  } catch {
                    /* keep pack_size */
                  }
                  const isCheapest = p.id === cheapestId
                  return (
                    <tr
                      key={p.id}
                      className={
                        isCheapest ? 'bg-emerald-50/50 dark:bg-emerald-900/10' : undefined
                      }
                    >
                      <td className="py-2 pr-3">
                        <span className="font-medium">{p.vendor_name}</span>
                        {isCheapest && (
                          <span className="ml-2 text-xs text-emerald-600">Best price</span>
                        )}
                      </td>
                      <td className="py-2 pr-3 text-right">
                        {p.pack_size}
                        {p.pack_unit}
                        <span className="block text-xs text-slate-400">
                          ({converted.toFixed(2)} {ingredient.base_unit})
                        </span>
                      </td>
                      <td className="py-2 pr-3 text-right">
                        {formatCurrency(p.pack_cost, currency)}
                      </td>
                      <td className="py-2 pr-3 text-right font-medium text-emerald-600">
                        {formatUnitCost(p.cost_per_base_unit, currency)}/{ingredient.base_unit}
                      </td>
                      <td className="py-2 pr-3">
                        {p.is_active && <StatusBadge status="green" label="Active" />}
                      </td>
                      <td className="py-2 text-right">
                        <div className="flex justify-end gap-1">
                          {p.product_url && (
                            <a href={p.product_url} target="_blank" rel="noreferrer">
                              <Button variant="ghost" size="sm">
                                <ExternalLink className="h-4 w-4" />
                              </Button>
                            </a>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              openRetailerSearch(p.vendor_name, ingredient.name)
                            }
                          >
                            Search
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}

          {sorted.length > 0 && (
            <Link
              to={`/ingredients/${ingredient.id}`}
              className="inline-block text-sm text-emerald-600 hover:underline"
            >
              Manage suppliers →
            </Link>
          )}
        </div>
      </td>
    </tr>
  )
}
