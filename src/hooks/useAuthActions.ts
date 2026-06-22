import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  requestPasswordResetEmail,
  sendPasswordResetEmail,
  updatePassword,
} from '@/services/auth'

export function useRequestPasswordReset() {
  return useMutation({
    mutationFn: requestPasswordResetEmail,
    onSuccess: () => {
      toast.success('Password reset email sent — check your inbox')
    },
    onError: (error: Error) => toast.error(error.message),
  })
}

export function useSendPasswordReset() {
  return useMutation({
    mutationFn: sendPasswordResetEmail,
    onSuccess: () => {
      toast.success('Password reset email sent')
    },
    onError: (error: Error) => toast.error(error.message),
  })
}

export function useUpdatePassword() {
  return useMutation({
    mutationFn: updatePassword,
    onSuccess: () => {
      toast.success('Password updated')
    },
    onError: (error: Error) => toast.error(error.message),
  })
}
