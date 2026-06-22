import { supabase } from './supabase'
import type { Enterprise, EnterpriseMember, EnterpriseMemberRole } from '@/types/database'

export interface MyEnterpriseMember {
  enterpriseId: string
  enterprise: Enterprise | null
  role: EnterpriseMemberRole
}

export async function fetchMyEnterpriseMember(): Promise<MyEnterpriseMember> {
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('enterprise_members')
    .select('enterprise_id, role, enterprise:enterprises(*)')
    .eq('user_id', auth.user.id)
    .limit(1)
    .maybeSingle()

  if (error) throw error
  if (!data) throw new Error('No enterprise membership found. Contact your administrator.')

  const enterprise = Array.isArray(data.enterprise)
    ? data.enterprise[0]
    : data.enterprise

  return {
    enterpriseId: data.enterprise_id,
    enterprise: (enterprise as Enterprise | null) ?? null,
    role: data.role as EnterpriseMemberRole,
  }
}

export async function fetchMyEnterpriseId(): Promise<string> {
  const member = await fetchMyEnterpriseMember()
  return member.enterpriseId
}

export type { Enterprise, EnterpriseMember }
