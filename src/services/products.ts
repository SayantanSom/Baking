import { supabase } from './supabase'
import type {
  Product,
  ProductFormData,
  ProductVariety,
  ProductVarietyFormData,
  ProductVarietyIngredient,
  ProductVarietyWithRecipe,
  ProductWithVarieties,
  ProductVarietyCostHistory,
  ProductVarietySellingPriceHistory,
  DashboardSearchResult,
  VarietyLockFormData,
} from '@/types/database'
import { getVarietyCostStatus, getVarietyReviewStatus, needsReview } from '@/lib/bufferStatus'
import { calculateVarietyCost, getIngredientLineCost } from '@/lib/costCalculations'
import { calculatePercentageChange } from '@/lib/utils'
import { fetchLatestAcceptance, fetchLatestAcceptancesForVarieties } from './varietyAcceptance'
import { fetchIngredient } from './ingredients'
import {
  copyRecipeVersionToVariety,
  ensureCurrentRecipeVersion,
  fetchProductWithRecipeVersions,
  getCurrentRecipeVersion,
} from './recipeVersions'
import { isCostLocked, isPriceLocked } from '@/lib/varietyLocks'

const VARIETY_INGREDIENT_SELECT = `
  id,
  product_variety_id,
  ingredient_id,
  quantity_used,
  unit,
  active_vendor_price_id,
  calculated_cost,
  ingredient:ingredients (
    *,
    active_vendor_price:ingredient_vendor_prices!fk_ingredients_active_vendor_price (*)
  ),
  vendor_price:ingredient_vendor_prices (*)
`

async function markVarietyManualOverride(varietyId: string): Promise<void> {
  await supabase
    .from('product_varieties')
    .update({ has_manual_recipe_overrides: true })
    .eq('id', varietyId)
}

export async function fetchProducts(): Promise<Product[]> {
  const { data, error } = await supabase.from('products').select('*').order('name')
  if (error) throw error
  return data ?? []
}

export async function fetchProductsWithVarieties(): Promise<ProductWithVarieties[]> {
  const { data, error } = await supabase
    .from('products')
    .select('*, product_varieties (*)')
    .order('name')

  if (error) throw error

  return (data ?? []).map((product) => ({
    ...product,
    product_varieties: [...(product.product_varieties ?? [])].sort((a, b) =>
      [a.size_label, a.variety_name].filter(Boolean).join(' ')
        .localeCompare([b.size_label, b.variety_name].filter(Boolean).join(' '))
    ),
  })) as ProductWithVarieties[]
}

export async function setVarietyCatalogueVisibility(
  varietyId: string,
  isCatalogueVisible: boolean
): Promise<void> {
  const { error } = await supabase
    .from('product_varieties')
    .update({ is_catalogue_visible: isCatalogueVisible })
    .eq('id', varietyId)

  if (error) throw error
}

export async function fetchProductWithVarieties(
  id: string
): Promise<ProductWithVarieties> {
  const { data, error } = await supabase
    .from('products')
    .select('*, product_varieties (*)')
    .eq('id', id)
    .single()

  if (error) throw error
  return data as ProductWithVarieties
}

export async function fetchVarietyWithRecipe(
  id: string
): Promise<ProductVarietyWithRecipe> {
  const { data, error } = await supabase
    .from('product_varieties')
    .select(
      `
      *,
      product:products (*),
      source_recipe_version:product_recipe_versions (*),
      product_variety_ingredients (${VARIETY_INGREDIENT_SELECT})
    `
    )
    .eq('id', id)
    .single()

  if (error) throw error
  return data as ProductVarietyWithRecipe
}

import { ConflictError } from '@/lib/errors'

