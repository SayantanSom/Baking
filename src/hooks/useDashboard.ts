import { useQuery } from '@tanstack/react-query'
import { fetchIngredients, fetchRecentlyUpdatedIngredients } from '@/services/ingredients'
import { fetchProducts, fetchAllVarietyCostHistory } from '@/services/products'
import { fetchVarietiesRequiringReview } from '@/services/products'

export function useDashboardData() {
  const ingredients = useQuery({
    queryKey: ['ingredients'],
    queryFn: fetchIngredients,
  })

  const products = useQuery({
    queryKey: ['products'],
    queryFn: fetchProducts,
  })

  const recentIngredients = useQuery({
    queryKey: ['ingredients', 'recent', 5],
    queryFn: () => fetchRecentlyUpdatedIngredients(5),
  })

  const reviewVarieties = useQuery({
    queryKey: ['varieties', 'review'],
    queryFn: fetchVarietiesRequiringReview,
  })

  const costHistory = useQuery({
    queryKey: ['dashboard', 'cost-history'],
    queryFn: fetchAllVarietyCostHistory,
  })

  const isLoading =
    ingredients.isLoading ||
    products.isLoading ||
    recentIngredients.isLoading ||
    reviewVarieties.isLoading ||
    costHistory.isLoading

  const varietiesOverBuffer =
    reviewVarieties.data?.filter(
      (v) => v.costStatus === 'red' || v.marginStatus === 'red'
    ).length ?? 0

  const varietiesNearBuffer =
    reviewVarieties.data?.filter(
      (v) =>
        (v.costStatus === 'amber' || v.marginStatus === 'amber') &&
        v.costStatus !== 'red' &&
        v.marginStatus !== 'red'
    ).length ?? 0

  return {
    ingredients: ingredients.data ?? [],
    products: products.data ?? [],
    recentIngredients: recentIngredients.data ?? [],
    reviewVarieties: reviewVarieties.data ?? [],
    costHistory: costHistory.data ?? [],
    isLoading,
    stats: {
      totalIngredients: ingredients.data?.length ?? 0,
      totalProducts: products.data?.length ?? 0,
      productsOverBuffer: varietiesOverBuffer,
      productsNearBuffer: varietiesNearBuffer,
    },
  }
}
