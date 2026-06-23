import { useMemo, useState } from 'react'
import { UserCheck, Shield, UserPlus, KeyRound } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { ConfirmDialog } from '@/components/ui/Dialog'
import { PageLoader } from '@/components/ui/LoadingSpinner'
import { useAuth } from '@/contexts/AuthContext'
import { useSendPasswordReset } from '@/hooks/useAuthActions'
import { sendPasswordResetEmail } from '@/services/auth'
import { toast } from 'sonner'
import {
  useAllAppUsers,
  useApproveAppUser,
  useRejectAppUser,
  useInviteAppUser,
} from '@/hooks/useUsers'
import { formatDateTime } from '@/lib/utils'
import type { AppUser } from '@/types/database'

function statusLabel(user: AppUser) {
  if (user.status === 'pending') return 'Pending'
  if (user.status === 'rejected') return 'Rejected'
  return user.role === 'super_admin' ? 'Super admin' : 'Approved'
}

export function UserApprovalsPage() {
  const { isSuperAdmin, user } = useAuth()
  const { data: users, isLoading } = useAllAppUsers(isSuperAdmin)
  const approveMutation = useApproveAppUser()
  const rejectMutation = useRejectAppUser()
  const inviteMutation = useInviteAppUser()
  const resetMutation = useSendPasswordReset()
  const [inviteEmail, setInviteEmail] = useState('')
  const [resetAllOpen, setResetAllOpen] = useState(false)
  const [resettingAll, setResettingAll] = useState(false)

  const pending = useMemo(
    () => (users ?? []).filter((u) => u.status === 'pending'),
    [users]
  )

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    const email = inviteEmail.trim()
    if (!email) return
    await inviteMutation.mutateAsync(email)
    setInviteEmail('')
  }

  const approvedUsers = useMemo(
    () => (users ?? []).filter((u) => u.status === 'approved'),
    [users]
  )

  const handleResetAll = async () => {
    setResettingAll(true)
    try {
      for (const row of approvedUsers) {
        await sendPasswordResetEmail(row.email)
      }
      toast.success(`Password reset emails sent to ${approvedUsers.length} users`)
      setResetAllOpen(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to send reset emails')
    } finally {
      setResettingAll(false)
    }
  }

  if (isLoading) return <PageLoader />

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">User management</h1>
        <p className="text-fg-muted">
          Invite team members by email. They verify their address and set a password before signing in.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-accent" />
            Invite new user
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleInvite} className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1">
              <Input
                label="Email address"
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="colleague@example.com"
                required
              />
            </div>
            <Button type="submit" loading={inviteMutation.isPending}>
              Send invite
            </Button>
          </form>
          <p className="mt-3 text-sm text-fg-muted">
            Supabase sends a verification email. Invited users are approved automatically and can sign in after they complete setup.
          </p>
          {user?.email && (
            <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-4">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => resetMutation.mutate(user.email!)}
                loading={resetMutation.isPending}
              >
                <KeyRound className="h-4 w-4" />
                Send reset email to me
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserCheck className="h-5 w-5 text-accent" />
            Pending requests ({pending.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {pending.length === 0 ? (
            <p className="text-sm text-fg-muted">
              No pending self-registration requests. Disable public sign-up in Supabase to avoid spam.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-surface-muted">
                    <th className="px-4 py-3 text-left">Email</th>
                    <th className="px-4 py-3 text-left">Requested</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pending.map((row) => (
                    <tr key={row.id} className="border-b border-border">
                      <td className="px-4 py-3 font-medium">{row.email}</td>
                      <td className="px-4 py-3 text-fg-secondary">
                        {formatDateTime(row.created_at)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            onClick={() => approveMutation.mutate(row.user_id)}
                            loading={approveMutation.isPending}
                          >
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => rejectMutation.mutate(row.user_id)}
                            loading={rejectMutation.isPending}
                          >
                            Reject
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-fg-muted" />
            All users
          </CardTitle>
          {approvedUsers.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setResetAllOpen(true)}
            >
              <KeyRound className="h-4 w-4" />
              Reset all passwords
            </Button>
          )}
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-surface-muted">
                  <th className="px-4 py-3 text-left">Email</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">Registered</th>
                  <th className="px-4 py-3 text-left">Approved</th>
                  <th className="px-4 py-3 text-right">Password</th>
                </tr>
              </thead>
              <tbody>
                {(users ?? []).map((row) => (
                  <tr key={row.id} className="border-b border-border">
                    <td className="px-4 py-3">{row.email}</td>
                    <td className="px-4 py-3">{statusLabel(row)}</td>
                    <td className="px-4 py-3 text-fg-secondary">
                      {formatDateTime(row.created_at)}
                    </td>
                    <td className="px-4 py-3 text-fg-secondary">
                      {row.approved_at ? formatDateTime(row.approved_at) : '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {row.status === 'approved' ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => resetMutation.mutate(row.email)}
                          loading={resetMutation.isPending}
                        >
                          Send reset
                        </Button>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={resetAllOpen}
        onClose={() => setResetAllOpen(false)}
        onConfirm={handleResetAll}
        title="Reset all user passwords?"
        message={`Send a password reset email to all ${approvedUsers.length} approved users (including you)? Each user must set a new password from their email link.`}
        loading={resettingAll}
      />
    </div>
  )
}
