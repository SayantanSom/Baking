import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  Carrot,
  Package,
  Settings,
  LogOut,
  Moon,
  Sun,
  Menu,
  X,
  UserCheck,
} from 'lucide-react'
import { useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useTheme } from '@/contexts/ThemeContext'
import { usePendingAppUsers } from '@/hooks/useUsers'
import { cn } from '@/lib/utils'
import { theme } from '@/lib/theme'
import { Button } from '@/components/ui/Button'

export function AppLayout() {
  const { signOut, user, isSuperAdmin } = useAuth()
  const { data: pendingUsers } = usePendingAppUsers(isSuperAdmin)
  const { theme: colorTheme, toggleTheme } = useTheme()
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)

  const pendingCount = pendingUsers?.length ?? 0

  const navItems = [
    { to: '/', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/ingredients', label: 'Ingredients', icon: Carrot },
    { to: '/products', label: 'Products', icon: Package },
    { to: '/settings', label: 'Settings', icon: Settings },
    ...(isSuperAdmin
      ? [{ to: '/admin/users', label: 'Users', icon: UserCheck, badge: pendingCount }]
      : []),
  ]

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  const NavContent = () => (
    <>
      <div className="mb-8 px-4">
        <h1 className={cn('text-xl', theme.headingBrand)}>Product Cost Manager</h1>
        <p className={cn('mt-1 truncate text-xs', theme.textMuted)}>{user?.email}</p>
      </div>

      <nav className="flex-1 space-y-1 px-3">
        {navItems.map(({ to, label, icon: Icon, badge }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            onClick={() => setMobileOpen(false)}
            className={({ isActive }) =>
              cn(theme.navItem, isActive && theme.navItemActive)
            }
          >
            <Icon className="h-5 w-5" />
            <span className="flex-1">{label}</span>
            {badge != null && badge > 0 && (
              <span className="rounded-full bg-amber-500 px-2 py-0.5 text-xs font-semibold text-white">
                {badge}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      <div className={cn('space-y-2 p-4', theme.sidebarFooter)}>
        <Button variant="ghost" className="w-full justify-start" onClick={toggleTheme}>
          {colorTheme === 'dark' ? (
            <Sun className="h-5 w-5" />
          ) : (
            <Moon className="h-5 w-5" />
          )}
          {colorTheme === 'dark' ? 'Light Mode' : 'Dark Mode'}
        </Button>
        <Button
          variant="ghost"
          className={cn('w-full justify-start', theme.iconDanger)}
          onClick={handleSignOut}
        >
          <LogOut className="h-5 w-5" />
          Sign Out
        </Button>
      </div>
    </>
  )

  return (
    <div className={theme.pageShell}>
      <aside className={cn('hidden w-64 flex-col lg:flex', theme.sidebar)}>
        <NavContent />
      </aside>

      <div className="flex flex-1 flex-col">
        <header className={cn('flex items-center justify-between px-4 py-3 lg:hidden', theme.header)}>
          <h1 className={cn('text-lg', theme.headingBrand)}>PCM</h1>
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="rounded-lg p-2 hover:bg-hover"
          >
            {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </header>

        {mobileOpen && (
          <div className="fixed inset-0 z-40 lg:hidden">
            <div className={theme.overlay} onClick={() => setMobileOpen(false)} />
            <aside className={cn('absolute left-0 top-0 flex h-full w-64 flex-col bg-elevated')}>
              <NavContent />
            </aside>
          </div>
        )}

        <main className={theme.main}>
          <Outlet />
        </main>
      </div>
    </div>
  )
}
