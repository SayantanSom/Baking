import { supabase } from './supabase'
import { authRedirectUrl } from '@/lib/authRedirect'

export function getPasswordResetRedirectUrl(): string {
  return authRedirectUrl('/reset-password')
}

/** Public forgot-password (login page). */
export async function requestPasswordResetEmail(email: string): Promise<void> {
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
    redirectTo: getPasswordResetRedirectUrl(),
  })
  if (error) throw error
}

/** Logged-in user or super admin (via Edge Function). */
export async function sendPasswordResetEmail(email: string): Promise<void> {
  const { data, error } = await supabase.functions.invoke('send-password-reset', {
    body: {
      email: email.trim(),
      redirectTo: getPasswordResetRedirectUrl(),
    },
  })

  if (error) throw error

  const payload = data as { error?: string } | null
  if (payload?.error) {
    throw new Error(payload.error)
  }
}

export async function updatePassword(newPassword: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ password: newPassword })
  if (error) throw error
}
