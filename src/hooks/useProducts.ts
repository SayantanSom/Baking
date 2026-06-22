import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  fetchProducts,
  fetchProductsWithVarieties,
  setVarietyCatalogueVisibility,
  fetchProductWithVarieties,
  fetchVarietyWithRecipe,
  createProductWithDefaultVariety,
  updateProduct,
  deleteProduct,
  createVariety,
  updateVariety,
  deleteVariety,
  addVarietyIngredient,
  updateVarietyIngredient,
  removeVarietyIngredient,
  fetchVarietyCostHistory,
  fetchVarietySellingPriceHistory,
  searchVarieties,
  fetchVarietiesRequiringReview,
  refreshVarietyFromBaseRecipe,
  setVarietyLocks,
} from '@/services/products'
import {
  fetchProductWithRecipeVersions,
  addBaseRecipeIngredient,
  updateBaseRecipeIngredient,
  removeBaseRecipeIngredient,
  saveRecipeVersionAsNew,
  setCurrentRecipeVersion,
  ensureCurrentRecipeVersion,
} from '@/services/recipeVersions'
import {
  fetchLatestAcceptance,
  fetchAcceptanceHistory,
  acceptVarietyCost,
  acceptVarietyAndReprice,
} from '@/services/varietyAcceptance'
import type {
  ProductFormData,
  ProductCreateFormData,
  ProductVarietyFormData,
  VarietyLockFormData,
  IngredientUnit,
  RecipeScalingMode,
  AcceptVarietyFormData,
  AcceptAndRepriceFormData,
} from '@/types/database'
import { useAuth } from '@/contexts/AuthContext'
import { useEnterprise } from '@/contexts/EnterpriseContext'
import { useSettings } from '@/hooks/useSettings'
import { isConflictError } from '@/lib/errors'

export function useProducts() {
  return useQuery({
    queryKey: ['products'],
    queryFn: fetchProducts,
  })
}

export function useProductsWithVarieties() {
  return useQuery({
    queryKey: ['products', 'with-varieties'],
    queryFn: fetchProductsWithVarieties,
  })
}

export function useProduct(id: string) {
  return useQuery({
    queryKey: ['products', id],
    queryFn: () => fetchProductWithVarieties(id),
    enabled: Boolean(id),
  })
}

export function useVariety(id: string) {
  return useQuery({
    queryKey: ['varieties', id],
    queryFn: () => fetchVarietyWithRecipe(id),
    enabled: Boolean(id),
  })
}

export function useVarietySellingPriceHistory(varietyId: string) {
  return useQuery({
    queryKey: ['variety-selling-price-history', varietyId],
    queryFn: () => fetchVarietySellingPriceHistory(varietyId),
    enabled: Boolean(varietyId),
  })
}

export function useProductRecipeVersions(productId: string) {
  return useQuery({
    queryKey: ['product-recipe-versions', productId],
    queryFn: () => fetchProductWithRecipeVersions(productId),
    enabled: Boolean(productId),
  })
}

export function useVarietyCostHistory(varietyId: string) {
  return useQuery({
    queryKey: ['variety-cost-history', varietyId],
    queryFn: () => fetchVarietyCostHistory(varietyId),
    enabled: Boolean(varietyId),
  })
}

export function useSearchVarieties(query: string) {
  return useQuery({
    queryKey: ['search-varieties', query],
    queryFn: () => searchVarieties(query),
  })
}

export function useVarietiesRequiringReview() {
  return useQuery({
    queryKey: ['varieties', 'review'],
    queryFn: fetchVarietiesRequiringReview,
  })
}

export function useCreateProduct() {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const { enterpriseId } = useEnterprise()
  const { data: settings } = useSettings()

  return useMutation({
    mutationFn: (form: ProductCreateFormData) => {
      if (!user) throw new Error('Not authenticated')
      if (!enterpriseId) throw new Error('No enterprise membership found')
      return createProductWithDefaultVariety(enterpriseId, user.id, form, settings ?? undefined)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
      toast.success('Product created with default variety')
    },
    onError: (error: Error) => toast.error(error.message),
  })
}

export function useUpdateProduct() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      id,
      form,
      version,
    }: {
      id: string
      form: ProductFormData
      version: number
    }) => updateProduct(id, form, version),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
      queryClient.invalidateQueries({ queryKey: ['products', id] })
      toast.success('Product updated')
    },
    onError: (error: Error) => {
      if (isConflictError(error)) {
        toast.error(error.message)
        queryClient.invalidateQueries({ queryKey: ['products'] })
        return
      }
      toast.error(error.message)
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
    onError: (error: Error) => toast.error(error.message),
  })
}

