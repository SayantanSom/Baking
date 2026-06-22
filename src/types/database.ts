export type IngredientUnit = 'g' | 'kg' | 'ml' | 'l' | 'unit'

export type CostStatus = 'green' | 'amber' | 'red'

export type RecipeScalingMode = 'proportional' | 'fixed'

export type VendorName =
  | 'Amazon'
  | "Sainsbury's"
  | 'Morrisons'
  | 'Asda'
  | 'Tesco'
  | 'Aldi'
  | 'Wholesale supplier'
  | 'Custom supplier'

export const VENDOR_OPTIONS: VendorName[] = [
  'Amazon',
  "Sainsbury's",
  'Morrisons',
  'Asda',
  'Tesco',
  'Aldi',
  'Wholesale supplier',
  'Custom supplier',
]

export type UserApprovalStatus = 'pending' | 'approved' | 'rejected'
export type AppUserRole = 'super_admin' | 'user'
export type EnterpriseMemberRole = 'owner' | 'admin' | 'editor' | 'viewer'

export interface AppUser {
  id: string
  user_id: string
  email: string
  status: UserApprovalStatus
  role: AppUserRole
  approved_at: string | null
  approved_by: string | null
  created_at: string
  updated_at: string
}

export interface Enterprise {
  id: string
  name: string
  created_at: string
  updated_at: string
}

export interface EnterpriseMember {
  id: string
  enterprise_id: string
  user_id: string
  role: EnterpriseMemberRole
  created_at: string
}

export interface EnterpriseSettings {
  id: string
  enterprise_id: string
  default_buffer_percentage: number
  currency: string
  tax_percentage: number
  default_labour_cost: number
  default_packaging_cost: number
  catalogue_title: string
  business_name: string
  footer_text: string
  show_prices: boolean
  show_descriptions: boolean
  show_images: boolean
  products_per_page: number
  version: number
  created_at: string
  updated_at: string
}

/** @deprecated Use EnterpriseSettings */
export type UserSettings = EnterpriseSettings

export interface Ingredient {
  id: string
  enterprise_id: string
  created_by: string
  name: string
  base_unit: IngredientUnit
  default_buffer_percentage: number
  notes: string | null
  active_vendor_price_id: string | null
  version: number
  created_at: string
  updated_at: string
  active_vendor_price?: IngredientVendorPrice
}

export interface IngredientVendorPrice {
  id: string
  ingredient_id: string
  vendor_name: string
  pack_size: number
  pack_unit: IngredientUnit
  pack_cost: number
  cost_per_base_unit: number
  is_active: boolean
  product_url: string | null
  last_checked_at: string
  created_at: string
  updated_at: string
}

export interface IngredientVendorPriceHistory {
  id: string
  ingredient_id: string
  vendor_price_id: string | null
  vendor_name: string | null
  pack_size: number | null
  pack_unit: IngredientUnit | null
  pack_cost: number | null
  converted_pack_size: number | null
  previous_pack_cost: number | null
  previous_cost_per_base_unit: number
  new_cost_per_base_unit: number
  percentage_change: number
  buffer_percentage_at_time: number
  status: CostStatus
  checked_at: string | null
  created_at: string
}

/** @deprecated Use IngredientVendorPriceHistory */
export type IngredientPriceHistory = IngredientVendorPriceHistory

export interface Product {
  id: string
  enterprise_id: string
  created_by: string
  name: string
  description: string | null
  category: string | null
  image_url: string | null
  version: number
  created_at: string
  updated_at: string
}

export interface ProductVariety {
  id: string
  product_id: string
  variety_name: string
  size_label: string | null
  sku: string | null
  selling_price: number
  recipe_yield: number
  packaging_cost: number
  labour_cost: number
  shipping_cost: number
  current_cost_price: number
  suggested_selling_price: number | null
  gross_margin: number
  is_catalogue_visible: boolean
  base_recipe_factor: number
  source_recipe_version_id: string | null
  created_from_base_recipe_at: string | null
  last_base_recipe_sync_at: string | null
  has_manual_recipe_overrides: boolean
  price_locked_until: string | null
  cost_locked_until: string | null
  locked_selling_price: number | null
  locked_cost_price: number | null
  buffer_percentage: number
  created_at: string
  updated_at: string
  product?: Product
  source_recipe_version?: ProductRecipeVersion
}

