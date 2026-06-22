/**
 * Programmatic seed data for development/demo.
 * Call seedSampleData(enterpriseId, createdBy) after authentication to populate sample records.
 */
import { supabase } from './supabase'
import { calculateCostPerBaseUnit } from '@/lib/unitConversion'
import { createVarietyFromBaseRecipe } from './products'
import {
  ensureCurrentRecipeVersion,
  addBaseRecipeIngredient,
} from './recipeVersions'

export async function seedSampleData(
  enterpriseId: string,
  createdBy: string
): Promise<void> {
  const ingredients = [
    { name: 'Flour', base_unit: 'g' as const, buffer: 5 },
    { name: 'Sugar', base_unit: 'g' as const, buffer: 5 },
    { name: 'Butter', base_unit: 'g' as const, buffer: 8 },
    { name: 'Cream Cheese', base_unit: 'g' as const, buffer: 8 },
    { name: 'Digestive Biscuits', base_unit: 'g' as const, buffer: 5 },
    { name: 'Eggs', base_unit: 'unit' as const, buffer: 5 },
    { name: 'Vanilla', base_unit: 'ml' as const, buffer: 5 },
    { name: 'Chocolate', base_unit: 'g' as const, buffer: 12 },
    { name: 'Ribbon', base_unit: 'unit' as const, buffer: 5 },
    { name: 'Cake Board', base_unit: 'unit' as const, buffer: 5 },
  ]

  const ingIds: Record<string, string> = {}

  for (const ing of ingredients) {
    const { data, error } = await supabase
      .from('ingredients')
      .insert({
        enterprise_id: enterpriseId,
        created_by: createdBy,
        name: ing.name,
        base_unit: ing.base_unit,
        default_buffer_percentage: ing.buffer,
      })
      .select()
      .single()
    if (error) throw error
    ingIds[ing.name] = data.id
  }

  const vendorSeeds = [
    { ing: 'Flour', vendor: 'Tesco', pack: 500, unit: 'g' as const, cost: 1.2, active: true },
    { ing: 'Flour', vendor: 'Aldi', pack: 2, unit: 'kg' as const, cost: 3.2, active: false },
    { ing: 'Butter', vendor: 'Tesco', pack: 250, unit: 'g' as const, cost: 2.5, active: true },
    { ing: 'Cream Cheese', vendor: 'Tesco', pack: 300, unit: 'g' as const, cost: 2.8, active: true },
    { ing: 'Digestive Biscuits', vendor: 'Tesco', pack: 400, unit: 'g' as const, cost: 1.5, active: true },
  ]

  for (const v of vendorSeeds) {
    const ingredientId = ingIds[v.ing]
    const baseUnit = ingredients.find((i) => i.name === v.ing)!.base_unit
    const costPerBase = calculateCostPerBaseUnit(v.cost, v.pack, v.unit, baseUnit)

    const { data, error } = await supabase
      .from('ingredient_vendor_prices')
      .insert({
        ingredient_id: ingredientId,
        vendor_name: v.vendor,
        pack_size: v.pack,
        pack_unit: v.unit,
        pack_cost: v.cost,
        cost_per_base_unit: costPerBase,
        is_active: v.active,
      })
      .select()
      .single()
    if (error) throw error
    if (v.active) {
      await supabase
        .from('ingredients')
        .update({ active_vendor_price_id: data.id })
        .eq('id', ingredientId)
    }
  }

  const { data: cheeseProduct, error: prodErr } = await supabase
    .from('products')
    .insert({
      enterprise_id: enterpriseId,
      created_by: createdBy,
      name: 'Cheese Cake',
      description: 'Classic baked cheesecake',
      category: 'Cakes',
    })
    .select()
    .single()
  if (prodErr) throw prodErr

  const version = await ensureCurrentRecipeVersion(cheeseProduct.id)
  await addBaseRecipeIngredient(version.id, ingIds['Cream Cheese'], 500, 'g', 'proportional')
  await addBaseRecipeIngredient(version.id, ingIds['Digestive Biscuits'], 200, 'g', 'proportional')
  await addBaseRecipeIngredient(version.id, ingIds['Butter'], 100, 'g', 'proportional')

  await createVarietyFromBaseRecipe(cheeseProduct.id, {
    variety_name: '8 inch',
    size_label: '8 inch',
    sku: 'CC-8',
    selling_price: 24.99,
    recipe_yield: 1,
    packaging_cost: 1.5,
    labour_cost: 3,
    shipping_cost: 0,
    base_recipe_factor: 1,
    buffer_percentage: 5,
    is_catalogue_visible: true,
  })

  await createVarietyFromBaseRecipe(cheeseProduct.id, {
    variety_name: '10 inch',
    size_label: '10 inch',
    sku: 'CC-10',
    selling_price: 34.99,
    recipe_yield: 1,
    packaging_cost: 2,
    labour_cost: 4,
    shipping_cost: 0,
    base_recipe_factor: 1.5,
    buffer_percentage: 5,
    is_catalogue_visible: true,
  })

  const { data: weddingProduct, error: wedErr } = await supabase
    .from('products')
    .insert({
      enterprise_id: enterpriseId,
      created_by: createdBy,
      name: 'Wedding Cake',
      description: 'Tiered wedding cake',
      category: 'Cakes',
    })
    .select()
    .single()
  if (wedErr) throw wedErr

  const wedVersion = await ensureCurrentRecipeVersion(weddingProduct.id)
  await addBaseRecipeIngredient(wedVersion.id, ingIds['Flour'], 500, 'g', 'proportional')
  await addBaseRecipeIngredient(wedVersion.id, ingIds['Ribbon'], 1, 'unit', 'fixed')
  await addBaseRecipeIngredient(wedVersion.id, ingIds['Cake Board'], 1, 'unit', 'fixed')

  await createVarietyFromBaseRecipe(weddingProduct.id, {
    variety_name: '8 inch',
    size_label: '8 inch',
    sku: 'WC-8',
    selling_price: 45.99,
    recipe_yield: 1,
    packaging_cost: 2,
    labour_cost: 5,
    shipping_cost: 0,
    base_recipe_factor: 1,
    buffer_percentage: 5,
    is_catalogue_visible: true,
  })

  await createVarietyFromBaseRecipe(weddingProduct.id, {
    variety_name: '12 inch',
    size_label: '12 inch',
    sku: 'WC-12',
    selling_price: 65.99,
    recipe_yield: 1,
    packaging_cost: 3,
    labour_cost: 7,
    shipping_cost: 0,
    base_recipe_factor: 1.5,
    buffer_percentage: 5,
    is_catalogue_visible: true,
  })
}
