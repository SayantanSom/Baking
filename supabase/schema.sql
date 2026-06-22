-- Product Cost Manager v2 - Supabase Schema
-- Run this in the Supabase SQL Editor for fresh installs

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- App users (approval + roles)
CREATE TABLE app_users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  email TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('super_admin', 'user')),
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_app_users_status ON app_users(status);
CREATE INDEX idx_app_users_role ON app_users(role);

-- Enterprise (shared workspace)
CREATE TABLE enterprises (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE enterprise_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  enterprise_id UUID NOT NULL REFERENCES enterprises(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'editor' CHECK (role IN ('owner', 'admin', 'editor', 'viewer')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (enterprise_id, user_id)
);

CREATE INDEX idx_enterprise_members_user_id ON enterprise_members(user_id);
CREATE INDEX idx_enterprise_members_enterprise_id ON enterprise_members(enterprise_id);

-- Enterprise settings (shared across members)
CREATE TABLE enterprise_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  enterprise_id UUID NOT NULL REFERENCES enterprises(id) ON DELETE CASCADE UNIQUE,
  default_buffer_percentage DECIMAL(5,2) NOT NULL DEFAULT 5.00,
  currency TEXT NOT NULL DEFAULT '£',
  tax_percentage DECIMAL(5,2) NOT NULL DEFAULT 20.00,
  default_labour_cost DECIMAL(12,4) NOT NULL DEFAULT 0,
  default_packaging_cost DECIMAL(12,4) NOT NULL DEFAULT 0,
  catalogue_title TEXT DEFAULT 'Product Catalogue',
  business_name TEXT DEFAULT '',
  footer_text TEXT DEFAULT '',
  show_prices BOOLEAN NOT NULL DEFAULT true,
  show_descriptions BOOLEAN NOT NULL DEFAULT true,
  show_images BOOLEAN NOT NULL DEFAULT true,
  products_per_page INTEGER NOT NULL DEFAULT 4 CHECK (products_per_page BETWEEN 1 AND 12),
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Master ingredients (no pack sizes at ingredient level)
CREATE TABLE ingredients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  enterprise_id UUID NOT NULL REFERENCES enterprises(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  base_unit TEXT NOT NULL CHECK (base_unit IN ('g', 'kg', 'ml', 'l', 'unit')),
  default_buffer_percentage DECIMAL(5,2) NOT NULL DEFAULT 5.00,
  notes TEXT,
  active_vendor_price_id UUID,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Vendor prices per ingredient
CREATE TABLE ingredient_vendor_prices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ingredient_id UUID NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
  vendor_name TEXT NOT NULL,
  pack_size DECIMAL(12,4) NOT NULL CHECK (pack_size > 0),
  pack_unit TEXT NOT NULL CHECK (pack_unit IN ('g', 'kg', 'ml', 'l', 'unit')),
  pack_cost DECIMAL(12,4) NOT NULL CHECK (pack_cost >= 0),
  cost_per_base_unit DECIMAL(12,6) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT false,
  product_url TEXT,
  last_checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE ingredients
  ADD CONSTRAINT fk_ingredients_active_vendor_price
  FOREIGN KEY (active_vendor_price_id)
  REFERENCES ingredient_vendor_prices(id) ON DELETE SET NULL;

-- Ingredient vendor price change history
CREATE TABLE ingredient_vendor_price_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ingredient_id UUID NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
  vendor_price_id UUID REFERENCES ingredient_vendor_prices(id) ON DELETE SET NULL,
  vendor_name TEXT,
  pack_size DECIMAL(12,4),
  pack_unit TEXT,
  pack_cost DECIMAL(12,4),
  converted_pack_size DECIMAL(12,4),
  previous_pack_cost DECIMAL(12,4),
  previous_cost_per_base_unit DECIMAL(12,6) NOT NULL,
  new_cost_per_base_unit DECIMAL(12,6) NOT NULL,
  percentage_change DECIMAL(8,4) NOT NULL,
  buffer_percentage_at_time DECIMAL(5,2) NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('green', 'amber', 'red')),
  checked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Products (parent entity)
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  enterprise_id UUID NOT NULL REFERENCES enterprises(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  image_url TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Product varieties (sellable SKUs)
CREATE TABLE product_varieties (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  variety_name TEXT NOT NULL,
  size_label TEXT,
  sku TEXT,
  selling_price DECIMAL(12,4) NOT NULL DEFAULT 0,
  recipe_yield INTEGER NOT NULL DEFAULT 1 CHECK (recipe_yield > 0),
  packaging_cost DECIMAL(12,4) NOT NULL DEFAULT 0,
  labour_cost DECIMAL(12,4) NOT NULL DEFAULT 0,
  shipping_cost DECIMAL(12,4) NOT NULL DEFAULT 0,
  current_cost_price DECIMAL(12,4) NOT NULL DEFAULT 0,
  suggested_selling_price DECIMAL(12,4),
  gross_margin DECIMAL(12,4) NOT NULL DEFAULT 0,
  is_catalogue_visible BOOLEAN NOT NULL DEFAULT true,
  base_recipe_factor DECIMAL(8,4) NOT NULL DEFAULT 1,
  source_recipe_version_id UUID,
  created_from_base_recipe_at TIMESTAMPTZ,
  last_base_recipe_sync_at TIMESTAMPTZ,
  has_manual_recipe_overrides BOOLEAN NOT NULL DEFAULT false,
  price_locked_until TIMESTAMPTZ,
  cost_locked_until TIMESTAMPTZ,
  locked_selling_price DECIMAL(12,4),
  locked_cost_price DECIMAL(12,4),
  buffer_percentage DECIMAL(5,2) NOT NULL DEFAULT 5.00,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Recipe lines per variety
CREATE TABLE product_variety_ingredients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_variety_id UUID NOT NULL REFERENCES product_varieties(id) ON DELETE CASCADE,
  ingredient_id UUID NOT NULL REFERENCES ingredients(id) ON DELETE RESTRICT,
  quantity_used DECIMAL(12,4) NOT NULL CHECK (quantity_used > 0),
  unit TEXT NOT NULL CHECK (unit IN ('g', 'kg', 'ml', 'l', 'unit')),
  active_vendor_price_id UUID REFERENCES ingredient_vendor_prices(id) ON DELETE SET NULL,
  calculated_cost DECIMAL(12,4) NOT NULL DEFAULT 0,
  UNIQUE (product_variety_id, ingredient_id)
);

-- Product recipe versions (base recipe)
CREATE TABLE product_recipe_versions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  name TEXT NOT NULL,
  notes TEXT,
  recipe_yield INTEGER NOT NULL DEFAULT 1 CHECK (recipe_yield > 0),
  is_current BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (product_id, version_number)
);

CREATE TABLE product_base_recipe_ingredients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  recipe_version_id UUID NOT NULL REFERENCES product_recipe_versions(id) ON DELETE CASCADE,
  ingredient_id UUID NOT NULL REFERENCES ingredients(id) ON DELETE RESTRICT,
  quantity_used DECIMAL(12,4) NOT NULL CHECK (quantity_used > 0),
  unit TEXT NOT NULL CHECK (unit IN ('g', 'kg', 'ml', 'l', 'unit')),
  scaling_mode TEXT NOT NULL DEFAULT 'proportional' CHECK (scaling_mode IN ('proportional', 'fixed')),
  active_vendor_price_id UUID REFERENCES ingredient_vendor_prices(id) ON DELETE SET NULL,
  calculated_cost DECIMAL(12,4) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (recipe_version_id, ingredient_id)
);

ALTER TABLE product_varieties
  ADD CONSTRAINT fk_varieties_source_recipe_version
  FOREIGN KEY (source_recipe_version_id)
  REFERENCES product_recipe_versions(id) ON DELETE SET NULL;

-- Selling price history
CREATE TABLE product_variety_selling_price_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_variety_id UUID NOT NULL REFERENCES product_varieties(id) ON DELETE CASCADE,
  previous_selling_price DECIMAL(12,4) NOT NULL,
  new_selling_price DECIMAL(12,4) NOT NULL,
  percentage_change DECIMAL(8,4) NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Variety cost history
CREATE TABLE product_variety_cost_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_variety_id UUID NOT NULL REFERENCES product_varieties(id) ON DELETE CASCADE,
  previous_cost_price DECIMAL(12,4) NOT NULL,
  new_cost_price DECIMAL(12,4) NOT NULL,
  percentage_change DECIMAL(8,4) NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('green', 'amber', 'red')),
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Variety acceptance snapshots (cost + margin baselines)
CREATE TABLE product_variety_acceptances (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_variety_id UUID NOT NULL REFERENCES product_varieties(id) ON DELETE CASCADE,
  accepted_cost_price DECIMAL(12,4) NOT NULL,
  accepted_selling_price DECIMAL(12,4) NOT NULL,
  accepted_margin_value DECIMAL(12,4) NOT NULL,
  accepted_margin_percentage DECIMAL(8,4) NOT NULL,
  buffer_percentage_at_time DECIMAL(5,2) NOT NULL,
  accepted_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  accepted_reason_type TEXT NOT NULL CHECK (accepted_reason_type IN (
    'supplier_increase_accepted',
    'seasonal_pricing',
    'catalogue_published',
    'recipe_change',
    'packaging_change',
    'labour_review',
    'manual_override',
    'initial_baseline'
  )),
  accepted_reason_notes TEXT,
  accepted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_pva_variety_accepted_at ON product_variety_acceptances(product_variety_id, accepted_at DESC);

-- Catalogue templates
CREATE TABLE catalogue_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  enterprise_id UUID NOT NULL REFERENCES enterprises(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Default Template',
  file_url TEXT,
  file_type TEXT CHECK (file_type IN ('pdf', 'png', 'jpg', 'jpeg')),
  layout_config JSONB NOT NULL DEFAULT '{
    "productName": {"x": 50, "y": 80, "fontSize": 14, "align": "left"},
    "varietyName": {"x": 50, "y": 100, "fontSize": 12, "align": "left"},
    "price": {"x": 50, "y": 120, "fontSize": 14, "align": "left"},
    "description": {"x": 50, "y": 140, "fontSize": 10, "align": "left"},
    "image": {"x": 400, "y": 50, "width": 120, "height": 120},
    "sku": {"x": 50, "y": 160, "fontSize": 9, "align": "left"},
    "productsPerPage": 4,
    "fontSize": 12,
    "textAlign": "left",
    "itemSpacingY": 180
  }'::jsonb,
  is_default BOOLEAN NOT NULL DEFAULT true,
  is_public BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_ingredients_enterprise_id ON ingredients(enterprise_id);
CREATE INDEX idx_ingredients_name ON ingredients(name);
CREATE INDEX idx_vendor_prices_ingredient_id ON ingredient_vendor_prices(ingredient_id);
CREATE INDEX idx_vendor_prices_active ON ingredient_vendor_prices(ingredient_id, is_active);
CREATE INDEX idx_ingredient_vendor_price_history_ingredient ON ingredient_vendor_price_history(ingredient_id);
CREATE INDEX idx_recipe_versions_product ON product_recipe_versions(product_id);
CREATE INDEX idx_base_recipe_version ON product_base_recipe_ingredients(recipe_version_id);
CREATE INDEX idx_pvsph_variety_id ON product_variety_selling_price_history(product_variety_id);
CREATE INDEX idx_products_enterprise_id ON products(enterprise_id);
CREATE INDEX idx_products_name ON products(name);
CREATE INDEX idx_products_category ON products(category);
CREATE INDEX idx_product_varieties_product_id ON product_varieties(product_id);
CREATE INDEX idx_product_varieties_sku ON product_varieties(sku);
CREATE INDEX idx_pvi_variety_id ON product_variety_ingredients(product_variety_id);
CREATE INDEX idx_pvi_ingredient_id ON product_variety_ingredients(ingredient_id);
CREATE INDEX idx_pvch_variety_id ON product_variety_cost_history(product_variety_id);
CREATE INDEX idx_catalogue_templates_enterprise_id ON catalogue_templates(enterprise_id);

-- Auth helpers (must exist before RLS policies)
CREATE OR REPLACE FUNCTION public.is_approved_user(uid UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM app_users
    WHERE user_id = uid AND status = 'approved'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin(uid UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM app_users
    WHERE user_id = uid AND role = 'super_admin' AND status = 'approved'
  );
$$;

CREATE OR REPLACE FUNCTION public.get_default_enterprise_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM enterprises ORDER BY created_at ASC LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_enterprise_member(ent_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM enterprise_members
    WHERE enterprise_id = ent_id AND user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.get_enterprise_role(ent_id UUID, uid UUID DEFAULT auth.uid())
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM enterprise_members
  WHERE enterprise_id = ent_id AND user_id = uid
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.add_user_to_default_enterprise(
  p_user_id UUID,
  p_role TEXT DEFAULT 'editor'
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ent_id UUID;
BEGIN
  ent_id := public.get_default_enterprise_id();
  IF ent_id IS NULL THEN
    RAISE EXCEPTION 'Default enterprise not found';
  END IF;

  INSERT INTO enterprise_members (enterprise_id, user_id, role)
  VALUES (ent_id, p_user_id, p_role)
  ON CONFLICT (enterprise_id, user_id) DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION public.approve_app_user(target_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE app_users
  SET status = 'approved', approved_at = NOW(), approved_by = auth.uid(), updated_at = NOW()
  WHERE user_id = target_user_id AND status = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found or not pending';
  END IF;

  PERFORM public.add_user_to_default_enterprise(target_user_id, 'editor');
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_app_user(target_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE app_users
  SET status = 'rejected', approved_at = NULL, approved_by = auth.uid(), updated_at = NOW()
  WHERE user_id = target_user_id AND status = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found or not pending';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_default_enterprise_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_enterprise_member(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_enterprise_role(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_app_user(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_app_user(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_super_admin(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_approved_user(UUID) TO authenticated;

-- Row Level Security
ALTER TABLE enterprises ENABLE ROW LEVEL SECURITY;
ALTER TABLE enterprise_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE enterprise_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingredient_vendor_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingredient_vendor_price_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_recipe_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_base_recipe_ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_variety_selling_price_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_varieties ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_variety_ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_variety_cost_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_variety_acceptances ENABLE ROW LEVEL SECURITY;
ALTER TABLE catalogue_templates ENABLE ROW LEVEL SECURITY;

-- User settings policies
CREATE POLICY "Users can view own app user row" ON app_users FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Super admins can view all app users" ON app_users FOR SELECT USING (public.is_super_admin(auth.uid()));

CREATE POLICY "Members can view own enterprise" ON enterprises FOR SELECT USING (
  public.is_enterprise_member(id) AND public.is_approved_user(auth.uid())
);

CREATE POLICY "Members can view enterprise members" ON enterprise_members FOR SELECT USING (
  public.is_enterprise_member(enterprise_id) AND public.is_approved_user(auth.uid())
);

CREATE POLICY "Members can view enterprise settings" ON enterprise_settings FOR SELECT USING (
  public.is_enterprise_member(enterprise_id) AND public.is_approved_user(auth.uid())
);
CREATE POLICY "Members can insert enterprise settings" ON enterprise_settings FOR INSERT WITH CHECK (
  public.is_enterprise_member(enterprise_id) AND public.is_approved_user(auth.uid())
);
CREATE POLICY "Members can update enterprise settings" ON enterprise_settings FOR UPDATE USING (
  public.is_enterprise_member(enterprise_id) AND public.is_approved_user(auth.uid())
);

-- Ingredients policies
CREATE POLICY "Members can view enterprise ingredients" ON ingredients FOR SELECT USING (
  public.is_enterprise_member(enterprise_id) AND public.is_approved_user(auth.uid())
);
CREATE POLICY "Members can insert enterprise ingredients" ON ingredients FOR INSERT WITH CHECK (
  public.is_enterprise_member(enterprise_id) AND public.is_approved_user(auth.uid())
);
CREATE POLICY "Members can update enterprise ingredients" ON ingredients FOR UPDATE USING (
  public.is_enterprise_member(enterprise_id) AND public.is_approved_user(auth.uid())
);
CREATE POLICY "Members can delete enterprise ingredients" ON ingredients FOR DELETE USING (
  public.is_enterprise_member(enterprise_id) AND public.is_approved_user(auth.uid())
);

-- Vendor prices (via ingredient enterprise)
CREATE POLICY "Members can view enterprise vendor prices" ON ingredient_vendor_prices FOR SELECT USING (
  EXISTS (SELECT 1 FROM ingredients i WHERE i.id = ingredient_vendor_prices.ingredient_id AND public.is_enterprise_member(i.enterprise_id))
);
CREATE POLICY "Members can insert enterprise vendor prices" ON ingredient_vendor_prices FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM ingredients i WHERE i.id = ingredient_vendor_prices.ingredient_id AND public.is_enterprise_member(i.enterprise_id))
);
CREATE POLICY "Members can update enterprise vendor prices" ON ingredient_vendor_prices FOR UPDATE USING (
  EXISTS (SELECT 1 FROM ingredients i WHERE i.id = ingredient_vendor_prices.ingredient_id AND public.is_enterprise_member(i.enterprise_id))
);
CREATE POLICY "Members can delete enterprise vendor prices" ON ingredient_vendor_prices FOR DELETE USING (
  EXISTS (SELECT 1 FROM ingredients i WHERE i.id = ingredient_vendor_prices.ingredient_id AND public.is_enterprise_member(i.enterprise_id))
);

-- Ingredient vendor price history
CREATE POLICY "Members can view enterprise ingredient vendor price history" ON ingredient_vendor_price_history FOR SELECT USING (
  EXISTS (SELECT 1 FROM ingredients i WHERE i.id = ingredient_vendor_price_history.ingredient_id AND public.is_enterprise_member(i.enterprise_id))
);
CREATE POLICY "Members can insert enterprise ingredient vendor price history" ON ingredient_vendor_price_history FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM ingredients i WHERE i.id = ingredient_vendor_price_history.ingredient_id AND public.is_enterprise_member(i.enterprise_id))
);

-- Recipe versions
CREATE POLICY "Members can view enterprise recipe versions" ON product_recipe_versions FOR SELECT USING (
  EXISTS (SELECT 1 FROM products p WHERE p.id = product_recipe_versions.product_id AND public.is_enterprise_member(p.enterprise_id))
);
CREATE POLICY "Members can insert enterprise recipe versions" ON product_recipe_versions FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM products p WHERE p.id = product_recipe_versions.product_id AND public.is_enterprise_member(p.enterprise_id))
);
CREATE POLICY "Members can update enterprise recipe versions" ON product_recipe_versions FOR UPDATE USING (
  EXISTS (SELECT 1 FROM products p WHERE p.id = product_recipe_versions.product_id AND public.is_enterprise_member(p.enterprise_id))
);
CREATE POLICY "Members can delete enterprise recipe versions" ON product_recipe_versions FOR DELETE USING (
  EXISTS (SELECT 1 FROM products p WHERE p.id = product_recipe_versions.product_id AND public.is_enterprise_member(p.enterprise_id))
);

