import { supabase } from './supabase'
import type {
  AcceptAndRepriceFormData,
  AcceptVarietyFormData,
  AcceptanceReasonType,
  ProductVariety,
  ProductVarietyAcceptance,
} from '@/types/database'
import {
  computeMarginPercentage,
  computeMarginValue,
} from '@/lib/bufferStatus'
import { fetchVarietyWithRecipe, recordSellingPriceHistory } from './products'

export async function fetchLatestAcceptance(
  varietyId: string
): Promise<ProductVarietyAcceptance | null> {
  const { data, error } = await supabase
    .from('product_variety_acceptances')
    .select('*')
    .eq('product_variety_id', varietyId)
    .order('accepted_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw error
  return data
}

export async function fetchAcceptanceHistory(
  varietyId: string
): Promise<ProductVarietyAcceptance[]> {
  const { data, error } = await supabase
    .from('product_variety_acceptances')
    .select('*')
    .eq('product_variety_id', varietyId)
    .order('accepted_at', { ascending: false })

  if (error) throw error
  return data ?? []
}

export async function fetchLatestAcceptancesForVarieties(
  varietyIds: string[]
): Promise<Record<string, ProductVarietyAcceptance>> {
  if (varietyIds.length === 0) return {}

  const { data, error } = await supabase
    .from('product_variety_acceptances')
    .select('*')
    .in('product_variety_id', varietyIds)
    .order('accepted_at', { ascending: false })

  if (error) throw error

  const map: Record<string, ProductVarietyAcceptance> = {}
  for (const row of data ?? []) {
    if (!map[row.product_variety_id]) {
      map[row.product_variety_id] = row
    }
  }
  return map
}

async function insertAcceptanceSnapshot(
  variety: ProductVariety,
  userId: string,
  reasonType: AcceptanceReasonType,
  reasonNotes?: string
): Promise<ProductVarietyAcceptance> {
  const marginValue = computeMarginValue(
    variety.selling_price,
    variety.current_cost_price
  )
  const marginPct = computeMarginPercentage(
    variety.selling_price,
    variety.current_cost_price
  )

  const { data, error } = await supabase
    .from('product_variety_acceptances')
    .insert({
      product_variety_id: variety.id,
      accepted_cost_price: variety.current_cost_price,
      accepted_selling_price: variety.selling_price,
      accepted_margin_value: marginValue,
      accepted_margin_percentage: marginPct,
      buffer_percentage_at_time: variety.buffer_percentage ?? 5,
      accepted_by: userId,
      accepted_reason_type: reasonType,
      accepted_reason_notes: reasonNotes?.trim() || null,
    })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function acceptVarietyCost(
  varietyId: string,
  form: AcceptVarietyFormData
): Promise<ProductVarietyAcceptance> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const variety = await fetchVarietyWithRecipe(varietyId)
  return insertAcceptanceSnapshot(
    variety,
    user.id,
    form.accepted_reason_type,
    form.accepted_reason_notes
  )
}

export async function acceptVarietyAndReprice(
  varietyId: string,
  form: AcceptAndRepriceFormData
): Promise<ProductVarietyAcceptance> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const variety = await fetchVarietyWithRecipe(varietyId)
  const prevSelling = variety.selling_price
  const newSelling = form.new_selling_price

  if (Math.abs(newSelling - prevSelling) > 0.0001) {
    await recordSellingPriceHistory(
      varietyId,
      prevSelling,
      newSelling,
      'Accept & reprice'
    )
    const grossMargin = newSelling - variety.current_cost_price
    await supabase
      .from('product_varieties')
      .update({
        selling_price: newSelling,
        gross_margin: grossMargin,
      })
      .eq('id', varietyId)
  }

  const updated = await fetchVarietyWithRecipe(varietyId)
  return insertAcceptanceSnapshot(
    updated,
    user.id,
    form.accepted_reason_type,
    form.accepted_reason_notes
  )
}
