import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  fetchSettings,
  updateSettings,
  fetchSupplierPrices,
  createSupplierPrice,
  deleteSupplierPrice,
} from '@/services/settings'

export function useSettings() {
  return useQuery({
    queryKey: ['settings'],
    queryFn: fetchSettings,
  })
}

export function useUpdateSettings() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: updateSettings,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] })
      toast.success('Settings saved')
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to save settings')
    },
  })
}

export function useSupplierPrices(ingredientId: string) {
  return useQuery({
    queryKey: ['supplier-prices', ingredientId],
    queryFn: () => fetchSupplierPrices(ingredientId),
    enabled: Boolean(ingredientId),
  })
}

export function useCreateSupplierPrice() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      ingredientId,
      retailer,
      price,
      packSize,
      productUrl,
    }: {
      ingredientId: string
      retailer: string
      price: number
      packSize: number
      productUrl?: string
    }) =>
      createSupplierPrice(
        ingredientId,
        retailer,
        price,
        packSize,
        productUrl
      ),
    onSuccess: (_, { ingredientId }) => {
      queryClient.invalidateQueries({
        queryKey: ['supplier-prices', ingredientId],
      })
      toast.success('Supplier price recorded')
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to save supplier price')
    },
  })
}

export function useDeleteSupplierPrice() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: deleteSupplierPrice,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplier-prices'] })
      toast.success('Supplier price removed')
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to delete supplier price')
    },
  })
}
