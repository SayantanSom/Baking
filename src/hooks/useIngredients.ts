import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  fetchIngredients,
  fetchIngredient,
  createIngredient,
  updateIngredient,
  deleteIngredient,
  fetchRecentlyUpdatedIngredients,
  fetchVendorPrices,
  fetchIngredientVendorCounts,
  createVendorPrice,
  updateVendorPrice,
  deleteVendorPrice,
  setActiveVendorPrice,
  useCheapestVendor as selectCheapestVendor,
  fetchIngredientVendorPriceHistory,
} from '@/services/ingredients'
import {
  fetchVarietiesUsingIngredient,
  fetchIngredientPriceImpact,
  fetchIngredientVarietyUsageCounts,
} from '@/services/ingredientImpact'
import type { IngredientFormData, VendorPriceFormData } from '@/types/database'
import { useAuth } from '@/contexts/AuthContext'
import { useEnterprise } from '@/contexts/EnterpriseContext'
import { isConflictError } from '@/lib/errors'

export function useIngredients() {
  return useQuery({
    queryKey: ['ingredients'],
    queryFn: fetchIngredients,
  })
}

export function useIngredient(id: string) {
  return useQuery({
    queryKey: ['ingredients', id],
    queryFn: () => fetchIngredient(id),
    enabled: Boolean(id),
  })
}

export function useVendorPrices(
  ingredientId: string,
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: ['vendor-prices', ingredientId],
    queryFn: () => fetchVendorPrices(ingredientId),
    enabled: Boolean(ingredientId) && (options?.enabled ?? true),
  })
}

export function useIngredientVendorCounts() {
  return useQuery({
    queryKey: ['ingredient-vendor-counts'],
    queryFn: fetchIngredientVendorCounts,
  })
}

export function useIngredientVendorPriceHistory(
  ingredientId: string,
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: ['ingredient-vendor-price-history', ingredientId],
    queryFn: () => fetchIngredientVendorPriceHistory(ingredientId),
    enabled: Boolean(ingredientId) && (options?.enabled ?? true),
    staleTime: 0,
    refetchOnMount: 'always',
  })
}

/** @deprecated */
export const useIngredientPriceHistory = useIngredientVendorPriceHistory

export function useProductsUsingIngredient(
  ingredientId: string,
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: ['ingredient-products', ingredientId],
    queryFn: () => fetchVarietiesUsingIngredient(ingredientId),
    enabled: Boolean(ingredientId) && (options?.enabled ?? true),
  })
}

export function useIngredientVarietyUsageCounts() {
  return useQuery({
    queryKey: ['ingredient-variety-usage-counts'],
    queryFn: fetchIngredientVarietyUsageCounts,
  })
}

export function useIngredientPriceImpact(ingredientId: string) {
  return useQuery({
    queryKey: ['ingredient-price-impact', ingredientId],
    queryFn: () => fetchIngredientPriceImpact(ingredientId),
    enabled: Boolean(ingredientId),
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
  const { enterpriseId } = useEnterprise()

  return useMutation({
    mutationFn: (form: IngredientFormData) => {
      if (!user) throw new Error('Not authenticated')
      if (!enterpriseId) throw new Error('No enterprise membership found')
      return createIngredient(enterpriseId, user.id, form)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ingredients'] })
      toast.success('Ingredient created')
    },
    onError: (error: Error) => toast.error(error.message),
  })
}

export function useUpdateIngredient() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      id,
      form,
      version,
    }: {
      id: string
      form: IngredientFormData
      version: number
    }) => updateIngredient(id, form, version),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['ingredients'] })
      queryClient.invalidateQueries({ queryKey: ['ingredients', id] })
      toast.success('Ingredient updated')
    },
    onError: (error: Error) => {
      if (isConflictError(error)) {
        toast.error(error.message)
        queryClient.invalidateQueries({ queryKey: ['ingredients'] })
        return
      }
      toast.error(error.message)
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
    onError: (error: Error) => toast.error(error.message),
  })
}

