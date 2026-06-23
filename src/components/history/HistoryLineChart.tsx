import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

export function HistoryLineChart({
  data,
  dataKey,
  valueFormatter,
}: {
  data: { date: string; value: number }[]
  dataKey?: string
  valueFormatter?: (v: number) => string
}) {
  if (data.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-fg-muted">No history to chart yet</p>
    )
  }

  const chartData = data.map((d) => ({ date: d.date, [dataKey ?? 'value']: d.value }))

  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
          <XAxis dataKey="date" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip
            formatter={(v) => {
              const n = typeof v === 'number' ? v : Number(v)
              return valueFormatter ? valueFormatter(n) : n.toFixed(2)
            }}
          />
          <Line
            type="monotone"
            dataKey={dataKey ?? 'value'}
            stroke="var(--theme-chart-line)"
            strokeWidth={2}
            dot={{ r: 3 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