export function useCreateVariety() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      productId,
      form,
      sourceVarietyId,
    }: {
      productId: string
      form: ProductVarietyFormData
      sourceVarietyId?: string
    }) => createVariety(productId, form, sourceVarietyId),
    onSuccess: (_, { productId }) => {
      queryClient.invalidateQueries({ queryKey: ['products', productId] })
      queryClient.invalidateQueries({ queryKey: ['products'] })
      toast.success('Variety created')
    },
    onError: (error: Error) => toast.error(error.message),
  })
}

export function useUpdateVariety() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      id,
      form,
      sellingPriceReason,
    }: {
      id: string
      form: ProductVarietyFormData
      sellingPriceReason?: string
    }) => updateVariety(id, form, sellingPriceReason),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['varieties', id] })
      queryClient.invalidateQueries({ queryKey: ['products'] })
      toast.success('Variety updated')
    },
    onError: (error: Error) => toast.error(error.message),
  })
}

export function useSetVarietyCatalogueVisibility() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      varietyId,
      visible,
    }: {
      varietyId: string
      productId: string
      visible: boolean
    }) => setVarietyCatalogueVisibility(varietyId, visible),
    onSuccess: (_, { varietyId, productId, visible }) => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
      queryClient.invalidateQueries({ queryKey: ['products', productId] })
      queryClient.invalidateQueries({ queryKey: ['varieties', varietyId] })
      toast.success(visible ? 'Added to catalogue' : 'Removed from catalogue')
    },
    onError: (error: Error) => toast.error(error.message),
  })
}

export function useDeleteVariety() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id }: { id: string; productId: string }) =>
      deleteVariety(id),
    onSuccess: (_, { productId }) => {
      queryClient.invalidateQueries({ queryKey: ['products', productId] })
      queryClient.invalidateQueries({ queryKey: ['products'] })
      toast.success('Variety deleted')
    },
    onError: (error: Error) => toast.error(error.message),
  })
}

export function useAddVarietyIngredient() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      varietyId,
      ingredientId,
      quantityUsed,
      unit,
    }: {
      varietyId: string
      ingredientId: string
      quantityUsed: number
      unit: string
    }) => addVarietyIngredient(varietyId, ingredientId, quantityUsed, unit),
    onSuccess: (_, { varietyId }) => {
      queryClient.invalidateQueries({ queryKey: ['varieties', varietyId] })
      queryClient.invalidateQueries({ queryKey: ['products'] })
      toast.success('Ingredient added to recipe')
    },
    onError: (error: Error) => toast.error(error.message),
  })
}

export function useUpdateVarietyIngredient() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      id,
      quantityUsed,
      unit,
    }: {
      id: string
      quantityUsed: number
      unit: string
      varietyId: string
    }) => updateVarietyIngredient(id, quantityUsed, unit),
    onSuccess: (_, { varietyId }) => {
      queryClient.invalidateQueries({ queryKey: ['varieties', varietyId] })
      queryClient.invalidateQueries({ queryKey: ['products'] })
    },
    onError: (error: Error) => toast.error(error.message),
  })
}

export function useRemoveVarietyIngredient() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, varietyId }: { id: string; varietyId: string }) =>
      removeVarietyIngredient(id, varietyId),
    onSuccess: (_, { varietyId }) => {
      queryClient.invalidateQueries({ queryKey: ['varieties', varietyId] })
      queryClient.invalidateQueries({ queryKey: ['products'] })
      toast.success('Ingredient removed from recipe')
    },
    onError: (error: Error) => toast.error(error.message),
  })
}

export function useRefreshVarietyFromBaseRecipe() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ varietyId, factor }: { varietyId: string; factor: number }) =>
      refreshVarietyFromBaseRecipe(varietyId, factor),
    onSuccess: (_, { varietyId }) => {
      queryClient.invalidateQueries({ queryKey: ['varieties', varietyId] })
      queryClient.invalidateQueries({ queryKey: ['products'] })
      toast.success('Recipe refreshed from base')
    },
    onError: (error: Error) => toast.error(error.message),
  })
}

export function useSetVarietyLocks() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ varietyId, form }: { varietyId: string; form: VarietyLockFormData }) =>
      setVarietyLocks(varietyId, form),
    onSuccess: (_, { varietyId }) => {
      queryClient.invalidateQueries({ queryKey: ['varieties', varietyId] })
      toast.success('Lock settings saved')
    },
    onError: (error: Error) => toast.error(error.message),
  })
}

