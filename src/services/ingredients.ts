import { supabase } from './supabase'
import type { Ingredient, IngredientFormData } from '@/types/database'
import { calculateUnitCost } from '@/lib/utils'
import { recalculateAffectedProducts } from './costMonitoring'

export async function fetchIngredients(): Promise<Ingredient[]> {
  const { data, error } = await supabase
    .from('ingredients')
    .select('*')
    .order('name')

  if (error) throw error
  return data ?? []
}

export async function fetchIngredient(id: string): Promise<Ingredient> {
  const { data, error } = await supabase
    .from('ingredients')
    .select('*')
    .eq('id', id)
    .single()

  if (error) throw error
  return data
}

export async function createIngredient(
  userId: string,
  form: IngredientFormData
): Promise<Ingredient> {
  const { data, error } = await supabase
    .from('ingredients')
    .insert({
      user_id: userId,
      name: form.name.trim(),
      unit: form.unit,
      supplier: form.supplier.trim() || null,
      pack_size: form.pack_size,
      pack_cost: form.pack_cost,
    })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function updateIngredient(
  id: string,
  form: IngredientFormData
): Promise<Ingredient> {
  const existing = await fetchIngredient(id)
  const previousUnitCost = existing.unit_cost

  const { data, error } = await supabase
    .from('ingredients')
    .update({
      name: form.name.trim(),
      unit: form.unit,
      supplier: form.supplier.trim() || null,
      pack_size: form.pack_size,
      pack_cost: form.pack_cost,
    })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error

  const newUnitCost = calculateUnitCost(form.pack_cost, form.pack_size)
  if (Math.abs(newUnitCost - previousUnitCost) > 0.000001) {
    await recalculateAffectedProducts(id)
  }

  return data
}

export async function deleteIngredient(id: string): Promise<void> {
  const { error } = await supabase.from('ingredients').delete().eq('id', id)
  if (error) throw error
}

export async function searchIngredients(query: string): Promise<Ingredient[]> {
  const { data, error } = await supabase
    .from('ingredients')
    .select('*')
    .ilike('name', `%${query}%`)
    .order('name')

  if (error) throw error
  return data ?? []
}

export async function fetchRecentlyUpdatedIngredients(
  limit = 5
): Promise<Ingredient[]> {
  const { data, error } = await supabase
    .from('ingredients')
    .select('*')
    .order('last_updated', { ascending: false })
    .limit(limit)

  if (error) throw error
  return data ?? []
}