-- Base recipe ingredients
CREATE POLICY "Members can view enterprise base recipe ingredients" ON product_base_recipe_ingredients FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM product_recipe_versions rv
    JOIN products p ON p.id = rv.product_id
    WHERE rv.id = product_base_recipe_ingredients.recipe_version_id AND public.is_enterprise_member(p.enterprise_id)
  )
);
CREATE POLICY "Members can insert enterprise base recipe ingredients" ON product_base_recipe_ingredients FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM product_recipe_versions rv
    JOIN products p ON p.id = rv.product_id
    WHERE rv.id = product_base_recipe_ingredients.recipe_version_id AND public.is_enterprise_member(p.enterprise_id)
  )
);
CREATE POLICY "Members can update enterprise base recipe ingredients" ON product_base_recipe_ingredients FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM product_recipe_versions rv
    JOIN products p ON p.id = rv.product_id
    WHERE rv.id = product_base_recipe_ingredients.recipe_version_id AND public.is_enterprise_member(p.enterprise_id)
  )
);
CREATE POLICY "Members can delete enterprise base recipe ingredients" ON product_base_recipe_ingredients FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM product_recipe_versions rv
    JOIN products p ON p.id = rv.product_id
    WHERE rv.id = product_base_recipe_ingredients.recipe_version_id AND public.is_enterprise_member(p.enterprise_id)
  )
);

