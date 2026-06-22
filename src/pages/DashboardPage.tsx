import { Link } from 'react-router-dom'
import {
  Carrot,
  Package,
  AlertTriangle,
  AlertCircle,
} from 'lucide-react'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { StatCard } from '@/components/ui/StatCard'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { PageLoader } from '@/components/ui/LoadingSpinner'
import { useDashboardData } from '@/hooks/useDashboard'
import { useSettings } from '@/hooks/useSettings'
import { formatCurrency, formatUnitCost, formatDate } from '@/lib/utils'

export function DashboardPage() {
  const { stats, recentIngredients, reviewProducts, costHistory, isLoading } =
    useDashboardData()
  const { data: settings } = useSettings()
  const currency = settings?.currency ?? '£'

  if (isLoading) return <PageLoader />

  const trendData = [...costHistory]
    .reverse()
    .slice(-20)
    .map((entry) => ({
      date: formatDate(entry.created_at),
      cost: entry.new_cost,
      product: entry.product?.name ?? 'Unknown',
    }))

  const movementData = Object.values(
    costHistory.reduce<
      Record<string, { name: string; changes: number; totalChange: number }>
    >((acc, entry) => {
      const name = entry.product?.name ?? 'Unknown'
      if (!acc[name]) {
        acc[name] = { name, changes: 0, totalChange: 0 }
      }
      acc[name].changes += 1
      acc[name].totalChange += Math.abs(entry.percentage_change)
      return acc
    }, {})
  )
    .sort((a, b) => b.totalChange - a.totalChange)
    .slice(0, 8)

  const hasAlerts =
    stats.productsOverBuffer > 0 || stats.productsNearBuffer > 0

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
          Dashboard
        </h1>
        <p className="text-slate-500 dark:text-slate-400">
          Overview of costs and products requiring attention
        </p>
      </div>

      {hasAlerts && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-900/20">
          <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300">
            <AlertTriangle className="h-5 w-5" />
            <span className="font-medium">Cost alerts require your attention</span>
          </div>
          <p className="mt-1 text-sm text-amber-700 dark:text-amber-400">
            {stats.productsOverBuffer > 0 &&
              `${stats.productsOverBuffer} product(s) over buffer. `}
            {stats.productsNearBuffer > 0 &&
              `${stats.productsNearBuffer} product(s) near buffer threshold.`}
          </p>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Ingredients"
          value={stats.totalIngredients}
          icon={Carrot}
        />
        <StatCard
          title="Total Products"
          value={stats.totalProducts}
          icon={Package}
        />
        <StatCard
          title="Products Over Buffer"
          value={stats.productsOverBuffer}
          icon={AlertCircle}
          variant="danger"
        />
        <StatCard
          title="Products Near Buffer"
          value={stats.productsNearBuffer}
          icon={AlertTriangle}
          variant="warning"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Cost Trends</CardTitle>
          </CardHeader>
          <CardContent>
            {trendData.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-500">
                No cost history data yet
              </p>
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis
                      tick={{ fontSize: 11 }}
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
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Product Cost Movement</CardTitle>
          </CardHeader>
          <CardContent>
            {movementData.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-500">
                No movement data yet
              </p>
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={movementData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis
                      type="category"
                      dataKey="name"
                      tick={{ fontSize: 11 }}
                      width={100}
                    />
                    <Tooltip />
                    <Bar dataKey="totalChange" fill="#16a34a" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recently Updated Ingredients</CardTitle>
          </CardHeader>
          <CardContent>
            {recentIngredients.length === 0 ? (
              <p className="text-sm text-slate-500">No ingredients yet</p>
            ) : (
              <div className="space-y-3">
                {recentIngredients.map((ing) => (
                  <div
                    key={ing.id}
                    className="flex items-center justify-between rounded-lg border border-slate-100 p-3 dark:border-slate-800"
                  >
                    <div>
                      <p className="font-medium">{ing.name}</p>
                      <p className="text-sm text-slate-500">
                        {ing.supplier || 'No supplier'}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-emerald-600">
                        {formatUnitCost(ing.unit_cost, currency)}
                      </p>
                      <p className="text-xs text-slate-400">
                        {formatDate(ing.last_updated)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Products Requiring Review</CardTitle>
          </CardHeader>
          <CardContent>
            {reviewProducts.length === 0 ? (
              <p className="text-sm text-slate-500">
                All products within buffer thresholds
              </p>
            ) : (
              <div className="space-y-3">
                {reviewProducts.map((product) => (
                  <Link
                    key={product.id}
                    to={`/products/${product.id}`}
                    className="flex items-center justify-between rounded-lg border border-slate-100 p-3 transition-colors hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/50"
                  >
                    <div>
                      <p className="font-medium">{product.name}</p>
                      <p className="text-sm text-slate-500">
                        {formatCurrency(product.current_cost_price, currency)}
                      </p>
                    </div>
                    {product.latest_status && (
                      <StatusBadge
                        status={
                          product.latest_status as 'green' | 'amber' | 'red'
                        }
                      />
                    )}
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