export function useAddBaseRecipeIngredient() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (args: {
      versionId: string
      productId: string
      ingredientId: string
      quantityUsed: number
      unit: IngredientUnit
      scalingMode?: RecipeScalingMode
    }) =>
      addBaseRecipeIngredient(
        args.versionId,
        args.ingredientId,
        args.quantityUsed,
        args.unit,
        args.scalingMode
      ),
    onSuccess: (_, { productId }) => {
      queryClient.invalidateQueries({ queryKey: ['product-recipe-versions', productId] })
    },
    onError: (error: Error) => toast.error(error.message),
  })
}

export function useUpdateBaseRecipeIngredient() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (args: {
      id: string
      versionId: string
      productId: string
      quantityUsed: number
      unit: IngredientUnit
      scalingMode: RecipeScalingMode
    }) =>
      updateBaseRecipeIngredient(
        args.id,
        args.versionId,
        args.quantityUsed,
        args.unit,
        args.scalingMode
      ),
    onSuccess: (_, { productId }) => {
      queryClient.invalidateQueries({ queryKey: ['product-recipe-versions', productId] })
    },
    onError: (error: Error) => toast.error(error.message),
  })
}

export function useRemoveBaseRecipeIngredient() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (args: { id: string; versionId: string; productId: string }) =>
      removeBaseRecipeIngredient(args.id, args.versionId),
    onSuccess: (_, { productId }) => {
      queryClient.invalidateQueries({ queryKey: ['product-recipe-versions', productId] })
    },
    onError: (error: Error) => toast.error(error.message),
  })
}

export function useSaveRecipeVersionAsNew() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ productId, name, notes }: { productId: string; name: string; notes?: string }) =>
      saveRecipeVersionAsNew(productId, name, notes),
    onSuccess: (_, { productId }) => {
      queryClient.invalidateQueries({ queryKey: ['product-recipe-versions', productId] })
      toast.success('New recipe version saved')
    },
    onError: (error: Error) => toast.error(error.message),
  })
}

export function useSetCurrentRecipeVersion() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ productId, versionId }: { productId: string; versionId: string }) =>
      setCurrentRecipeVersion(productId, versionId),
    onSuccess: (_, { productId }) => {
      queryClient.invalidateQueries({ queryKey: ['product-recipe-versions', productId] })
      toast.success('Current recipe version updated')
    },
    onError: (error: Error) => toast.error(error.message),
  })
}

export function useEnsureRecipeVersion() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (productId: string) => ensureCurrentRecipeVersion(productId),
    onSuccess: (_, productId) => {
      queryClient.invalidateQueries({ queryKey: ['product-recipe-versions', productId] })
    },
  })
}

function invalidateAcceptanceQueries(
  queryClient: ReturnType<typeof useQueryClient>,
  varietyId: string
) {
  queryClient.invalidateQueries({ queryKey: ['varieties', varietyId] })
  queryClient.invalidateQueries({ queryKey: ['variety-acceptance', varietyId] })
  queryClient.invalidateQueries({ queryKey: ['variety-acceptance-history', varietyId] })
  queryClient.invalidateQueries({ queryKey: ['varieties', 'review'] })
  queryClient.invalidateQueries({ queryKey: ['products'] })
  queryClient.invalidateQueries({ queryKey: ['dashboard'] })
  queryClient.invalidateQueries({ queryKey: ['ingredient-price-impact'] })
}

export function useLatestAcceptance(varietyId: string) {
  return useQuery({
    queryKey: ['variety-acceptance', varietyId],
    queryFn: () => fetchLatestAcceptance(varietyId),
    enabled: Boolean(varietyId),
  })
}

export function useAcceptanceHistory(varietyId: string) {
  return useQuery({
    queryKey: ['variety-acceptance-history', varietyId],
    queryFn: () => fetchAcceptanceHistory(varietyId),
    enabled: Boolean(varietyId),
  })
}

export function useAcceptVarietyCost() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      varietyId,
      form,
    }: {
      varietyId: string
      form: AcceptVarietyFormData
    }) => acceptVarietyCost(varietyId, form),
    onSuccess: (_, { varietyId }) => {
      invalidateAcceptanceQueries(queryClient, varietyId)
      toast.success('Business position accepted')
    },
    onError: (error: Error) => toast.error(error.message),
  })
}

export function useAcceptVarietyAndReprice() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      varietyId,
      form,
    }: {
      varietyId: string
      form: AcceptAndRepriceFormData
    }) => acceptVarietyAndReprice(varietyId, form),
    onSuccess: (_, { varietyId }) => {
      invalidateAcceptanceQueries(queryClient, varietyId)
      queryClient.invalidateQueries({
        queryKey: ['variety-selling-price-history', varietyId],
      })
      toast.success('Selling price updated and position accepted')
    },
    onError: (error: Error) => toast.error(error.message),
  })
}
