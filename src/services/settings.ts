import { supabase } from './supabase'
import type { UserSettings, SettingsFormData, SupplierPrice } from '@/types/database'

const DEFAULT_SETTINGS: Omit<UserSettings, 'id' | 'user_id' | 'created_at' | 'updated_at'> = {
  default_buffer_percentage: 5,
  currency: '£',
  tax_percentage: 20,
  labour_cost_percentage: 0,
  packaging_cost_percentage: 0,
}

export async function fetchSettings(): Promise<UserSettings> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ...DEFAULT_SETTINGS, id: '', user_id: '', created_at: '', updated_at: '' } as UserSettings

  const { data, error } = await supabase
    .from('user_settings')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle()

  if (error) throw error

  if (!data) {
    const { data: created, error: createError } = await supabase
      .from('user_settings')
      .insert({ user_id: user.id })
      .select()
      .single()

    if (createError) throw createError
    return created
  }

  return data
}

export async function updateSettings(
  form: SettingsFormData
): Promise<UserSettings> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('user_settings')
    .update({
      default_buffer_percentage: form.default_buffer_percentage,
      currency: form.currency,
      tax_percentage: form.tax_percentage,
      labour_cost_percentage: form.labour_cost_percentage,
      packaging_cost_percentage: form.packaging_cost_percentage,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', user.id)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function fetchSupplierPrices(
  ingredientId: string
): Promise<SupplierPrice[]> {
  const { data, error } = await supabase
    .from('supplier_prices')
    .select('*')
    .eq('ingredient_id', ingredientId)
    .order('checked_at', { ascending: false })

  if (error) throw error
  return data ?? []
}

export async function createSupplierPrice(
  ingredientId: string,
  retailer: string,
  price: number,
  packSize: number,
  productUrl?: string
): Promise<SupplierPrice> {
  const { data, error } = await supabase
    .from('supplier_prices')
    .insert({
      ingredient_id: ingredientId,
      retailer,
      price,
      pack_size: packSize,
      product_url: productUrl || null,
    })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function deleteSupplierPrice(id: string): Promise<void> {
  const { error } = await supabase
    .from('supplier_prices')
    .delete()
    .eq('id', id)

  if (error) throw error
}
