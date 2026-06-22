export type IngredientUnit = 'g' | 'kg' | 'ml' | 'l' | 'unit'

export type CostStatus = 'green' | 'amber' | 'red'

export interface UserSettings {
  id: string
  user_id: string
  default_buffer_percentage: number
  currency: string
  tax_percentage: number
  labour_cost_percentage: number
  packaging_cost_percentage: number
  created_at: string
  updated_at: string
}

export interface Ingredient {
  id: string
  user_id: string
  name: string
  unit: IngredientUnit
  supplier: string | null
  pack_size: number
  pack_cost: number
  unit_cost: number
  last_updated: string
  created_at: string
}

export interface Product {
  id: string
  user_id: string
  name: string
  description: string | null
  buffer_percentage: number
  units_per_batch: number
  current_cost_price: number
  created_at: string
}

export interface ProductIngredient {
  id: string
  product_id: string
  ingredient_id: string
  quantity_used: number
  ingredient?: Ingredient
}

export interface CostHistoryEntry {
  id: string
  product_id: string
  previous_cost: number
  new_cost: number
  percentage_change: number
  status: CostStatus
  created_at: string
}

export interface SupplierPrice {
  id: string
  ingredient_id: string
  retailer: string
  price: number
  pack_size: number
  product_url: string | null
  checked_at: string
}

export interface ProductWithRecipe extends Product {
  product_ingredients: ProductIngredient[]
}

export interface IngredientFormData {
  name: string
  unit: IngredientUnit
  supplier: string
  pack_size: number
  pack_cost: number
}

export interface ProductFormData {
  name: string
  description: string
  buffer_percentage: number
  units_per_batch: number
}

export interface SettingsFormData {
  default_buffer_percentage: number
  currency: string
  tax_percentage: number
  labour_cost_percentage: number
  packaging_cost_percentage: number
}

export interface ProductCostBreakdown {
  ingredientCost: number
  costPrice: number
  bufferedCost: number
  costPerUnit: number
  labourCost: number
  packagingCost: number
  taxAmount: number
  totalWithTax: number
}

export type Retailer =
  | 'Amazon'
  | "Sainsbury's"
  | 'Morrisons'
  | 'Asda'
  | 'Tesco'
  | 'Aldi'
