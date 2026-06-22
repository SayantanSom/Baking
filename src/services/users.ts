import { supabase } from './supabase'
import type { AppUser } from '@/types/database'
import { authRedirectUrl } from '@/lib/authRedirect'
import { getEdgeFunctionErrorMessage } from '@/lib/edgeFunctionError'

export async function fetchMyAppUser(): Promise<AppUser | null> {
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) return null

  const { data, error } = await supabase
    .from('app_users')
    .select('*')
    .eq('user_id', auth.user.id)
    .maybeSingle()

  if (error) throw error
  return data
}

export async function fetchPendingAppUsers(): Promise<AppUser[]> {
  const { data, error } = await supabase
    .from('app_users')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })

  if (error) throw error
  return data ?? []
}

export async function fetchAllAppUsers(): Promise<AppUser[]> {
  const { data, error } = await supabase
    .from('app_users')
    .select('*')
    .order('created_at', { ascending: true })

  if (error) throw error
  return data ?? []
}

export async function approveAppUser(userId: string): Promise<void> {
  const { error } = await supabase.rpc('approve_app_user', {
    target_user_id: userId,
  })
  if (error) throw error
}

export async function rejectAppUser(userId: string): Promise<void> {
  const { error } = await supabase.rpc('reject_app_user', {
    target_user_id: userId,
  })
  if (error) throw error
}

export async function inviteAppUser(email: string): Promise<void> {
  const redirectTo = authRedirectUrl('/login')

  const { data, error, response } = await supabase.functions.invoke('invite-user', {
    body: { email, redirectTo },
  })

  if (error) {
    throw new Error(await getEdgeFunctionErrorMessage(error, response))
  }

  const payload = data as { error?: string; success?: boolean } | null
  if (payload?.error) {
    throw new Error(payload.error)
  }
}
