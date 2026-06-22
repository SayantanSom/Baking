import type { ProductVariety, ProductVarietyFormData } from '@/types/database'

export const emptyVarietyForm: ProductVarietyFormData = {
  variety_name: '',
  size_label: '',
  sku: '',
  selling_price: 0,
  recipe_yield: 1,
  packaging_cost: 0,
  labour_cost: 0,
  shipping_cost: 0,
  base_recipe_factor: 1,
  buffer_percentage: 5,
  is_catalogue_visible: true,
}

export function newVarietyFormDefaults(settings?: {
  default_labour_cost?: number
  default_packaging_cost?: number
  default_buffer_percentage?: number
}): ProductVarietyFormData {
  return {
    ...emptyVarietyForm,
    labour_cost: settings?.default_labour_cost ?? 0,
    packaging_cost: settings?.default_packaging_cost ?? 0,
    buffer_percentage: settings?.default_buffer_percentage ?? 5,
  }
}

export function mapVarietyToForm(v: ProductVariety): ProductVarietyFormData {
  return {
    variety_name: v.variety_name,
    size_label: v.size_label || '',
    sku: v.sku || '',
    selling_price: v.selling_price,
    recipe_yield: v.recipe_yield,
    packaging_cost: v.packaging_cost,
    labour_cost: v.labour_cost,
    shipping_cost: v.shipping_cost ?? 0,
    base_recipe_factor: v.base_recipe_factor ?? 1,
    buffer_percentage: v.buffer_percentage ?? 5,
    is_catalogue_visible: v.is_catalogue_visible,
  }
}
