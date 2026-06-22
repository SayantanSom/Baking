import { supabase } from './supabase'
import type {
  ProductBaseRecipeIngredient,
  ProductRecipeVersion,
  ProductWithRecipeVersions,
  RecipeScalingMode,
  IngredientUnit,
  Ingredient,
  IngredientVendorPrice,
} from '@/types/database'
import { getIngredientLineCost } from '@/lib/costCalculations'
import { scaleQuantity } from '@/lib/recipeScaling'
import { fetchIngredient } from './ingredients'

async function getCurrentUserId(): Promise<string | null> {
  const { data: auth } = await supabase.auth.getUser()
  return auth.user?.id ?? null
}

const BASE_INGREDIENT_SELECT = `
  id,
  recipe_version_id,
  ingredient_id,
  quantity_used,
  unit,
  scaling_mode,
  active_vendor_price_id,
  calculated_cost,
  created_at,
  updated_at,
  ingredient:ingredients (
    *,
    active_vendor_price:ingredient_vendor_prices!fk_ingredients_active_vendor_price (*)
  ),
  vendor_price:ingredient_vendor_prices (*)
`

type BaseRecipeLine = ProductBaseRecipeIngredient & {
  ingredient?: Ingredient & { active_vendor_price?: IngredientVendorPrice | null }
  vendor_price?: IngredientVendorPrice | null
}

export async function fetchProductWithRecipeVersions(
  productId: string
): Promise<ProductWithRecipeVersions> {
  const { data, error } = await supabase
    .from('products')
    .select(
      `*,
      product_recipe_versions (
        *,
        product_base_recipe_ingredients (${BASE_INGREDIENT_SELECT})
      )`
    )
    .eq('id', productId)
    .single()

  if (error) throw error
  const versions = (data.product_recipe_versions ?? []).sort(
    (a: ProductRecipeVersion, b: ProductRecipeVersion) =>
      a.version_number - b.version_number
  )
  return { ...data, product_recipe_versions: versions } as ProductWithRecipeVersions
}

export function getCurrentRecipeVersion(
  product: ProductWithRecipeVersions
): (ProductRecipeVersion & { product_base_recipe_ingredients?: ProductBaseRecipeIngredient[] }) | undefined {
  return product.product_recipe_versions.find((v) => v.is_current)
}

