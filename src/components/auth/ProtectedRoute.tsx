import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { PageLoader } from '@/components/ui/LoadingSpinner'

export function ProtectedRoute() {
  const { user, isApproved, loading, profileLoading } = useAuth()

  if (loading || profileLoading) return <PageLoader />

  if (!user || !isApproved) return <Navigate to="/login" replace />

  return <Outlet />
}

export function SuperAdminRoute() {
  const { isSuperAdmin, loading, profileLoading } = useAuth()

  if (loading || profileLoading) return <PageLoader />

  if (!isSuperAdmin) return <Navigate to="/" replace />

  return <Outlet />
}
