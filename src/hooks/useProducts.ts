import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  fetchProducts,
  fetchProductWithRecipe,
  createProduct,
  updateProduct,
  deleteProduct,
  addProductIngredient,
  updateProductIngredient,
  removeProductIngredient,
  fetchCostHistory,
  fetchProductsRequiringReview,
} from '@/services/products'
import type { ProductFormData } from '@/types/database'
import { useAuth } from '@/contexts/AuthContext'

export function useProducts() {
  return useQuery({
    queryKey: ['products'],
    queryFn: fetchProducts,
  })
}

export function useProduct(id: string) {
  return useQuery({
    queryKey: ['products', id],
    queryFn: () => fetchProductWithRecipe(id),
    enabled: Boolean(id),
  })
}

export function useCostHistory(productId: string) {
  return useQuery({
    queryKey: ['cost-history', productId],
    queryFn: () => fetchCostHistory(productId),
    enabled: Boolean(productId),
  })
}

export function useProductsRequiringReview() {
  return useQuery({
    queryKey: ['products', 'review'],
    queryFn: fetchProductsRequiringReview,
  })
}

export function useCreateProduct() {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  return useMutation({
    mutationFn: (form: ProductFormData) => {
      if (!user) throw new Error('Not authenticated')
      return createProduct(user.id, form)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
      toast.success('Product created')
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to create product')
    },
  })
}

export function useUpdateProduct() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, form }: { id: string; form: ProductFormData }) =>
      updateProduct(id, form),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
      queryClient.invalidateQueries({ queryKey: ['products', id] })
      toast.success('Product updated')
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update product')
    },
  })
}

export function useDeleteProduct() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: deleteProduct,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
      toast.success('Product deleted')
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to delete product')
    },
  })
}

export function useAddProductIngredient() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      productId,
      ingredientId,
      quantityUsed,
    }: {
      productId: string
      ingredientId: string
      quantityUsed: number
    }) => addProductIngredient(productId, ingredientId, quantityUsed),
    onSuccess: (_, { productId }) => {
      queryClient.invalidateQueries({ queryKey: ['products', productId] })
      queryClient.invalidateQueries({ queryKey: ['products'] })
      queryClient.invalidateQueries({ queryKey: ['cost-history', productId] })
      toast.success('Ingredient added to recipe')
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to add ingredient')
    },
  })
}

export function useUpdateProductIngredient() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      id,
      quantityUsed,
    }: {
      id: string
      quantityUsed: number
      productId: string
    }) => updateProductIngredient(id, quantityUsed),
    onSuccess: (_, { productId }) => {
      queryClient.invalidateQueries({ queryKey: ['products', productId] })
      queryClient.invalidateQueries({ queryKey: ['products'] })
      queryClient.invalidateQueries({ queryKey: ['cost-history', productId] })
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update quantity')
    },
  })
}

export function useRemoveProductIngredient() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, productId }: { id: string; productId: string }) =>
      removeProductIngredient(id, productId),
    onSuccess: (_, { productId }) => {
      queryClient.invalidateQueries({ queryKey: ['products', productId] })
      queryClient.invalidateQueries({ queryKey: ['products'] })
      toast.success('Ingredient removed from recipe')
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to remove ingredient')
    },
  })
}