export type AcceptanceReasonType =
  | 'supplier_increase_accepted'
  | 'seasonal_pricing'
  | 'catalogue_published'
  | 'recipe_change'
  | 'packaging_change'
  | 'labour_review'
  | 'manual_override'
  | 'initial_baseline'

export const ACCEPTANCE_REASON_OPTIONS: {
  value: AcceptanceReasonType
  label: string
}[] = [
  { value: 'supplier_increase_accepted', label: 'Supplier Increase Accepted' },
  { value: 'seasonal_pricing', label: 'Seasonal Pricing' },
  { value: 'catalogue_published', label: 'Catalogue Published' },
  { value: 'recipe_change', label: 'Recipe Change' },
  { value: 'packaging_change', label: 'Packaging Change' },
  { value: 'labour_review', label: 'Labour Review' },
  { value: 'manual_override', label: 'Manual Override' },
]

export interface ProductVarietyAcceptance {
  id: string
  product_variety_id: string
  accepted_cost_price: number
  accepted_selling_price: number
  accepted_margin_value: number
  accepted_margin_percentage: number
  buffer_percentage_at_time: number
  accepted_by: string
  accepted_reason_type: AcceptanceReasonType
  accepted_reason_notes: string | null
  accepted_at: string
}

export interface AcceptVarietyFormData {
  accepted_reason_type: AcceptanceReasonType
  accepted_reason_notes?: string
}

export interface AcceptAndRepriceFormData extends AcceptVarietyFormData {
  new_selling_price: number
}

export interface ProductVarietyIngredient {
  id: string
  product_variety_id: string
  ingredient_id: string
  quantity_used: number
  unit: IngredientUnit
  active_vendor_price_id: string | null
  calculated_cost: number
  ingredient?: Ingredient
  vendor_price?: IngredientVendorPrice
}

export interface ProductVarietySellingPriceHistory {
  id: string
  product_variety_id: string
  previous_selling_price: number
  new_selling_price: number
  percentage_change: number
  reason: string | null
  created_at: string
}

