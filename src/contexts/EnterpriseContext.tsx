import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react'
import { useAuth } from '@/contexts/AuthContext'
import {
  fetchMyEnterpriseMember,
  type MyEnterpriseMember,
} from '@/services/enterprises'
import type { Enterprise, EnterpriseMemberRole } from '@/types/database'

interface EnterpriseContextValue {
  enterpriseId: string | null
  enterprise: Enterprise | null
  role: EnterpriseMemberRole | null
  loading: boolean
  refreshEnterprise: () => Promise<void>
}

const EnterpriseContext = createContext<EnterpriseContextValue | null>(null)

export function EnterpriseProvider({ children }: { children: ReactNode }) {
  const { user, isApproved, loading: authLoading } = useAuth()
  const [member, setMember] = useState<MyEnterpriseMember | null>(null)
  const [loading, setLoading] = useState(false)

  const refreshEnterprise = useCallback(async () => {
    if (!user || !isApproved) {
      setMember(null)
      return
    }
    setLoading(true)
    try {
      const data = await fetchMyEnterpriseMember()
      setMember(data)
    } catch {
      setMember(null)
    } finally {
      setLoading(false)
    }
  }, [user, isApproved])

  useEffect(() => {
    if (authLoading) return
    void refreshEnterprise()
  }, [authLoading, refreshEnterprise])

  return (
    <EnterpriseContext.Provider
      value={{
        enterpriseId: member?.enterpriseId ?? null,
        enterprise: member?.enterprise ?? null,
        role: member?.role ?? null,
        loading: authLoading || loading,
        refreshEnterprise,
      }}
    >
      {children}
    </EnterpriseContext.Provider>
  )
}

export function useEnterprise() {
  const ctx = useContext(EnterpriseContext)
  if (!ctx) {
    throw new Error('useEnterprise must be used within EnterpriseProvider')
  }
  return ctx
}

export function useRequiredEnterpriseId(): string {
  const { enterpriseId, loading } = useEnterprise()
  if (loading) return ''
  if (!enterpriseId) throw new Error('No enterprise membership found')
  return enterpriseId
}
