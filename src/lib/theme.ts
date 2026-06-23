/**
 * Semantic theme class names — all light/dark switching lives in src/styles/theme.css.
 * Import these in components instead of pairing light + dark: Tailwind utilities.
 */
export const theme = {
  page: 'bg-page text-fg',
  pageShell: 'flex min-h-screen bg-page',
  authPage: 'flex min-h-screen items-center justify-center bg-page p-4',
  authCard: 'w-full max-w-md rounded-2xl border border-border bg-surface p-8 shadow-lg',
  sidebar: 'border-r border-border bg-elevated',
  sidebarFooter: 'border-t border-border',
  header: 'border-b border-border bg-elevated',
  main: 'flex-1 overflow-auto p-4 md:p-6 lg:p-8',

  // Typography
  heading: 'text-2xl font-bold text-fg',
  headingLg: 'text-lg font-semibold text-fg',
  headingBrand: 'font-bold text-accent',
  textMuted: 'text-fg-muted',
  textSecondary: 'text-fg-secondary',
  textSubtle: 'text-fg-subtle',
  textAccent: 'text-accent',
  textDanger: 'text-danger',
  textWarning: 'text-warning',

  // Surfaces
  surface: 'rounded-xl border border-border bg-surface shadow-sm',
  surfaceFlat: 'rounded-lg border border-border bg-surface',
  surfaceMuted: 'rounded-lg border border-border bg-surface-muted',
  surfaceHeader: 'border-b border-border',
  hoverRow: 'hover:bg-hover',

  // Tables
  tableWrap: 'overflow-hidden rounded-xl border border-border bg-surface',
  tableWrapScroll: 'overflow-x-auto rounded-lg border border-border',
  tableHead: 'border-b bg-surface-muted',
  tableRow: 'border-b border-border',
  tableRowSubtle: 'border-b border-border/60',
  tableEmpty: 'py-6 text-center text-fg-muted',

  // Forms
  input:
    'w-full rounded-lg border border-border-strong bg-input px-3 py-2 text-sm text-fg placeholder:text-fg-subtle focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20',
  inputInline:
    'rounded border border-border-strong bg-input px-2 py-1 text-sm text-fg',
  label: 'block text-sm font-medium text-fg-secondary',
  fieldError: 'text-sm text-danger',

  // Navigation
  navItem: 'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors text-fg-muted hover:bg-hover',
  navItemActive: 'bg-accent-muted text-accent-muted-fg',
  navIconBtn: 'rounded p-1 text-fg-muted hover:bg-hover hover:text-fg-secondary',

  // Links & actions
  link: 'text-accent hover:underline',
  linkBold: 'text-left font-semibold text-fg hover:text-accent',

  // Alerts
  alertWarning: 'rounded-xl border border-warning-border bg-warning-muted p-4',
  alertWarningInline: 'rounded-lg border border-warning-border bg-warning-muted p-3 text-sm text-warning',

  // Tabs
  tabActive: 'border-accent text-accent',
  tabInactive:
    'border-transparent text-fg-muted hover:border-border-strong hover:text-fg-secondary',

  // Badges
  badgeAccent: 'rounded-full bg-accent-muted px-2 py-1 text-xs text-accent-muted-fg',
  badgeModified: 'text-xs text-warning-secondary',

  // Buttons (supplement Button variants)
  iconDanger: 'text-danger hover:text-danger-hover',

  // Misc
  overlay: 'absolute inset-0 bg-black/50',
  focusRing:
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2',
} as const

export type ThemeClass = (typeof theme)[keyof typeof theme]

/** Cost-status badge colours (green / amber / red). */
export function statusBadgeClass(
  status: 'green' | 'amber' | 'red'
): string {
  switch (status) {
    case 'green':
      return 'bg-status-green-bg text-status-green-fg'
    case 'amber':
      return 'bg-status-amber-bg text-status-amber-fg'
    case 'red':
      return 'bg-status-red-bg text-status-red-fg'
  }
}
