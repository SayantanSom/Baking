import { supabase } from './supabase'
import type {
  Ingredient,
  IngredientFormData,
  IngredientVendorPrice,
  IngredientVendorPriceHistory,
  VendorPriceFormData,
} from '@/types/database'
import { calculateCostPerBaseUnit, convertToBaseUnit } from '@/lib/unitConversion'
import {
  calculatePercentageChange,
  getCostStatus,
} from '@/lib/utils'
import { recalculateAffectedVarieties } from './costMonitoring'

const INGREDIENT_SELECT = `
  *,
  active_vendor_price:ingredient_vendor_prices!fk_ingredients_active_vendor_price (*)
`

async function recordVendorPriceHistory(
  ingredient: Ingredient,
  vendorPrice: IngredientVendorPrice,
  previous: IngredientVendorPrice | undefined
): Promise<void> {
  const prevCost = previous?.cost_per_base_unit ?? 0
  const newCost = vendorPrice.cost_per_base_unit

  if (prevCost > 0 && Math.abs(newCost - prevCost) < 0.000001 && previous) {
    const packSame =
      previous.pack_cost === vendorPrice.pack_cost &&
      previous.pack_size === vendorPrice.pack_size
    if (packSame) return
  }

  const percentageChange = calculatePercentageChange(prevCost, newCost)
  const status = getCostStatus(
    percentageChange,
    ingredient.default_buffer_percentage
  )

  let convertedPackSize: number | null = null
  try {
    convertedPackSize = convertToBaseUnit(
      vendorPrice.pack_size,
      vendorPrice.pack_unit,
      ingredient.base_unit
    )
  } catch {
    convertedPackSize = null
  }

  await supabase.from('ingredient_vendor_price_history').insert({
    ingredient_id: ingredient.id,
    vendor_price_id: vendorPrice.id,
    vendor_name: vendorPrice.vendor_name,
    pack_size: vendorPrice.pack_size,
    pack_unit: vendorPrice.pack_unit,
    pack_cost: vendorPrice.pack_cost,
    converted_pack_size: convertedPackSize,
    previous_pack_cost: previous?.pack_cost ?? null,
    previous_cost_per_base_unit: prevCost,
    new_cost_per_base_unit: newCost,
    percentage_change: percentageChange,
    buffer_percentage_at_time: ingredient.default_buffer_percentage,
    status,
    checked_at: vendorPrice.last_checked_at,
  })
}

export async function fetchIngredients(): Promise<Ingredient[]> {
  const { data, error } = await supabase
    .from('ingredients')
    .select(INGREDIENT_SELECT)
    .order('name')

  if (error) throw error
  return data ?? []
}

export async function fetchIngredient(id: string): Promise<Ingredient> {
  const { data, error } = await supabase
    .from('ingredients')
    .select(INGREDIENT_SELECT)
    .eq('id', id)
    .single()

  if (error) throw error
  return data
}

import { ConflictError } from '@/lib/errors'

export async function createIngredient(
  enterpriseId: string,
  createdBy: string,
  form: IngredientFormData
): Promise<Ingredient> {
  const { data, error } = await supabase
    .from('ingredients')
    .insert({
      enterprise_id: enterpriseId,
      created_by: createdBy,
      name: form.name.trim(),
      base_unit: form.base_unit,
      default_buffer_percentage: form.default_buffer_percentage,
      notes: form.notes.trim() || null,
      version: 1,
    })
    .select(INGREDIENT_SELECT)
    .single()

  if (error) throw error
  return data
}

