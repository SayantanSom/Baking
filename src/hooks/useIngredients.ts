import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  fetchIngredients,
  createIngredient,
  updateIngredient,
  deleteIngredient,
  fetchRecentlyUpdatedIngredients,
} from '@/services/ingredients'
import type { IngredientFormData } from '@/types/database'
import { useAuth } from '@/contexts/AuthContext'

export function useIngredients() {
  return useQuery({
    queryKey: ['ingredients'],
    queryFn: fetchIngredients,
  })
}

export function useRecentlyUpdatedIngredients(limit = 5) {
  return useQuery({
    queryKey: ['ingredients', 'recent', limit],
    queryFn: () => fetchRecentlyUpdatedIngredients(limit),
  })
}

export function useCreateIngredient() {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  return useMutation({
    mutationFn: (form: IngredientFormData) => {
      if (!user) throw new Error('Not authenticated')
      return createIngredient(user.id, form)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ingredients'] })
      toast.success('Ingredient created')
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to create ingredient')
    },
  })
}

export function useUpdateIngredient() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, form }: { id: string; form: IngredientFormData }) =>
      updateIngredient(id, form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ingredients'] })
      queryClient.invalidateQueries({ queryKey: ['products'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      toast.success('Ingredient updated — affected products recalculated')
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update ingredient')
    },
  })
}

export function useDeleteIngredient() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: deleteIngredient,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ingredients'] })
      toast.success('Ingredient deleted')
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to delete ingredient')
    },
  })
}
