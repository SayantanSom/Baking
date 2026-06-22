import { useQuery } from '@tanstack/react-query'
import { fetchIngredients } from '@/services/ingredients'
import { fetchProducts, fetchAllCostHistory } from '@/services/products'
import { fetchProductsRequiringReview } from '@/services/products'
import { fetchRecentlyUpdatedIngredients } from '@/services/ingredients'

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

  const reviewProducts = useQuery({
    queryKey: ['products', 'review'],
    queryFn: fetchProductsRequiringReview,
  })

  const costHistory = useQuery({
    queryKey: ['dashboard', 'cost-history'],
    queryFn: fetchAllCostHistory,
  })

  const isLoading =
    ingredients.isLoading ||
    products.isLoading ||
    recentIngredients.isLoading ||
    reviewProducts.isLoading ||
    costHistory.isLoading

  const productsOverBuffer =
    reviewProducts.data?.filter((p) => p.latest_status === 'red').length ?? 0

  const productsNearBuffer =
    reviewProducts.data?.filter((p) => p.latest_status === 'amber').length ?? 0

  return {
    ingredients: ingredients.data ?? [],
    products: products.data ?? [],
    recentIngredients: recentIngredients.data ?? [],
    reviewProducts: reviewProducts.data ?? [],
    costHistory: costHistory.data ?? [],
    isLoading,
    stats: {
      totalIngredients: ingredients.data?.length ?? 0,
      totalProducts: products.data?.length ?? 0,
      productsOverBuffer,
      productsNearBuffer,
    },
  }
}