-- Selling price history
CREATE POLICY "Members can view enterprise selling price history" ON product_variety_selling_price_history FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM product_varieties pv
    JOIN products p ON p.id = pv.product_id
    WHERE pv.id = product_variety_selling_price_history.product_variety_id AND public.is_enterprise_member(p.enterprise_id)
  )
);
CREATE POLICY "Members can insert enterprise selling price history" ON product_variety_selling_price_history FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM product_varieties pv
    JOIN products p ON p.id = pv.product_id
    WHERE pv.id = product_variety_selling_price_history.product_variety_id AND public.is_enterprise_member(p.enterprise_id)
  )
);

-- Products policies
CREATE POLICY "Members can view enterprise products" ON products FOR SELECT USING (
  public.is_enterprise_member(enterprise_id) AND public.is_approved_user(auth.uid())
);
CREATE POLICY "Members can insert enterprise products" ON products FOR INSERT WITH CHECK (
  public.is_enterprise_member(enterprise_id) AND public.is_approved_user(auth.uid())
);
CREATE POLICY "Members can update enterprise products" ON products FOR UPDATE USING (
  public.is_enterprise_member(enterprise_id) AND public.is_approved_user(auth.uid())
);
CREATE POLICY "Members can delete enterprise products" ON products FOR DELETE USING (
  public.is_enterprise_member(enterprise_id) AND public.is_approved_user(auth.uid())
);

