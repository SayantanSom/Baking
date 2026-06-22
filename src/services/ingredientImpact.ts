import { supabase } from './supabase'
import type {
  IngredientPriceImpactRow,
  IngredientUsedInVariety,
  ProductVarietyIngredient,
} from '@/types/database'
import { getIngredientLineCost } from '@/lib/costCalculations'
import {
  computeMarginPercentage,
  computeMarginValue,
  getVarietyCostStatus,
  getVarietyMarginStatus,
} from '@/lib/bufferStatus'
import { calculatePercentageChange } from '@/lib/utils'
import { fetchIngredient } from './ingredients'
import { fetchLatestAcceptancesForVarieties } from './varietyAcceptance'

function relationOne<T>(value: T | T[] | null | undefined): T | null {
  if (value == null) return null
  return Array.isArray(value) ? (value[0] ?? null) : value
}

export async function fetchIngredientVarietyUsageCounts(): Promise<Record<string, number>> {
  const { data, error } = await supabase
    .from('product_variety_ingredients')
    .select('ingredient_id')

  if (error) throw error

  const counts: Record<string, number> = {}
  for (const row of data ?? []) {
    counts[row.ingredient_id] = (counts[row.ingredient_id] ?? 0) + 1
  }
  return counts
}

export async function fetchVarietiesUsingIngredient(
  ingredientId: string
): Promise<IngredientUsedInVariety[]> {
  const { data, error } = await supabase
    .from('product_variety_ingredients')
    .select(
      `
      quantity_used,
      unit,
      product_variety:product_varieties (
        id,
        variety_name,
        size_label,
        product_id,
        product:products (name)
      )
    `
    )
    .eq('ingredient_id', ingredientId)

  if (error) throw error

  return (data ?? []).flatMap((row) => {
    const v = relationOne(row.product_variety)
    const product = v ? relationOne(v.product) : null
    if (!v || !product) return []

    return [
      {
        product_id: v.product_id,
        product_name: product.name,
        variety_id: v.id,
        variety_name: v.variety_name,
        size_label: v.size_label,
        quantity_used: row.quantity_used,
        unit: row.unit,
      },
    ]
  })
}

function simulateTotalCost(
  lines: ProductVarietyIngredient[],
  targetIngredientId: string,
  newLineCost: number,
  packagingCost: number,
  labourCost: number,
  shippingCost: number
): number {
  const ingredientCost = lines.reduce((sum, item) => {
    if (item.ingredient_id === targetIngredientId) {
      return sum + newLineCost
    }
    return sum + item.calculated_cost
  }, 0)
  return ingredientCost + packagingCost + labourCost + shippingCost
}

export async function fetchIngredientPriceImpact(
  ingredientId: string
): Promise<IngredientPriceImpactRow[]> {
  const ingredient = await fetchIngredient(ingredientId)
  const activeVendor = ingredient.active_vendor_price
  if (!activeVendor) return []

  const { data, error } = await supabase
    .from('product_variety_ingredients')
    .select(
      `
      id,
      ingredient_id,
      quantity_used,
      unit,
      calculated_cost,
      product_variety:product_varieties (
        id,
        product_id,
        variety_name,
        size_label,
        selling_price,
        current_cost_price,
        packaging_cost,
        labour_cost,
        shipping_cost,
        buffer_percentage,
        product_variety_ingredients (${`
          id,
          ingredient_id,
          quantity_used,
          unit,
          calculated_cost,
          ingredient:ingredients (
            *,
            active_vendor_price:ingredient_vendor_prices!fk_ingredients_active_vendor_price (*)
          ),
          vendor_price:ingredient_vendor_prices (*)
        `}),
        product:products (name)
      )
    `
    )
    .eq('ingredient_id', ingredientId)

  if (error) throw error

  const varietyIds = [
    ...new Set(
      (data ?? [])
        .map((row) => relationOne(row.product_variety)?.id)
        .filter(Boolean) as string[]
    ),
  ]
  const acceptances = await fetchLatestAcceptancesForVarieties(varietyIds)

  return (data ?? []).flatMap((row) => {
    const v = relationOne(row.product_variety)
    const product = v ? relationOne(v.product) : null
    if (!v || !product) return []

    const recipeLines = (v.product_variety_ingredients ??
      []) as unknown as ProductVarietyIngredient[]
    const shipping = v.shipping_cost ?? 0
    const buffer = v.buffer_percentage ?? 5
    const acceptance = acceptances[v.id]

    const oldContribution = row.calculated_cost
    const newContribution = getIngredientLineCost(
      row.quantity_used,
      row.unit,
      ingredient,
      activeVendor
    )

    const totalBefore = v.current_cost_price
    const totalAfter = simulateTotalCost(
      recipeLines,
      ingredientId,
      newContribution,
      v.packaging_cost,
      v.labour_cost,
      shipping
    )

    const selling = v.selling_price
    const marginBefore = computeMarginValue(selling, totalBefore)
    const marginAfter = computeMarginValue(selling, totalAfter)

    const costChangePct = acceptance
      ? calculatePercentageChange(acceptance.accepted_cost_price, totalAfter)
      : calculatePercentageChange(totalBefore, totalAfter)

    const costBaseline = acceptance?.accepted_cost_price ?? totalBefore
    const costStatus = getVarietyCostStatus(
      totalAfter,
      costBaseline,
      buffer
    ).status

    let marginStatus = costStatus
    let marginValueDelta = marginAfter - marginBefore
    let marginPpDelta =
      computeMarginPercentage(selling, totalAfter) -
      computeMarginPercentage(selling, totalBefore)

    if (acceptance) {
      const simulatedMargin = getVarietyMarginStatus(
        selling,
        totalAfter,
        {
          ...acceptance,
          accepted_margin_value: acceptance.accepted_margin_value,
          accepted_margin_percentage: acceptance.accepted_margin_percentage,
        },
        buffer
      )
      marginStatus = simulatedMargin.status
      marginValueDelta =
        simulatedMargin.currentMarginValue - acceptance.accepted_margin_value
      marginPpDelta =
        simulatedMargin.currentMarginPct - acceptance.accepted_margin_percentage
    }

    const varietyLabel = [v.size_label, v.variety_name].filter(Boolean).join(' ')

    return [
      {
        variety_id: v.id,
        product_id: v.product_id,
        product_name: product.name,
        variety_label: varietyLabel || v.variety_name,
        quantity_used: row.quantity_used,
        unit: row.unit,
        old_contribution: oldContribution,
        new_contribution: newContribution,
        difference: newContribution - oldContribution,
        total_cost_before: totalBefore,
        total_cost_after: totalAfter,
        cost_change_percentage: costChangePct,
        margin_before: marginBefore,
        margin_after: marginAfter,
        margin_value_delta: marginValueDelta,
        margin_pp_delta: marginPpDelta,
        cost_status: costStatus,
        margin_status: marginStatus,
        variety_buffer_percentage: buffer,
      },
    ]
  })
}
