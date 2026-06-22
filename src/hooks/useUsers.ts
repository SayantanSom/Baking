import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  fetchMyAppUser,
  fetchPendingAppUsers,
  fetchAllAppUsers,
  approveAppUser,
  rejectAppUser,
  inviteAppUser,
} from '@/services/users'

export function useMyAppUser(enabled = true) {
  return useQuery({
    queryKey: ['app-user', 'me'],
    queryFn: fetchMyAppUser,
    enabled,
    staleTime: 30_000,
  })
}

export function usePendingAppUsers(isSuperAdmin: boolean) {
  return useQuery({
    queryKey: ['app-users', 'pending'],
    queryFn: fetchPendingAppUsers,
    enabled: isSuperAdmin,
    refetchInterval: isSuperAdmin ? 30_000 : false,
  })
}

export function useAllAppUsers(isSuperAdmin: boolean) {
  return useQuery({
    queryKey: ['app-users', 'all'],
    queryFn: fetchAllAppUsers,
    enabled: isSuperAdmin,
  })
}

export function useApproveAppUser() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: approveAppUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['app-users'] })
      toast.success('User approved')
    },
    onError: (error: Error) => toast.error(error.message),
  })
}

export function useRejectAppUser() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: rejectAppUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['app-users'] })
      toast.success('User rejected')
    },
    onError: (error: Error) => toast.error(error.message),
  })
}

export function useInviteAppUser() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: inviteAppUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['app-users'] })
      toast.success('Invite sent — user must verify email and set a password')
    },
    onError: (error: Error) => toast.error(error.message),
  })
}