export interface ProductRecipeVersion {
  id: string
  product_id: string
  version_number: number
  name: string
  notes: string | null
  recipe_yield: number
  is_current: boolean
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface ProductBaseRecipeIngredient {
  id: string
  recipe_version_id: string
  ingredient_id: string
  quantity_used: number
  unit: IngredientUnit
  scaling_mode: RecipeScalingMode
  active_vendor_price_id: string | null
  calculated_cost: number
  created_at: string
  updated_at: string
  ingredient?: Ingredient
  vendor_price?: IngredientVendorPrice
}

export interface ProductWithRecipeVersions extends Product {
  product_recipe_versions: (ProductRecipeVersion & {
    product_base_recipe_ingredients?: ProductBaseRecipeIngredient[]
  })[]
}

export interface ProductVarietyCostHistory {
  id: string
  product_variety_id: string
  previous_cost_price: number
  new_cost_price: number
  percentage_change: number
  status: CostStatus
  reason: string | null
  created_at: string
}

export interface ProductVarietyWithRecipe extends ProductVariety {
  product_variety_ingredients: ProductVarietyIngredient[]
}

export interface ProductWithVarieties extends Product {
  product_varieties: ProductVariety[]
}

export interface CatalogueLayoutField {
  x: number
  y: number
  fontSize?: number
  align?: 'left' | 'center' | 'right'
  width?: number
  height?: number
}

export interface CatalogueLayoutConfig {
  productName: CatalogueLayoutField
  varietyName: CatalogueLayoutField
  price: CatalogueLayoutField
  description: CatalogueLayoutField
  image: CatalogueLayoutField & { width: number; height: number }
  sku: CatalogueLayoutField
  productsPerPage: number
  fontSize: number
  textAlign: 'left' | 'center' | 'right'
  itemSpacingY: number
  // Future: drag-and-drop editor will update these positions interactively
}

export interface CatalogueTemplate {
  id: string
  enterprise_id: string
  created_by: string
  name: string
  file_url: string | null
  file_type: 'pdf' | 'png' | 'jpg' | 'jpeg' | null
  layout_config: CatalogueLayoutConfig
  is_default: boolean
  is_public: boolean
  created_at: string
  updated_at: string
}

export interface IngredientFormData {
  name: string
  base_unit: IngredientUnit
  default_buffer_percentage: number
  notes: string
}

export interface VendorPriceFormData {
  vendor_name: string
  pack_size: number
  pack_unit: IngredientUnit
  pack_cost: number
  product_url: string
  is_active: boolean
  last_checked_at?: string
}

export interface ProductFormData {
  name: string
  description: string
  category: string
  image_url: string
}

/** Fields used only when creating a product (default first variety). */
export interface ProductCreateFormData extends ProductFormData {
  recipe_yield: number
  selling_price: number
}

export interface ProductVarietyFormData {
  variety_name: string
  size_label: string
  sku: string
  selling_price: number
  recipe_yield: number
  packaging_cost: number
  labour_cost: number
  shipping_cost: number
  base_recipe_factor: number
  buffer_percentage: number
  is_catalogue_visible: boolean
}

export interface VarietyLockFormData {
  price_locked_until: string | null
  cost_locked_until: string | null
}

export interface IngredientUsedInVariety {
  product_id: string
  product_name: string
  variety_id: string
  variety_name: string
  size_label: string | null
  quantity_used: number
  unit: IngredientUnit
}

export interface IngredientPriceImpactRow {
  variety_id: string
  product_id: string
  product_name: string
  variety_label: string
  quantity_used: number
  unit: IngredientUnit
  old_contribution: number
  new_contribution: number
  difference: number
  total_cost_before: number
  total_cost_after: number
  cost_change_percentage: number
  margin_before: number
  margin_after: number
  margin_value_delta: number
  margin_pp_delta: number
  cost_status: CostStatus
  margin_status: CostStatus
  variety_buffer_percentage: number
  /** @deprecated Use cost_status */
  status?: CostStatus
}

export interface SettingsFormData {
  default_buffer_percentage: number
  currency: string
  tax_percentage: number
  default_labour_cost: number
  default_packaging_cost: number
}

export interface CatalogueSettingsFormData {
  catalogue_title: string
  business_name: string
  footer_text: string
  show_prices: boolean
  show_descriptions: boolean
  show_images: boolean
  products_per_page: number
}

export interface VarietyCostBreakdown {
  ingredientCost: number
  packagingCost: number
  labourCost: number
  shippingCost: number
  overheadCost: number
  totalCost: number
  netRevenue: number
  taxOnSale: number
  grossMarginPreTax: number
  grossMarginPreTaxPercentage: number
  grossMarginPostTax: number
  grossMarginPostTaxPercentage: number
  /** @deprecated Use grossMarginPreTax */
  grossMargin: number
  /** @deprecated Use grossMarginPreTaxPercentage */
  grossMarginPercentage: number
  costPerUnit: number
}

export interface DashboardSearchResult {
  variety: ProductVariety
  product: Product
  displayName: string
  costStatus?: CostStatus
  marginStatus?: CostStatus
  marginValueDelta?: number
  marginPpDelta?: number
  costChangePct?: number
  latestAcceptance?: ProductVarietyAcceptance
  /** @deprecated Use costStatus */
  latestStatus?: CostStatus
  marginErosion?: number | null
  priceProtected?: boolean
  costLocked?: boolean
}

/** @deprecated Use SupplierPrice via ingredient_vendor_prices */
export interface SupplierPrice {
  id: string
  ingredient_id: string
  retailer: string
  price: number
  pack_size: number
  product_url: string | null
  checked_at: string
}

export type Retailer = VendorName

export const DEFAULT_LAYOUT_CONFIG: CatalogueLayoutConfig = {
  productName: { x: 50, y: 80, fontSize: 14, align: 'left' },
  varietyName: { x: 50, y: 100, fontSize: 12, align: 'left' },
  price: { x: 50, y: 120, fontSize: 14, align: 'left' },
  description: { x: 50, y: 140, fontSize: 10, align: 'left' },
  image: { x: 400, y: 50, width: 120, height: 120 },
  sku: { x: 50, y: 160, fontSize: 9, align: 'left' },
  productsPerPage: 4,
  fontSize: 12,
  textAlign: 'left',
  itemSpacingY: 180,
}
