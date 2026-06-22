import { cn } from '@/lib/utils'

const SLIDER_MAX = 50

export function BufferSlider({
  label,
  value,
  onChange,
  min = 0,
  step = 0.5,
  inputMax = 100,
}: {
  label: string
  value: number
  onChange: (value: number) => void
  min?: number
  step?: number
  inputMax?: number
}) {
  const showSlider = value <= SLIDER_MAX
  const sliderValue = Math.min(value, SLIDER_MAX)

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
          {label}
        </label>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={min}
            max={inputMax}
            step={step}
            value={value}
            onChange={(e) => {
              const next = parseFloat(e.target.value)
              onChange(Number.isFinite(next) ? next : 0)
            }}
            className="w-16 rounded border border-slate-300 px-2 py-1 text-right text-sm dark:border-slate-600 dark:bg-slate-900"
          />
          <span className="text-sm text-slate-500">%</span>
        </div>
      </div>
      {showSlider ? (
        <input
          type="range"
          min={min}
          max={SLIDER_MAX}
          step={step}
          value={sliderValue}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className={cn(
            'h-2 w-full cursor-pointer appearance-none rounded-lg',
            'bg-slate-200 dark:bg-slate-700',
            '[&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4',
            '[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full',
            '[&::-webkit-slider-thumb]:bg-emerald-600'
          )}
        />
      ) : (
        <p className="text-xs text-slate-500">
          Above {SLIDER_MAX}% — adjust using the number field only
        </p>
      )}
    </div>
  )
}
