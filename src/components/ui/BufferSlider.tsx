import { cn } from '@/lib/utils'
import { theme } from '@/lib/theme'

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
        <label className={cn('text-sm font-medium', theme.textSecondary)}>{label}</label>
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
            className={cn(theme.inputInline, 'w-16 text-right')}
          />
          <span className={cn('text-sm', theme.textMuted)}>%</span>
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
            'h-2 w-full cursor-pointer appearance-none rounded-lg bg-border',
            '[&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4',
            '[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full',
            '[&::-webkit-slider-thumb]:bg-accent-solid'
          )}
        />
      ) : (
        <p className={cn('text-xs', theme.textMuted)}>
          Above {SLIDER_MAX}% — adjust using the number field only
        </p>
      )}
    </div>
  )
}