export async function updateIngredient(
  id: string,
  form: IngredientFormData,
  expectedVersion: number
): Promise<Ingredient> {
  const { data, error } = await supabase
    .from('ingredients')
    .update({
      name: form.name.trim(),
      base_unit: form.base_unit,
      default_buffer_percentage: form.default_buffer_percentage,
      notes: form.notes.trim() || null,
      version: expectedVersion + 1,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('version', expectedVersion)
    .select(INGREDIENT_SELECT)
    .maybeSingle()

  if (error) throw error
  if (!data) {
    throw new ConflictError()
  }
  return data
}

export async function deleteIngredient(id: string): Promise<void> {
  const { error } = await supabase.from('ingredients').delete().eq('id', id)
  if (error) throw error
}

export async function fetchVendorPrices(
  ingredientId: string
): Promise<IngredientVendorPrice[]> {
  const { data, error } = await supabase
    .from('ingredient_vendor_prices')
    .select('*')
    .eq('ingredient_id', ingredientId)
    .order('cost_per_base_unit')

  if (error) throw error
  return data ?? []
}

export async function fetchIngredientVendorCounts(): Promise<Record<string, number>> {
  const { data, error } = await supabase
    .from('ingredient_vendor_prices')
    .select('ingredient_id')

  if (error) throw error

  const counts: Record<string, number> = {}
  for (const row of data ?? []) {
    counts[row.ingredient_id] = (counts[row.ingredient_id] ?? 0) + 1
  }
  return counts
}

export async function createVendorPrice(
  ingredientId: string,
  form: VendorPriceFormData,
  baseUnit: string
): Promise<{ vendor: IngredientVendorPrice; affectedCount: number }> {
  const costPerBaseUnit = calculateCostPerBaseUnit(
    form.pack_cost,
    form.pack_size,
    form.pack_unit,
    baseUnit as Ingredient['base_unit']
  )

  const { data, error } = await supabase
    .from('ingredient_vendor_prices')
    .insert({
      ingredient_id: ingredientId,
      vendor_name: form.vendor_name,
      pack_size: form.pack_size,
      pack_unit: form.pack_unit,
      pack_cost: form.pack_cost,
      cost_per_base_unit: costPerBaseUnit,
      is_active: form.is_active,
      product_url: form.product_url.trim() || null,
      last_checked_at: form.last_checked_at ?? new Date().toISOString(),
    })
    .select()
    .single()

  if (error) throw error

  let affectedCount = 0
  if (form.is_active) {
    affectedCount = await setActiveVendorPrice(ingredientId, data.id)
  }

  return { vendor: data, affectedCount }
}

export async function updateVendorPrice(
  id: string,
  ingredientId: string,
  form: VendorPriceFormData,
  baseUnit: string
): Promise<{ vendor: IngredientVendorPrice; affectedCount: number }> {
  const ingredient = await fetchIngredient(ingredientId)
  const existing = (await fetchVendorPrices(ingredientId)).find((v) => v.id === id)
  if (!existing) throw new Error('Vendor price not found')

  const costPerBaseUnit = calculateCostPerBaseUnit(
    form.pack_cost,
    form.pack_size,
    form.pack_unit,
    baseUnit as Ingredient['base_unit']
  )

  const wasActive = existing.is_active

  const { data, error } = await supabase
    .from('ingredient_vendor_prices')
    .update({
      vendor_name: form.vendor_name,
      pack_size: form.pack_size,
      pack_unit: form.pack_unit,
      pack_cost: form.pack_cost,
      cost_per_base_unit: costPerBaseUnit,
      product_url: form.product_url.trim() || null,
      last_checked_at: form.last_checked_at ?? new Date().toISOString(),
      is_active: form.is_active,
    })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error

  const costChanged =
    existing.pack_cost !== form.pack_cost ||
    existing.pack_size !== form.pack_size ||
    existing.pack_unit !== form.pack_unit ||
    Math.abs(existing.cost_per_base_unit - costPerBaseUnit) > 0.000001

  if (costChanged) {
    await recordVendorPriceHistory(ingredient, data, existing)
  }

  let affectedCount = 0
  if (form.is_active) {
    if (!wasActive) {
      affectedCount = await setActiveVendorPrice(ingredientId, id)
    } else if (costChanged) {
      affectedCount = await recalculateAffectedVarieties(ingredientId)
    }
  }

  return { vendor: data, affectedCount }
}

export async function deleteVendorPrice(
  id: string,
  ingredientId: string
): Promise<void> {
  const ingredient = await fetchIngredient(ingredientId)
  if (ingredient.active_vendor_price_id === id) {
    await supabase
      .from('ingredients')
      .update({ active_vendor_price_id: null })
      .eq('id', ingredientId)
  }

  const { error } = await supabase
    .from('ingredient_vendor_prices')
    .delete()
    .eq('id', id)

  if (error) throw error
}

export async function setActiveVendorPrice(
  ingredientId: string,
  vendorPriceId: string,
  previousActiveCost?: number
): Promise<number> {
  const ingredient = await fetchIngredient(ingredientId)
  const prices = await fetchVendorPrices(ingredientId)
  const newPrice = prices.find((p) => p.id === vendorPriceId)
  if (!newPrice) throw new Error('Vendor price not found')

  const oldActive = prices.find((p) => p.is_active)
  const oldVendorName = oldActive?.vendor_name ?? 'None'
  const prevCost =
    previousActiveCost ??
    oldActive?.cost_per_base_unit ??
    ingredient.active_vendor_price?.cost_per_base_unit ??
    0

  await supabase
    .from('ingredient_vendor_prices')
    .update({ is_active: false })
    .eq('ingredient_id', ingredientId)

  await supabase
    .from('ingredient_vendor_prices')
    .update({ is_active: true })
    .eq('id', vendorPriceId)

  await supabase
    .from('ingredients')
    .update({ active_vendor_price_id: vendorPriceId })
    .eq('id', ingredientId)

  const updatedPrice = (await fetchVendorPrices(ingredientId)).find(
    (p) => p.id === vendorPriceId
  )!

  if (
    prevCost > 0 &&
    Math.abs(updatedPrice.cost_per_base_unit - prevCost) > 0.000001
  ) {
    await recordVendorPriceHistory(ingredient, updatedPrice, oldActive)
  } else if (!oldActive) {
    await recordVendorPriceHistory(ingredient, updatedPrice, undefined)
  }

  const reason = `Active supplier changed from ${oldVendorName} to ${newPrice.vendor_name}`
  const varietyIds = await recalculateAffectedVarietiesWithReason(
    ingredientId,
    reason
  )

  return varietyIds
}

async function recalculateAffectedVarietiesWithReason(
  ingredientId: string,
  reason: string
): Promise<number> {
  const { data, error } = await supabase
    .from('product_variety_ingredients')
    .select('product_variety_id')
    .eq('ingredient_id', ingredientId)

  if (error) throw error

  const varietyIds = [...new Set((data ?? []).map((r) => r.product_variety_id))]
  const { recalculateVarietyCost } = await import('./products')
  const { recalculateRecipeVersionsUsingIngredient } = await import(
    './recipeVersions'
  )

  for (const varietyId of varietyIds) {
    await recalculateVarietyCost(varietyId, true, reason)
  }
  await recalculateRecipeVersionsUsingIngredient(ingredientId)

  return varietyIds.length
}

export async function useCheapestVendor(
  ingredientId: string
): Promise<number> {
  const prices = await fetchVendorPrices(ingredientId)
  if (prices.length === 0) throw new Error('No vendor prices available')

  const cheapest = prices.reduce((min, p) =>
    p.cost_per_base_unit < min.cost_per_base_unit ? p : min
  )

  return setActiveVendorPrice(ingredientId, cheapest.id)
}

export async function fetchIngredientVendorPriceHistory(
  ingredientId: string
): Promise<IngredientVendorPriceHistory[]> {
  const { data, error } = await supabase
    .from('ingredient_vendor_price_history')
    .select('*')
    .eq('ingredient_id', ingredientId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data ?? []
}

/** @deprecated Use fetchIngredientVendorPriceHistory */
export const fetchIngredientPriceHistory = fetchIngredientVendorPriceHistory

export async function fetchRecentlyUpdatedIngredients(
  limit = 5
): Promise<Ingredient[]> {
  const { data, error } = await supabase
    .from('ingredients')
    .select(INGREDIENT_SELECT)
    .order('updated_at', { ascending: false })
    .limit(limit)

  if (error) throw error
  return data ?? []
}

export async function searchIngredients(query: string): Promise<Ingredient[]> {
  const { data, error } = await supabase
    .from('ingredients')
    .select(INGREDIENT_SELECT)
    .ilike('name', `%${query}%`)
    .order('name')

  if (error) throw error
  return data ?? []
}