export async function createProduct(
  enterpriseId: string,
  createdBy: string,
  form: ProductFormData
): Promise<Product> {
  const { data, error } = await supabase
    .from('products')
    .insert({
      enterprise_id: enterpriseId,
      created_by: createdBy,
      name: form.name.trim(),
      description: form.description.trim() || null,
      category: form.category.trim() || null,
      image_url: form.image_url.trim() || null,
      version: 1,
    })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function updateProduct(
  id: string,
  form: ProductFormData,
  expectedVersion: number
): Promise<Product> {
  const { data, error } = await supabase
    .from('products')
    .update({
      name: form.name.trim(),
      description: form.description.trim() || null,
      category: form.category.trim() || null,
      image_url: form.image_url.trim() || null,
      version: expectedVersion + 1,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('version', expectedVersion)
    .select()
    .maybeSingle()

  if (error) throw error
  if (!data) {
    throw new ConflictError()
  }
  return data
}

export async function deleteProduct(id: string): Promise<void> {
  const { error } = await supabase.from('products').delete().eq('id', id)
  if (error) throw error
}

export async function recordSellingPriceHistory(
  varietyId: string,
  previous: number,
  next: number,
  reason?: string
): Promise<void> {
  if (Math.abs(next - previous) < 0.0001) return
  const percentageChange = calculatePercentageChange(previous, next)
  await supabase.from('product_variety_selling_price_history').insert({
    product_variety_id: varietyId,
    previous_selling_price: previous,
    new_selling_price: next,
    percentage_change: percentageChange,
    reason: reason ?? null,
  })
}

export async function createVarietyFromBaseRecipe(
  productId: string,
  form: ProductVarietyFormData
): Promise<ProductVariety> {
  const currentVersion = await ensureCurrentRecipeVersion(productId)
  const product = await fetchProductWithRecipeVersions(productId)
  const version = getCurrentRecipeVersion(product)
  const lines = version?.product_base_recipe_ingredients ?? []

  if (lines.length === 0) {
    throw new Error('Add a base recipe before creating varieties')
  }

  const now = new Date().toISOString()
  const { data, error } = await supabase
    .from('product_varieties')
    .insert({
      product_id: productId,
      variety_name: form.variety_name.trim(),
      size_label: form.size_label.trim() || null,
      sku: form.sku.trim() || null,
      selling_price: form.selling_price,
      recipe_yield: form.recipe_yield,
      packaging_cost: form.packaging_cost,
      labour_cost: form.labour_cost,
      shipping_cost: form.shipping_cost,
      buffer_percentage: form.buffer_percentage ?? 5,
      is_catalogue_visible: form.is_catalogue_visible,
      base_recipe_factor: form.base_recipe_factor ?? 1,
      source_recipe_version_id: currentVersion.id,
      created_from_base_recipe_at: now,
      last_base_recipe_sync_at: now,
      has_manual_recipe_overrides: false,
    })
    .select()
    .single()

  if (error) throw error

  await copyRecipeVersionToVariety(
    data.id,
    currentVersion.id,
    form.base_recipe_factor ?? 1,
    'Created from base recipe'
  )

  const { data: updated } = await supabase
    .from('product_varieties')
    .select('*')
    .eq('id', data.id)
    .single()

  const variety = updated ?? data
  await recalculateVarietyCost(variety.id, false)

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (user) {
    const { createInitialAcceptance } = await import('./varietyAcceptance')
    await createInitialAcceptance(variety.id, user.id)
  }

  const { data: final } = await supabase
    .from('product_varieties')
    .select('*')
    .eq('id', data.id)
    .single()

  return final ?? variety
}

export async function createVariety(
  productId: string,
  form: ProductVarietyFormData
): Promise<ProductVariety> {
  return createVarietyFromBaseRecipe(productId, form)
}

export async function updateVariety(
  id: string,
  form: ProductVarietyFormData,
  sellingPriceReason?: string
): Promise<ProductVariety> {
  const existing = await supabase
    .from('product_varieties')
    .select('*')
    .eq('id', id)
    .single()

  if (existing.error) throw existing.error
  const prev = existing.data

  const sellingChanged =
    Math.abs(prev.selling_price - form.selling_price) > 0.0001
  const costDriversChanged =
    prev.recipe_yield !== form.recipe_yield ||
    Math.abs(prev.packaging_cost - form.packaging_cost) > 0.0001 ||
    Math.abs(prev.labour_cost - form.labour_cost) > 0.0001 ||
    Math.abs((prev.shipping_cost ?? 0) - form.shipping_cost) > 0.0001

  if (sellingChanged) {
    await recordSellingPriceHistory(
      id,
      prev.selling_price,
      form.selling_price,
      sellingPriceReason
    )
  }

  const { data, error } = await supabase
    .from('product_varieties')
    .update({
      variety_name: form.variety_name.trim(),
      size_label: form.size_label.trim() || null,
      sku: form.sku.trim() || null,
      selling_price: form.selling_price,
      recipe_yield: form.recipe_yield,
      packaging_cost: form.packaging_cost,
      labour_cost: form.labour_cost,
      shipping_cost: form.shipping_cost,
      buffer_percentage: form.buffer_percentage ?? prev.buffer_percentage ?? 5,
      is_catalogue_visible: form.is_catalogue_visible,
      base_recipe_factor: form.base_recipe_factor ?? prev.base_recipe_factor ?? 1,
    })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error

  await recalculateVarietyCost(id, costDriversChanged, undefined)
  return data
}

export async function refreshVarietyFromBaseRecipe(
  varietyId: string,
  factor: number
): Promise<void> {
  const variety = await fetchVarietyWithRecipe(varietyId)
  const productId = variety.product_id
  const product = await fetchProductWithRecipeVersions(productId)
  const current = getCurrentRecipeVersion(product)
  if (!current) throw new Error('No current base recipe')

  await copyRecipeVersionToVariety(
    varietyId,
    current.id,
    factor,
    'Refreshed from base recipe'
  )
}

export async function setVarietyLocks(
  varietyId: string,
  form: VarietyLockFormData
): Promise<ProductVariety> {
  const variety = await fetchVarietyWithRecipe(varietyId)
  const updates: Record<string, string | number | null> = {}

  if (form.price_locked_until) {
    updates.price_locked_until = form.price_locked_until
    updates.locked_selling_price = variety.selling_price
  } else {
    updates.price_locked_until = null
    updates.locked_selling_price = null
  }

  if (form.cost_locked_until) {
    updates.cost_locked_until = form.cost_locked_until
    updates.locked_cost_price = variety.current_cost_price
  } else {
    updates.cost_locked_until = null
    updates.locked_cost_price = null
  }

  const { data, error } = await supabase
    .from('product_varieties')
    .update(updates)
    .eq('id', varietyId)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function deleteVariety(id: string): Promise<void> {
  const { error } = await supabase.from('product_varieties').delete().eq('id', id)
  if (error) throw error
}

export async function addVarietyIngredient(
  varietyId: string,
  ingredientId: string,
  quantityUsed: number,
  unit: string
): Promise<ProductVarietyIngredient> {
  const ingredient = await fetchIngredient(ingredientId)
  const vendorPriceId = ingredient.active_vendor_price_id

  const { data, error } = await supabase
    .from('product_variety_ingredients')
    .insert({
      product_variety_id: varietyId,
      ingredient_id: ingredientId,
      quantity_used: quantityUsed,
      unit,
      active_vendor_price_id: vendorPriceId,
      calculated_cost: 0,
    })
    .select()
    .single()

  if (error) throw error
  await markVarietyManualOverride(varietyId)
  await recalculateVarietyCost(varietyId)
  return data
}

export async function updateVarietyIngredient(
  id: string,
  quantityUsed: number,
  unit: string
): Promise<void> {
  const { data, error } = await supabase
    .from('product_variety_ingredients')
    .update({ quantity_used: quantityUsed, unit })
    .eq('id', id)
    .select('product_variety_id')
    .single()

  if (error) throw error
  await markVarietyManualOverride(data.product_variety_id)
  await recalculateVarietyCost(data.product_variety_id)
}

export async function removeVarietyIngredient(
  id: string,
  varietyId: string
): Promise<void> {
  const { error } = await supabase
    .from('product_variety_ingredients')
    .delete()
    .eq('id', id)

  if (error) throw error
  await markVarietyManualOverride(varietyId)
  await recalculateVarietyCost(varietyId)
}

export async function recalculateVarietyCost(
  varietyId: string,
  recordHistory = true,
  reason?: string
): Promise<number> {
  const variety = await fetchVarietyWithRecipe(varietyId)
  const breakdown = calculateVarietyCost(
    variety.product_variety_ingredients,
    variety.packaging_cost,
    variety.labour_cost,
    variety.shipping_cost ?? 0,
    variety.selling_price,
    variety.recipe_yield
  )

  for (const item of variety.product_variety_ingredients) {
    const vendorPrice =
      item.vendor_price ?? item.ingredient?.active_vendor_price
    const lineCost = getIngredientLineCost(
      item.quantity_used,
      item.unit,
      item.ingredient,
      vendorPrice
    )

    await supabase
      .from('product_variety_ingredients')
      .update({
        calculated_cost: lineCost,
        active_vendor_price_id:
          vendorPrice?.id ?? item.ingredient?.active_vendor_price_id ?? null,
      })
      .eq('id', item.id)
  }

  const previousCost = variety.current_cost_price
  const newCost = breakdown.totalCost
  const grossMargin = variety.selling_price - newCost

  await supabase
    .from('product_varieties')
    .update({
      current_cost_price: newCost,
      gross_margin: grossMargin,
    })
    .eq('id', varietyId)

  if (
    recordHistory &&
    previousCost > 0 &&
    Math.abs(newCost - previousCost) > 0.0001
  ) {
    const acceptance = await fetchLatestAcceptance(varietyId)
    const buffer = variety.buffer_percentage ?? 5
    const baseline = acceptance?.accepted_cost_price ?? previousCost
    const { status, changePct } = getVarietyCostStatus(newCost, baseline, buffer)

    await supabase.from('product_variety_cost_history').insert({
      product_variety_id: varietyId,
      previous_cost_price: previousCost,
      new_cost_price: newCost,
      percentage_change: changePct,
      status,
      reason: reason ?? 'Ingredient cost change',
    })
  }

  return newCost
}

export async function fetchVarietySellingPriceHistory(
  varietyId: string
): Promise<ProductVarietySellingPriceHistory[]> {
  const { data, error } = await supabase
    .from('product_variety_selling_price_history')
    .select('*')
    .eq('product_variety_id', varietyId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data ?? []
}

export async function fetchVarietyCostHistory(
  varietyId: string
): Promise<ProductVarietyCostHistory[]> {
  const { data, error } = await supabase
    .from('product_variety_cost_history')
    .select('*')
    .eq('product_variety_id', varietyId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data ?? []
}

export async function fetchAllVarietyCostHistory(): Promise<
  (ProductVarietyCostHistory & {
    product_variety?: ProductVariety & { product?: Product }
  })[]
> {
  const { data, error } = await supabase
    .from('product_variety_cost_history')
    .select('*, product_variety:product_varieties(*, product:products(*))')
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) throw error
  return data ?? []
}

export async function searchVarieties(
  query: string
): Promise<DashboardSearchResult[]> {
  const { data, error } = await supabase
    .from('product_varieties')
    .select('*, product:products(*)')
    .order('variety_name')

  if (error) throw error

  const q = query.toLowerCase().trim()
  const varietyIds = (data ?? []).map((v) => v.id)
  const acceptances = await fetchLatestAcceptancesForVarieties(varietyIds)

  const results = (data ?? [])
    .filter((v) => {
      if (!q) return true
      const product = v.product as Product
      return (
        product?.name?.toLowerCase().includes(q) ||
        v.variety_name?.toLowerCase().includes(q) ||
        v.size_label?.toLowerCase().includes(q) ||
        v.sku?.toLowerCase().includes(q) ||
        product?.category?.toLowerCase().includes(q) ||
        `${v.size_label} ${product?.name}`.toLowerCase().includes(q)
      )
    })
    .map((v) => {
      const product = v.product as Product
      const displayName = [v.size_label, product?.name]
        .filter(Boolean)
        .join(' ')
      const variety = v as ProductVariety
      const acceptance = acceptances[variety.id]
      const review = getVarietyReviewStatus(variety, acceptance)
      return {
        variety,
        product,
        displayName: displayName || v.variety_name,
        costStatus: review?.costStatus,
        marginStatus: review?.marginStatus,
        marginValueDelta: review?.marginValueDelta,
        marginPpDelta: review?.marginPpDelta,
        latestAcceptance: acceptance,
        priceProtected: isPriceLocked(variety),
        costLocked: isCostLocked(variety),
      }
    })

  return results
}

export async function fetchVarietiesRequiringReview(): Promise<
  DashboardSearchResult[]
> {
  const { data, error } = await supabase
    .from('product_varieties')
    .select('*, product:products(*)')

  if (error) throw error

  const varieties = data ?? []
  const acceptances = await fetchLatestAcceptancesForVarieties(
    varieties.map((v) => v.id)
  )

  return varieties
    .map((v) => {
      const product = v.product as Product
      const variety = v as ProductVariety
      const acceptance = acceptances[variety.id]
      const review = getVarietyReviewStatus(variety, acceptance)
      return {
        variety,
        product,
        displayName: [v.size_label, product?.name].filter(Boolean).join(' ') || v.variety_name,
        costStatus: review?.costStatus,
        marginStatus: review?.marginStatus,
        marginValueDelta: review?.marginValueDelta,
        marginPpDelta: review?.marginPpDelta,
        costChangePct: review?.costChangePct,
        latestAcceptance: acceptance,
        priceProtected: isPriceLocked(variety),
        costLocked: isCostLocked(variety),
      }
    })
    .filter((r) => {
      if (!r.latestAcceptance) return true
      if (!r.costStatus || !r.marginStatus) return true
      return needsReview(r.costStatus, r.marginStatus)
    })
}
