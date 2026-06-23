import { cn } from '@/lib/utils'
import { theme } from '@/lib/theme'
import { type SelectHTMLAttributes, forwardRef } from 'react'

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
  options: { value: string; label: string }[]
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, error, id, options, ...props }, ref) => {
    const selectId = id || label?.toLowerCase().replace(/\s+/g, '-')

    return (
      <div className="space-y-1.5">
        {label && (
          <label htmlFor={selectId} className={theme.label}>
            {label}
          </label>
        )}
        <select
          ref={ref}
          id={selectId}
          className={cn(theme.input, error && 'border-danger', className)}
          {...props}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        {error && <p className={theme.fieldError}>{error}</p>}
      </div>
    )
  }
)

Select.displayName = 'Select'
