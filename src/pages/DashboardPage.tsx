import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Carrot,
  Package,
  AlertTriangle,
  AlertCircle,
  Search,
  FileDown,
} from 'lucide-react'
import { toast } from 'sonner'
import { StatCard } from '@/components/ui/StatCard'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { Button } from '@/components/ui/Button'
import { PageLoader } from '@/components/ui/LoadingSpinner'
import { useDashboardData } from '@/hooks/useDashboard'
import { useSearchVarieties } from '@/hooks/useProducts'
import { useSettings, useCatalogueTemplate } from '@/hooks/useSettings'
import { formatCurrency, formatUnitCost } from '@/lib/utils'
import {
  generateCataloguePdf,
  searchResultsToCatalogueItems,
  downloadPdf,
} from '@/services/cataloguePdf'

export function DashboardPage() {
  const { stats, recentIngredients, reviewVarieties, isLoading } =
    useDashboardData()
  const { data: settings } = useSettings()
  const { data: template } = useCatalogueTemplate()
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [generating, setGenerating] = useState(false)

  const { data: searchResults, isLoading: searchLoading } =
    useSearchVarieties(search)

  const currency = settings?.currency ?? '£'
  const results = searchResults ?? []

  if (isLoading) return <PageLoader />

  const hasAlerts = stats.productsOverBuffer > 0 || stats.productsNearBuffer > 0

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectAllVisible = () => {
    setSelected(new Set(results.map((r) => r.variety.id)))
  }

  const clearSelection = () => setSelected(new Set())

  const handleGeneratePdf = async () => {
    if (selected.size === 0) {
      toast.warning('No products selected — select varieties to include in the catalogue')
      return
    }
    if (!settings) return

    setGenerating(true)
    try {
      const selectedResults = results.filter((r) => selected.has(r.variety.id))
      const items = searchResultsToCatalogueItems(selectedResults)
      const bytes = await generateCataloguePdf(items, settings, template ?? null)
      downloadPdf(bytes, `${settings.catalogue_title || 'catalogue'}.pdf`)
      toast.success('Catalogue PDF generated')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to generate PDF')
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-slate-500">Search varieties and generate catalogues</p>
      </div>

      {hasAlerts && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-900/20">
          <div className="flex items-center gap-2 text-amber-800">
            <AlertTriangle className="h-5 w-5" />
            <span className="font-medium">Cost alerts require attention</span>
          </div>
          <p className="mt-1 text-sm text-amber-700">
            {stats.productsOverBuffer > 0 && `${stats.productsOverBuffer} over buffer. `}
            {stats.productsNearBuffer > 0 && `${stats.productsNearBuffer} near buffer.`}
          </p>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Link to="/ingredients">
          <StatCard title="Ingredients" value={stats.totalIngredients} icon={Carrot} />
        </Link>
        <StatCard title="Products" value={stats.totalProducts} icon={Package} />
        <StatCard title="Over Buffer" value={stats.productsOverBuffer} icon={AlertCircle} variant="danger" />
        <StatCard title="Near Buffer" value={stats.productsNearBuffer} icon={AlertTriangle} variant="warning" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Search & Catalogue</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search product, variety, size, SKU, category..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-10 pr-4 text-sm dark:border-slate-600 dark:bg-slate-900"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={selectAllVisible} disabled={results.length === 0}>
              Select all visible
            </Button>
            <Button variant="outline" size="sm" onClick={clearSelection} disabled={selected.size === 0}>
              Clear selection
            </Button>
            <Button size="sm" onClick={handleGeneratePdf} loading={generating}>
              <FileDown className="h-4 w-4" />
              Generate Catalogue PDF ({selected.size})
            </Button>
          </div>

          <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-slate-50 dark:bg-slate-800/50">
                  <th className="px-3 py-2 w-10"></th>
                  <th className="px-3 py-2 text-left">Product</th>
                  <th className="px-3 py-2 text-left">Variety</th>
                  <th className="px-3 py-2 text-left">Size</th>
                  <th className="px-3 py-2 text-right">Selling</th>
                  <th className="px-3 py-2 text-right">Cost</th>
                  <th className="px-3 py-2 text-right">Margin</th>
                  <th className="px-3 py-2 text-left">Status</th>
                </tr>
              </thead>
              <tbody>
                {searchLoading ? (
                  <tr><td colSpan={8} className="px-3 py-6 text-center text-slate-500">Searching...</td></tr>
                ) : results.length === 0 ? (
                  <tr><td colSpan={8} className="px-3 py-6 text-center text-slate-500">No results</td></tr>
                ) : (
                  results.map((r) => (
                    <tr key={r.variety.id} className="border-b border-slate-100 dark:border-slate-800">
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          checked={selected.has(r.variety.id)}
                          onChange={() => toggleSelect(r.variety.id)}
                        />
                      </td>
                      <td className="px-3 py-2 font-medium">{r.product.name}</td>
                      <td className="px-3 py-2">{r.variety.variety_name}</td>
                      <td className="px-3 py-2">{r.variety.size_label || '—'}</td>
                      <td className="px-3 py-2 text-right">{formatCurrency(r.variety.selling_price, currency)}</td>
                      <td className="px-3 py-2 text-right">{formatCurrency(r.variety.current_cost_price, currency)}</td>
                      <td className="px-3 py-2 text-right">{formatCurrency(r.variety.gross_margin, currency)}</td>
                      <td className="px-3 py-2">
                        {r.latestStatus ? <StatusBadge status={r.latestStatus} /> : '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Recently Updated Ingredients</CardTitle></CardHeader>
          <CardContent>
            {recentIngredients.length === 0 ? (
              <p className="text-sm text-slate-500">No ingredients yet</p>
            ) : (
              <div className="space-y-3">
                {recentIngredients.map((ing) => (
                  <Link
                    key={ing.id}
                    to={`/ingredients/${ing.id}`}
                    className="flex items-center justify-between rounded-lg border p-3 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                  >
                    <p className="font-medium">{ing.name}</p>
                    <p className="text-emerald-600">
                      {ing.active_vendor_price
                        ? formatUnitCost(ing.active_vendor_price.cost_per_base_unit, currency)
                        : '—'}
                    </p>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Varieties Requiring Review</CardTitle></CardHeader>
          <CardContent>
            {reviewVarieties.length === 0 ? (
              <p className="text-sm text-slate-500">All within buffer thresholds</p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-slate-50 dark:bg-slate-800/50">
                      <th className="px-3 py-2 text-left">Product</th>
                      <th className="px-3 py-2 text-left">Cost Status</th>
                      <th className="px-3 py-2 text-right">Margin Value</th>
                      <th className="px-3 py-2 text-right">Margin %</th>
                      <th className="px-3 py-2 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reviewVarieties.map((r) => (
                      <tr key={r.variety.id} className="border-b border-slate-100 dark:border-slate-800">
                        <td className="px-3 py-2">
                          <p className="font-medium">{r.displayName}</p>
                          <p className="text-xs text-slate-500">
                            {formatCurrency(r.variety.current_cost_price, currency)}
                          </p>
                        </td>
                        <td className="px-3 py-2">
                          {r.costStatus ? <StatusBadge status={r.costStatus} /> : '—'}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {r.marginValueDelta != null
                            ? `${r.marginValueDelta >= 0 ? '+' : ''}${formatCurrency(r.marginValueDelta, currency)}`
                            : '—'}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {r.marginPpDelta != null
                            ? `${r.marginPpDelta >= 0 ? '+' : ''}${r.marginPpDelta.toFixed(1)}pp`
                            : '—'}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <Link to={`/products/${r.product.id}/varieties/${r.variety.id}`}>
                            <Button variant="outline" size="sm">Open</Button>
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
