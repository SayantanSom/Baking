import type {
  ProductIngredient,
  ProductCostBreakdown,
  UserSettings,
} from '@/types/database'

export function calculateProductCost(
  recipe: ProductIngredient[],
  bufferPercentage: number,
  unitsPerBatch: number,
  settings?: Pick<
    UserSettings,
    'labour_cost_percentage' | 'packaging_cost_percentage' | 'tax_percentage'
  >
): ProductCostBreakdown {
  const ingredientCost = recipe.reduce((sum, item) => {
    const unitCost = item.ingredient?.unit_cost ?? 0
    return sum + item.quantity_used * unitCost
  }, 0)

  const costPrice = ingredientCost
  const labourCost = settings
    ? costPrice * (settings.labour_cost_percentage / 100)
    : 0
  const packagingCost = settings
    ? costPrice * (settings.packaging_cost_percentage / 100)
    : 0
  const subtotal = costPrice + labourCost + packagingCost
  const bufferedCost = subtotal * (1 + bufferPercentage / 100)
  const costPerUnit = unitsPerBatch > 0 ? bufferedCost / unitsPerBatch : bufferedCost
  const taxAmount = settings
    ? bufferedCost * (settings.tax_percentage / 100)
    : 0
  const totalWithTax = bufferedCost + taxAmount

  return {
    ingredientCost,
    costPrice,
    bufferedCost,
    costPerUnit,
    labourCost,
    packagingCost,
    taxAmount,
    totalWithTax,
  }
}