-- Product varieties (via product enterprise)
CREATE POLICY "Members can view enterprise varieties" ON product_varieties FOR SELECT USING (
  EXISTS (SELECT 1 FROM products p WHERE p.id = product_varieties.product_id AND public.is_enterprise_member(p.enterprise_id))
);
CREATE POLICY "Members can insert enterprise varieties" ON product_varieties FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM products p WHERE p.id = product_varieties.product_id AND public.is_enterprise_member(p.enterprise_id))
);
CREATE POLICY "Members can update enterprise varieties" ON product_varieties FOR UPDATE USING (
  EXISTS (SELECT 1 FROM products p WHERE p.id = product_varieties.product_id AND public.is_enterprise_member(p.enterprise_id))
);
CREATE POLICY "Members can delete enterprise varieties" ON product_varieties FOR DELETE USING (
  EXISTS (SELECT 1 FROM products p WHERE p.id = product_varieties.product_id AND public.is_enterprise_member(p.enterprise_id))
);

-- Variety ingredients
CREATE POLICY "Members can view enterprise variety ingredients" ON product_variety_ingredients FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM product_varieties pv
    JOIN products p ON p.id = pv.product_id
    WHERE pv.id = product_variety_ingredients.product_variety_id AND public.is_enterprise_member(p.enterprise_id)
  )
);
CREATE POLICY "Members can insert enterprise variety ingredients" ON product_variety_ingredients FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM product_varieties pv
    JOIN products p ON p.id = pv.product_id
    WHERE pv.id = product_variety_ingredients.product_variety_id AND public.is_enterprise_member(p.enterprise_id)
  )
);
CREATE POLICY "Members can update enterprise variety ingredients" ON product_variety_ingredients FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM product_varieties pv
    JOIN products p ON p.id = pv.product_id
    WHERE pv.id = product_variety_ingredients.product_variety_id AND public.is_enterprise_member(p.enterprise_id)
  )
);
CREATE POLICY "Members can delete enterprise variety ingredients" ON product_variety_ingredients FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM product_varieties pv
    JOIN products p ON p.id = pv.product_id
    WHERE pv.id = product_variety_ingredients.product_variety_id AND public.is_enterprise_member(p.enterprise_id)
  )
);

