import { supabase } from './supabase'
import { recalculateProductCost } from './products'

export async function recalculateAffectedProducts(
  ingredientId: string
): Promise<void> {
  const { data, error } = await supabase
    .from('product_ingredients')
    .select('product_id')
    .eq('ingredient_id', ingredientId)

  if (error) throw error

  const productIds = [...new Set((data ?? []).map((r) => r.product_id))]

  for (const productId of productIds) {
    await recalculateProductCost(productId, true)
  }
}