export async function ensureCurrentRecipeVersion(
  productId: string,
  recipeYield = 1
): Promise<ProductRecipeVersion> {
  const product = await fetchProductWithRecipeVersions(productId)
  const current = getCurrentRecipeVersion(product)
  if (current) return current

  const createdBy = await getCurrentUserId()

  const { data, error } = await supabase
    .from('product_recipe_versions')
    .insert({
      product_id: productId,
      version_number: 1,
      name: 'Original Recipe',
      recipe_yield: Math.max(1, recipeYield),
      is_current: true,
      created_by: createdBy,
    })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function createRecipeVersion(
  productId: string,
  opts: { name: string; notes?: string; copyFromVersionId?: string; setCurrent?: boolean }
): Promise<ProductRecipeVersion> {
  const product = await fetchProductWithRecipeVersions(productId)
  const maxVersion = product.product_recipe_versions.reduce(
    (m, v) => Math.max(m, v.version_number),
    0
  )

  const createdBy = await getCurrentUserId()

  const { data: version, error } = await supabase
    .from('product_recipe_versions')
    .insert({
      product_id: productId,
      version_number: maxVersion + 1,
      name: opts.name,
      notes: opts.notes?.trim() || null,
      recipe_yield: 1,
      is_current: opts.setCurrent ?? false,
      created_by: createdBy,
    })
    .select()
    .single()

  if (error) throw error

  const sourceId =
    opts.copyFromVersionId ??
    getCurrentRecipeVersion(product)?.id

  if (sourceId) {
    const source = product.product_recipe_versions.find((v) => v.id === sourceId)
    const lines = source?.product_base_recipe_ingredients ?? []
    for (const line of lines) {
      await supabase.from('product_base_recipe_ingredients').insert({
        recipe_version_id: version.id,
        ingredient_id: line.ingredient_id,
        quantity_used: line.quantity_used,
        unit: line.unit,
        scaling_mode: line.scaling_mode,
        active_vendor_price_id: line.active_vendor_price_id,
        calculated_cost: line.calculated_cost,
      })
    }
    if (source) {
      await supabase
        .from('product_recipe_versions')
        .update({ recipe_yield: source.recipe_yield })
        .eq('id', version.id)
    }
  }

  if (opts.setCurrent) {
    await setCurrentRecipeVersion(productId, version.id)
  }

  return version
}

export async function saveRecipeVersionAsNew(
  productId: string,
  name: string,
  notes?: string
): Promise<ProductRecipeVersion> {
  const current = getCurrentRecipeVersion(await fetchProductWithRecipeVersions(productId))
  if (!current) throw new Error('No current recipe version')

  return createRecipeVersion(productId, {
    name,
    notes,
    copyFromVersionId: current.id,
    setCurrent: true,
  })
}

export async function setCurrentRecipeVersion(
  productId: string,
  versionId: string
): Promise<void> {
  await supabase
    .from('product_recipe_versions')
    .update({ is_current: false })
    .eq('product_id', productId)

  const { error } = await supabase
    .from('product_recipe_versions')
    .update({ is_current: true })
    .eq('id', versionId)

  if (error) throw error
}

export async function recalculateRecipeVersionCost(
  versionId: string
): Promise<number> {
  const { data: lines, error } = await supabase
    .from('product_base_recipe_ingredients')
    .select(BASE_INGREDIENT_SELECT)
    .eq('recipe_version_id', versionId)

  if (error) throw error

  const recipeLines = (lines ?? []) as unknown as BaseRecipeLine[]
  let total = 0
  for (const item of recipeLines) {
    const ing = item.ingredient
    const vendorPrice = item.vendor_price ?? ing?.active_vendor_price
    const lineCost = getIngredientLineCost(
      item.quantity_used,
      item.unit,
      ing,
      vendorPrice
    )
    total += lineCost
    await supabase
      .from('product_base_recipe_ingredients')
      .update({
        calculated_cost: lineCost,
        active_vendor_price_id:
          vendorPrice?.id ?? ing?.active_vendor_price_id ?? null,
      })
      .eq('id', item.id)
  }
  return total
}

export async function addBaseRecipeIngredient(
  versionId: string,
  ingredientId: string,
  quantityUsed: number,
  unit: IngredientUnit,
  scalingMode: RecipeScalingMode = 'proportional'
): Promise<ProductBaseRecipeIngredient> {
  const ingredient = await fetchIngredient(ingredientId)
  const { data, error } = await supabase
    .from('product_base_recipe_ingredients')
    .insert({
      recipe_version_id: versionId,
      ingredient_id: ingredientId,
      quantity_used: quantityUsed,
      unit,
      scaling_mode: scalingMode,
      active_vendor_price_id: ingredient.active_vendor_price_id,
      calculated_cost: 0,
    })
    .select()
    .single()

  if (error) throw error
  await recalculateRecipeVersionCost(versionId)
  return data
}

export async function updateBaseRecipeIngredient(
  id: string,
  versionId: string,
  quantityUsed: number,
  unit: IngredientUnit,
  scalingMode: RecipeScalingMode
): Promise<void> {
  const { error } = await supabase
    .from('product_base_recipe_ingredients')
    .update({
      quantity_used: quantityUsed,
      unit,
      scaling_mode: scalingMode,
    })
    .eq('id', id)

  if (error) throw error
  await recalculateRecipeVersionCost(versionId)
}

export async function removeBaseRecipeIngredient(
  id: string,
  versionId: string
): Promise<void> {
  const { error } = await supabase
    .from('product_base_recipe_ingredients')
    .delete()
    .eq('id', id)

  if (error) throw error
  await recalculateRecipeVersionCost(versionId)
}

export async function copyRecipeVersionToVariety(
  varietyId: string,
  versionId: string,
  factor: number,
  reason = 'Copied from base recipe',
  setCreatedAt = false
): Promise<void> {
  const { data: lines, error } = await supabase
    .from('product_base_recipe_ingredients')
    .select(BASE_INGREDIENT_SELECT)
    .eq('recipe_version_id', versionId)

  if (error) throw error

  const recipeLines = (lines ?? []) as unknown as BaseRecipeLine[]

  await supabase
    .from('product_variety_ingredients')
    .delete()
    .eq('product_variety_id', varietyId)

  const now = new Date().toISOString()
  const varietyUpdate: Record<string, unknown> = {
    base_recipe_factor: factor,
    source_recipe_version_id: versionId,
    last_base_recipe_sync_at: now,
    has_manual_recipe_overrides: false,
  }
  if (setCreatedAt) {
    varietyUpdate.created_from_base_recipe_at = now
  }

  await supabase.from('product_varieties').update(varietyUpdate).eq('id', varietyId)

  for (const line of recipeLines) {
    const ing = line.ingredient
    const vendorPrice = line.vendor_price ?? ing?.active_vendor_price
    const qty = scaleQuantity(
      line.quantity_used,
      factor,
      line.scaling_mode as RecipeScalingMode
    )
    const lineCost = getIngredientLineCost(qty, line.unit, ing, vendorPrice)

    await supabase.from('product_variety_ingredients').insert({
      product_variety_id: varietyId,
      ingredient_id: line.ingredient_id,
      quantity_used: qty,
      unit: line.unit,
      active_vendor_price_id:
        vendorPrice?.id ?? ing?.active_vendor_price_id ?? null,
      calculated_cost: lineCost,
    })
  }

  const { recalculateVarietyCost } = await import('./products')
  await recalculateVarietyCost(varietyId, true, reason)
}

export async function recalculateRecipeVersionsUsingIngredient(
  ingredientId: string
): Promise<void> {
  const { data, error } = await supabase
    .from('product_base_recipe_ingredients')
    .select('recipe_version_id')
    .eq('ingredient_id', ingredientId)

  if (error) throw error

  const versionIds = [...new Set((data ?? []).map((r) => r.recipe_version_id))]
  for (const versionId of versionIds) {
    await recalculateRecipeVersionCost(versionId)
  }
}