export function useCreateVendorPrice() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      ingredientId,
      form,
      baseUnit,
    }: {
      ingredientId: string
      form: VendorPriceFormData
      baseUnit: string
    }) => createVendorPrice(ingredientId, form, baseUnit),
    onSuccess: (_, { ingredientId }) => {
      queryClient.invalidateQueries({ queryKey: ['vendor-prices', ingredientId] })
      queryClient.invalidateQueries({ queryKey: ['ingredient-vendor-counts'] })
      queryClient.invalidateQueries({ queryKey: ['ingredients', ingredientId] })
      queryClient.invalidateQueries({ queryKey: ['ingredients'] })
      queryClient.invalidateQueries({ queryKey: ['products'] })
      queryClient.invalidateQueries({ queryKey: ['ingredient-vendor-price-history', ingredientId] })
      toast.success('Vendor price added')
    },
    onError: (error: Error) => toast.error(error.message),
  })
}

export function useUpdateVendorPrice() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      id,
      ingredientId,
      form,
      baseUnit,
    }: {
      id: string
      ingredientId: string
      form: VendorPriceFormData
      baseUnit: string
    }) => updateVendorPrice(id, ingredientId, form, baseUnit),
    onSuccess: (result, { ingredientId }) => {
      queryClient.invalidateQueries({ queryKey: ['vendor-prices', ingredientId] })
      queryClient.invalidateQueries({ queryKey: ['ingredients', ingredientId] })
      queryClient.invalidateQueries({ queryKey: ['ingredients'] })
      queryClient.invalidateQueries({ queryKey: ['products'] })
      queryClient.invalidateQueries({ queryKey: ['ingredient-vendor-price-history', ingredientId] })
      const n = result.affectedCount
      toast.success(
        n > 0 ? `Vendor price updated — ${n} varieties recalculated` : 'Vendor price updated'
      )
    },
    onError: (error: Error) => toast.error(error.message),
  })
}

export function useDeleteVendorPrice() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      id,
      ingredientId,
    }: {
      id: string
      ingredientId: string
    }) => deleteVendorPrice(id, ingredientId),
    onSuccess: (_, { ingredientId }) => {
      queryClient.invalidateQueries({ queryKey: ['vendor-prices', ingredientId] })
      queryClient.invalidateQueries({ queryKey: ['ingredient-vendor-counts'] })
      queryClient.invalidateQueries({ queryKey: ['ingredients', ingredientId] })
      toast.success('Vendor price deleted')
    },
    onError: (error: Error) => toast.error(error.message),
  })
}

export function useSetActiveVendorPrice() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      ingredientId,
      vendorPriceId,
    }: {
      ingredientId: string
      vendorPriceId: string
    }) => setActiveVendorPrice(ingredientId, vendorPriceId),
    onSuccess: (count, { ingredientId }) => {
      queryClient.invalidateQueries({ queryKey: ['vendor-prices', ingredientId] })
      queryClient.invalidateQueries({ queryKey: ['ingredients', ingredientId] })
      queryClient.invalidateQueries({ queryKey: ['ingredients'] })
      queryClient.invalidateQueries({ queryKey: ['products'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['ingredient-vendor-price-history', ingredientId] })
      toast.success(`Active vendor updated — ${count} varieties recalculated`)
    },
    onError: (error: Error) => toast.error(error.message),
  })
}

export function useCheapestVendor() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (ingredientId: string) => selectCheapestVendor(ingredientId),
    onSuccess: (count, ingredientId) => {
      queryClient.invalidateQueries({ queryKey: ['vendor-prices', ingredientId] })
      queryClient.invalidateQueries({ queryKey: ['ingredients', ingredientId] })
      queryClient.invalidateQueries({ queryKey: ['products'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['ingredient-vendor-price-history', ingredientId] })
      toast.success(`Cheapest vendor selected — ${count} varieties recalculated`)
    },
    onError: (error: Error) => toast.error(error.message),
  })
}
