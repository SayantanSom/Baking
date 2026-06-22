import type {
  ProductVarietyIngredient,
  VarietyCostBreakdown,
  Ingredient,
  IngredientVendorPrice,
} from '@/types/database'
import { convertToBaseUnit } from './unitConversion'

export function getIngredientLineCost(
  quantityUsed: number,
  unit: string,
  ingredient: Ingredient | undefined,
  vendorPrice: IngredientVendorPrice | undefined
): number {
  if (!ingredient || !vendorPrice) return 0
  try {
    const baseQty = convertToBaseUnit(
      quantityUsed,
      unit as Ingredient['base_unit'],
      ingredient.base_unit
    )
    return baseQty * vendorPrice.cost_per_base_unit
  } catch {
    return 0
  }
}

export function calculateVarietyCost(
  recipe: ProductVarietyIngredient[],
  packagingCost: number,
  labourCost: number,
  shippingCost: number,
  sellingPrice: number,
  recipeYield = 1,
  taxPercentage = 0
): VarietyCostBreakdown {
  const ingredientCost = recipe.reduce((sum, item) => {
    const vendorPrice =
      item.vendor_price ??
      item.ingredient?.active_vendor_price
    return (
      sum +
      getIngredientLineCost(
        item.quantity_used,
        item.unit,
        item.ingredient,
        vendorPrice
      )
    )
  }, 0)

  const overheadCost = packagingCost + labourCost + shippingCost
  const totalCost = ingredientCost + overheadCost
  const netRevenue =
    taxPercentage > 0
      ? sellingPrice / (1 + taxPercentage / 100)
      : sellingPrice
  const taxOnSale = sellingPrice - netRevenue
  const grossMarginPreTax = sellingPrice - totalCost
  const grossMarginPostTax = netRevenue - totalCost
  const grossMarginPreTaxPercentage =
    sellingPrice > 0 ? (grossMarginPreTax / sellingPrice) * 100 : 0
  const grossMarginPostTaxPercentage =
    netRevenue > 0 ? (grossMarginPostTax / netRevenue) * 100 : 0
  const costPerUnit = recipeYield > 0 ? totalCost / recipeYield : totalCost

  return {
    ingredientCost,
    packagingCost,
    labourCost,
    shippingCost,
    overheadCost,
    totalCost,
    netRevenue,
    taxOnSale,
    grossMarginPreTax,
    grossMarginPreTaxPercentage,
    grossMarginPostTax,
    grossMarginPostTaxPercentage,
    grossMargin: grossMarginPreTax,
    grossMarginPercentage: grossMarginPreTaxPercentage,
    costPerUnit,
  }
}