-- Variety cost history
CREATE POLICY "Members can view enterprise variety cost history" ON product_variety_cost_history FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM product_varieties pv
    JOIN products p ON p.id = pv.product_id
    WHERE pv.id = product_variety_cost_history.product_variety_id AND public.is_enterprise_member(p.enterprise_id)
  )
);
CREATE POLICY "Members can insert enterprise variety cost history" ON product_variety_cost_history FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM product_varieties pv
    JOIN products p ON p.id = pv.product_id
    WHERE pv.id = product_variety_cost_history.product_variety_id AND public.is_enterprise_member(p.enterprise_id)
  )
);

-- Variety acceptances
CREATE POLICY "Members can view enterprise variety acceptances" ON product_variety_acceptances FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM product_varieties pv
    JOIN products p ON p.id = pv.product_id
    WHERE pv.id = product_variety_acceptances.product_variety_id AND public.is_enterprise_member(p.enterprise_id)
  )
);
CREATE POLICY "Members can insert enterprise variety acceptances" ON product_variety_acceptances FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM product_varieties pv
    JOIN products p ON p.id = pv.product_id
    WHERE pv.id = product_variety_acceptances.product_variety_id AND public.is_enterprise_member(p.enterprise_id)
  )
  AND accepted_by = auth.uid()
);

