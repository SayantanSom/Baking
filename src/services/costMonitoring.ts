import { supabase } from './supabase'
import { recalculateVarietyCost } from './products'
import { recalculateRecipeVersionsUsingIngredient } from './recipeVersions'

export async function recalculateAffectedVarieties(
  ingredientId: string
): Promise<number> {
  const { data, error } = await supabase
    .from('product_variety_ingredients')
    .select('product_variety_id')
    .eq('ingredient_id', ingredientId)

  if (error) throw error

  const varietyIds = [...new Set((data ?? []).map((r) => r.product_variety_id))]

  for (const varietyId of varietyIds) {
    await recalculateVarietyCost(
      varietyId,
      true,
      'Ingredient vendor price changed'
    )
  }

  await recalculateRecipeVersionsUsingIngredient(ingredientId)

  return varietyIds.length
}
