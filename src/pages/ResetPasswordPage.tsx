import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useUpdatePassword } from '@/hooks/useAuthActions'
import { supabase } from '@/services/supabase'

function isRecoveryHash(hash: string): boolean {
  if (!hash || hash === '#') return false
  const params = new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : hash)
  return params.get('type') === 'recovery'
}

export function ResetPasswordPage() {
  const navigate = useNavigate()
  const updatePassword = useUpdatePassword()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [recoveryReady, setRecoveryReady] = useState(false)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    let mounted = true
    let subscription: { unsubscribe: () => void } | undefined

    const init = async () => {
      const hash = window.location.hash
      const recoveryFromHash = isRecoveryHash(hash)

      const { data: { subscription: sub } } = supabase.auth.onAuthStateChange(
        (event) => {
          if (!mounted) return
          if (event === 'PASSWORD_RECOVERY') {
            setRecoveryReady(true)
            setChecking(false)
          }
        }
      )
      subscription = sub

      if (recoveryFromHash) {
        const { data: { session } } = await supabase.auth.getSession()
        if (mounted && session) {
          setRecoveryReady(true)
        }
      }

      if (mounted) setChecking(false)
    }

    void init()

    return () => {
      mounted = false
      subscription?.unsubscribe()
    }
  }, [])

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-200 border-t-emerald-600" />
      </div>
    )
  }

  if (!recoveryReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4 dark:bg-slate-950">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-lg dark:border-slate-700 dark:bg-slate-900">
          <h1 className="text-xl font-bold">Reset link required</h1>
          <p className="mt-2 text-sm text-slate-500">
            Open the password reset link from your email, or request a new one from the sign-in page.
          </p>
          <Link to="/login" className="mt-6 inline-block text-emerald-600 hover:underline">
            Back to sign in
          </Link>
        </div>
      </div>
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password.length < 6 || password !== confirm) return

    await updatePassword.mutateAsync(password)
    await supabase.auth.signOut()
    navigate('/login', { replace: true })
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4 dark:bg-slate-950">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-lg dark:border-slate-700 dark:bg-slate-900">
        <h1 className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
          Set new password
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          Choose a new password for your account.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <Input
            label="New password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            autoComplete="new-password"
          />
          <Input
            label="Confirm password"
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            minLength={6}
            autoComplete="new-password"
          />
          {password && confirm && password !== confirm && (
            <p className="text-sm text-red-600">Passwords do not match</p>
          )}
          <Button
            type="submit"
            className="w-full"
            loading={updatePassword.isPending}
            disabled={password !== confirm || password.length < 6}
          >
            Update password
          </Button>
        </form>

        <p className="mt-6 text-center text-sm">
          <Link to="/login" className="text-emerald-600 hover:underline">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
