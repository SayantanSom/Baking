import { supabase } from './supabase'
import type {
  EnterpriseSettings,
  SettingsFormData,
  CatalogueSettingsFormData,
  CatalogueTemplate,
  CatalogueLayoutConfig,
} from '@/types/database'
import { DEFAULT_LAYOUT_CONFIG } from '@/types/database'
import { ConflictError } from '@/lib/errors'
import { fetchMyEnterpriseId } from './enterprises'

const DEFAULT_SETTINGS: Omit<
  EnterpriseSettings,
  'id' | 'enterprise_id' | 'version' | 'created_at' | 'updated_at'
> = {
  default_buffer_percentage: 5,
  currency: '£',
  tax_percentage: 20,
  default_labour_cost: 0,
  default_packaging_cost: 0,
  catalogue_title: 'Product Catalogue',
  business_name: '',
  footer_text: '',
  show_prices: true,
  show_descriptions: true,
  show_images: true,
  products_per_page: 4,
}

export async function fetchSettings(): Promise<EnterpriseSettings> {
  const enterpriseId = await fetchMyEnterpriseId().catch(() => null)
  if (!enterpriseId) {
    return {
      ...DEFAULT_SETTINGS,
      id: '',
      enterprise_id: '',
      version: 1,
      created_at: '',
      updated_at: '',
    } as EnterpriseSettings
  }

  const { data, error } = await supabase
    .from('enterprise_settings')
    .select('*')
    .eq('enterprise_id', enterpriseId)
    .maybeSingle()

  if (error) throw error

  if (!data) {
    const { data: created, error: createError } = await supabase
      .from('enterprise_settings')
      .insert({ enterprise_id: enterpriseId })
      .select()
      .single()

    if (createError) throw createError
    return created
  }

  return data
}

async function updateEnterpriseSettings(
  form: SettingsFormData | CatalogueSettingsFormData,
  expectedVersion: number
): Promise<EnterpriseSettings> {
  const enterpriseId = await fetchMyEnterpriseId()

  const { data, error } = await supabase
    .from('enterprise_settings')
    .update({
      ...form,
      version: expectedVersion + 1,
      updated_at: new Date().toISOString(),
    })
    .eq('enterprise_id', enterpriseId)
    .eq('version', expectedVersion)
    .select()
    .maybeSingle()

  if (error) throw error
  if (!data) {
    throw new ConflictError(
      'Settings were modified by another user. Refresh before saving.'
    )
  }
  return data
}

export async function updateSettings(
  form: SettingsFormData,
  expectedVersion?: number
): Promise<EnterpriseSettings> {
  const current = expectedVersion ?? (await fetchSettings()).version
  return updateEnterpriseSettings(form, current)
}

export async function updateCatalogueSettings(
  form: CatalogueSettingsFormData,
  expectedVersion?: number
): Promise<EnterpriseSettings> {
  const current = expectedVersion ?? (await fetchSettings()).version
  return updateEnterpriseSettings(form, current)
}

export async function fetchCatalogueTemplate(): Promise<CatalogueTemplate | null> {
  const enterpriseId = await fetchMyEnterpriseId().catch(() => null)
  if (!enterpriseId) return null

  const { data, error } = await supabase
    .from('catalogue_templates')
    .select('*')
    .eq('enterprise_id', enterpriseId)
    .eq('is_default', true)
    .maybeSingle()

  if (error) throw error
  return data
}

export async function upsertCatalogueTemplate(
  enterpriseId: string,
  createdBy: string,
  updates: {
    name?: string
    file_url?: string | null
    file_type?: string | null
    layout_config?: CatalogueLayoutConfig
  }
): Promise<CatalogueTemplate> {
  const existing = await fetchCatalogueTemplate()

  if (existing) {
    const { data, error } = await supabase
      .from('catalogue_templates')
      .update(updates)
      .eq('id', existing.id)
      .select()
      .single()

    if (error) throw error
    return data
  }

  const { data, error } = await supabase
    .from('catalogue_templates')
    .insert({
      enterprise_id: enterpriseId,
      created_by: createdBy,
      name: updates.name ?? 'Default Template',
      file_url: updates.file_url ?? null,
      file_type: updates.file_type ?? null,
      layout_config: updates.layout_config ?? DEFAULT_LAYOUT_CONFIG,
      is_default: true,
      is_public: true,
    })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function uploadCatalogueTemplateFile(
  enterpriseId: string,
  file: File
): Promise<{ fileUrl: string; fileType: string }> {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'png'
  const fileType =
    ext === 'pdf' ? 'pdf' : ext === 'jpg' || ext === 'jpeg' ? 'jpg' : 'png'
  const path = `${enterpriseId}/${Date.now()}.${ext}`

  const { error: uploadError } = await supabase.storage
    .from('catalogue-templates')
    .upload(path, file, { upsert: true })

  if (uploadError) {
    const dataUrl = await fileToDataUrl(file)
    return { fileUrl: dataUrl, fileType }
  }

  const { data } = supabase.storage
    .from('catalogue-templates')
    .getPublicUrl(path)

  return { fileUrl: data.publicUrl, fileType }
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

/** @deprecated Use ingredient_vendor_prices via ingredients service */
export async function fetchSupplierPrices() {
  return []
}

export async function createSupplierPrice() {
  throw new Error('Use ingredient vendor prices instead')
}

export async function deleteSupplierPrice() {
  throw new Error('Use ingredient vendor prices instead')
}
