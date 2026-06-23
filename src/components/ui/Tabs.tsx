import { cn } from '@/lib/utils'
import { theme } from '@/lib/theme'

export function Tabs({
  tabs,
  active,
  onChange,
}: {
  tabs: { id: string; label: string }[]
  active: string
  onChange: (id: string) => void
}) {
  return (
    <div className="border-b border-border">
      <nav className="-mb-px flex gap-1 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={cn(
              'whitespace-nowrap border-b-2 px-4 py-2 text-sm font-medium transition-colors',
              active === tab.id ? theme.tabActive : theme.tabInactive
            )}
          >
            {tab.label}
          </button>
        ))}
      </nav>
    </div>
  )
}

export function TabPanel({
  active,
  id,
  children,
}: {
  active: string
  id: string
  children: React.ReactNode
}) {
  if (active !== id) return null
  return <div className="pt-4">{children}</div>
}
