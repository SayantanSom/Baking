import { supabase } from './supabase'
import type {
  Product,
  ProductFormData,
  ProductIngredient,
  ProductWithRecipe,
  CostHistoryEntry,
} from '@/types/database'
import { calculateProductCost } from '@/lib/costCalculations'
import {
  calculatePercentageChange,
  getCostStatus,
} from '@/lib/utils'
import { fetchSettings } from './settings'

export async function fetchProducts(): Promise<Product[]> {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .order('name')

  if (error) throw error
  return data ?? []
}

export async function fetchProductWithRecipe(
  id: string
): Promise<ProductWithRecipe> {
  const { data, error } = await supabase
    .from('products')
    .select(
      `
      *,
      product_ingredients (
        id,
        product_id,
        ingredient_id,
        quantity_used,
        ingredient:ingredients (*)
      )
    `
    )
    .eq('id', id)
    .single()

  if (error) throw error
  return data as ProductWithRecipe
}

export async function createProduct(
  userId: string,
  form: ProductFormData
): Promise<Product> {
  const { data, error } = await supabase
    .from('products')
    .insert({
      user_id: userId,
      name: form.name.trim(),
      description: form.description.trim() || null,
      buffer_percentage: form.buffer_percentage,
      units_per_batch: form.units_per_batch,
    })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function updateProduct(
  id: string,
  form: ProductFormData
): Promise<Product> {
  const { data, error } = await supabase
    .from('products')
    .update({
      name: form.name.trim(),
      description: form.description.trim() || null,
      buffer_percentage: form.buffer_percentage,
      units_per_batch: form.units_per_batch,
    })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function deleteProduct(id: string): Promise<void> {
  const { error } = await supabase.from('products').delete().eq('id', id)
  if (error) throw error
}

export async function searchProducts(query: string): Promise<Product[]> {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .ilike('name', `%${query}%`)
    .order('name')

  if (error) throw error
  return data ?? []
}

export async function addProductIngredient(
  productId: string,
  ingredientId: string,
  quantityUsed: number
): Promise<ProductIngredient> {
  const { data, error } = await supabase
    .from('product_ingredients')
    .insert({
      product_id: productId,
      ingredient_id: ingredientId,
      quantity_used: quantityUsed,
    })
    .select()
    .single()

  if (error) throw error
  await recalculateProductCost(productId)
  return data
}

export async function updateProductIngredient(
  id: string,
  quantityUsed: number
): Promise<ProductIngredient> {
  const { data, error } = await supabase
    .from('product_ingredients')
    .update({ quantity_used: quantityUsed })
    .eq('id', id)
    .select('product_id')
    .single()

  if (error) throw error
  await recalculateProductCost(data.product_id)
  return data as ProductIngredient
}

export async function removeProductIngredient(
  id: string,
  productId: string
): Promise<void> {
  const { error } = await supabase
    .from('product_ingredients')
    .delete()
    .eq('id', id)

  if (error) throw error
  await recalculateProductCost(productId)
}

export async function recalculateProductCost(
  productId: string,
  recordHistory = true
): Promise<number> {
  const product = await fetchProductWithRecipe(productId)
  const settings = await fetchSettings()
  const breakdown = calculateProductCost(
    product.product_ingredients,
    product.buffer_percentage,
    product.units_per_batch,
    settings
  )

  const newCost = breakdown.bufferedCost
  const previousCost = product.current_cost_price

  const { error } = await supabase
    .from('products')
    .update({ current_cost_price: newCost })
    .eq('id', productId)

  if (error) throw error

  if (
    recordHistory &&
    previousCost > 0 &&
    Math.abs(newCost - previousCost) > 0.0001
  ) {
    const percentageChange = calculatePercentageChange(
      previousCost,
      newCost
    )
    const status = getCostStatus(
      percentageChange,
      product.buffer_percentage
    )

    await supabase.from('cost_history').insert({
      product_id: productId,
      previous_cost: previousCost,
      new_cost: newCost,
      percentage_change: percentageChange,
      status,
    })
  }

  return newCost
}

export async function fetchCostHistory(
  productId: string
): Promise<CostHistoryEntry[]> {
  const { data, error } = await supabase
    .from('cost_history')
    .select('*')
    .eq('product_id', productId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data ?? []
}

export async function fetchAllCostHistory(): Promise<
  (CostHistoryEntry & { product?: Product })[]
> {
  const { data, error } = await supabase
    .from('cost_history')
    .select('*, product:products(*)')
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) throw error
  return data ?? []
}

export async function fetchProductsRequiringReview(): Promise<
  (Product & { latest_status?: string })[]
> {
  const products = await fetchProducts()
  const history = await fetchAllCostHistory()

  return products
    .map((product) => {
      const latest = history.find((h) => h.product_id === product.id)
      return { ...product, latest_status: latest?.status }
    })
    .filter((p) => p.latest_status === 'amber' || p.latest_status === 'red')
}
