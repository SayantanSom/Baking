import { useState } from 'react'
import { Navigate, useSearchParams } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useAuth } from '@/contexts/AuthContext'
import { useRequestPasswordReset } from '@/hooks/useAuthActions'
import { isSupabaseConfigured } from '@/services/supabase'
import { cn } from '@/lib/utils'
import { theme } from '@/lib/theme'
import { toast } from 'sonner'

export function LoginPage() {
  const { user, isApproved, loading, signIn } = useAuth()
  const [searchParams] = useSearchParams()
  const [mode, setMode] = useState<'signin' | 'forgot'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const resetMutation = useRequestPasswordReset()

  const statusHint = searchParams.get('status')

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-accent-muted border-t-accent-solid" />
      </div>
    )
  }

  if (user && isApproved) return <Navigate to="/" replace />

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      await signIn(email, password)
      toast.success('Welcome back!')
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Authentication failed'
      )
    } finally {
      setSubmitting(false)
    }
  }

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault()
    await resetMutation.mutateAsync(email)
    setMode('signin')
  }

  return (
    <div className={theme.authPage}>
      <div className={theme.authCard}>
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-accent">
            Product Cost Manager
          </h1>
          <p className="mt-2 text-fg-muted">
            {mode === 'signin' ? 'Sign in to your account' : 'Reset your password'}
          </p>
        </div>

        {statusHint === 'pending' && (
          <div className={cn('mb-6', theme.alertWarningInline)}>
            Your account is awaiting approval from a super administrator.
          </div>
        )}

        {!isSupabaseConfigured && (
          <div className={cn('mb-6', theme.alertWarningInline)}>
            Supabase is not configured. Copy <code>.env.example</code> to{' '}
            <code>.env</code> and add your credentials.
          </div>
        )}

        {mode === 'signin' ? (
          <form onSubmit={handleSignIn} className="space-y-4">
            <Input
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
            <Input
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              autoComplete="current-password"
            />
            <div className="text-right">
              <button
                type="button"
                onClick={() => setMode('forgot')}
                className="text-sm text-accent hover:underline"
              >
                Forgot password?
              </button>
            </div>
            <Button type="submit" className="w-full" loading={submitting}>
              Sign In
            </Button>
          </form>
        ) : (
          <form onSubmit={handleForgot} className="space-y-4">
            <p className="text-sm text-fg-muted">
              Enter your email and we&apos;ll send a link to set a new password.
            </p>
            <Input
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
            <Button type="submit" className="w-full" loading={resetMutation.isPending}>
              Send reset email
            </Button>
            <button
              type="button"
              onClick={() => setMode('signin')}
              className="w-full text-center text-sm text-fg-muted hover:text-fg-secondary"
            >
              Back to sign in
            </button>
          </form>
        )}

        {mode === 'signin' && (
          <p className="mt-6 text-center text-sm text-fg-muted">
            New accounts are invite-only. Ask your administrator to send you an email invite.
          </p>
        )}
      </div>
    </div>
  )
}