-- Catalogue templates
CREATE POLICY "Members can view enterprise catalogue templates" ON catalogue_templates FOR SELECT USING (
  public.is_enterprise_member(enterprise_id) AND public.is_approved_user(auth.uid())
);
CREATE POLICY "Members can insert enterprise catalogue templates" ON catalogue_templates FOR INSERT WITH CHECK (
  public.is_enterprise_member(enterprise_id) AND public.is_approved_user(auth.uid())
);
CREATE POLICY "Members can update enterprise catalogue templates" ON catalogue_templates FOR UPDATE USING (
  public.is_enterprise_member(enterprise_id) AND public.is_approved_user(auth.uid())
);
CREATE POLICY "Members can delete enterprise catalogue templates" ON catalogue_templates FOR DELETE USING (
  public.is_enterprise_member(enterprise_id) AND public.is_approved_user(auth.uid())
);

-- Storage bucket for catalogue template files (run in Supabase dashboard or via API)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('catalogue-templates', 'catalogue-templates', true);

-- Signup trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inviter_id UUID;
  default_ent_id UUID;
BEGIN
  IF EXISTS (SELECT 1 FROM app_users WHERE user_id = NEW.id) THEN
    RETURN NEW;
  END IF;

  default_ent_id := public.get_default_enterprise_id();

  IF COALESCE(NEW.raw_user_meta_data->>'invited_by_admin', '') = 'true' THEN
    inviter_id := NULLIF(NEW.raw_user_meta_data->>'invited_by', '')::UUID;

    INSERT INTO app_users (user_id, email, status, role, approved_at, approved_by)
    VALUES (NEW.id, NEW.email, 'approved', 'user', NOW(), inviter_id)
    ON CONFLICT (user_id) DO UPDATE
      SET status = 'approved',
          email = EXCLUDED.email,
          approved_at = COALESCE(app_users.approved_at, NOW()),
          approved_by = COALESCE(app_users.approved_by, EXCLUDED.approved_by);

    IF default_ent_id IS NOT NULL THEN
      PERFORM public.add_user_to_default_enterprise(NEW.id, 'editor');
    END IF;
    RETURN NEW;
  END IF;

  IF (SELECT COUNT(*) FROM app_users) = 0 THEN
    INSERT INTO app_users (user_id, email, status, role, approved_at)
    VALUES (NEW.id, NEW.email, 'approved', 'super_admin', NOW());

    IF default_ent_id IS NULL THEN
      INSERT INTO enterprises (name) VALUES ('Default') RETURNING id INTO default_ent_id;
    END IF;

    INSERT INTO enterprise_members (enterprise_id, user_id, role)
    VALUES (default_ent_id, NEW.id, 'owner')
    ON CONFLICT (enterprise_id, user_id) DO NOTHING;

    INSERT INTO enterprise_settings (enterprise_id)
    VALUES (default_ent_id)
    ON CONFLICT (enterprise_id) DO NOTHING;
  ELSE
    INSERT INTO app_users (user_id, email, status, role)
    VALUES (NEW.id, NEW.email, 'pending', 'user');
  END IF;

  RETURN NEW;
END;
$$;

GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO supabase_auth_admin;
GRANT ALL ON TABLE public.app_users TO supabase_auth_admin;
GRANT ALL ON TABLE public.enterprises TO supabase_auth_admin;
GRANT ALL ON TABLE public.enterprise_members TO supabase_auth_admin;
GRANT ALL ON TABLE public.enterprise_settings TO supabase_auth_admin;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Updated_at trigger helper
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER enterprises_updated BEFORE UPDATE ON enterprises FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER enterprise_settings_updated BEFORE UPDATE ON enterprise_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER product_recipe_versions_updated BEFORE UPDATE ON product_recipe_versions FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER app_users_updated BEFORE UPDATE ON app_users FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER ingredients_updated BEFORE UPDATE ON ingredients FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER vendor_prices_updated BEFORE UPDATE ON ingredient_vendor_prices FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER products_updated BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER varieties_updated BEFORE UPDATE ON product_varieties FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER base_recipe_ingredients_updated BEFORE UPDATE ON product_base_recipe_ingredients FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER catalogue_templates_updated BEFORE UPDATE ON catalogue_templates FOR EACH ROW EXECUTE FUNCTION update_updated_at();
