-- Single Enterprise V1: shared data via enterprise_id + membership-based RLS
-- Run once in the Supabase SQL Editor on an existing database.

-- ---------------------------------------------------------------------------
-- 1. Core enterprise tables
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS enterprises (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS enterprise_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  enterprise_id UUID NOT NULL REFERENCES enterprises(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'editor' CHECK (role IN ('owner', 'admin', 'editor', 'viewer')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (enterprise_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_enterprise_members_user_id ON enterprise_members(user_id);
CREATE INDEX IF NOT EXISTS idx_enterprise_members_enterprise_id ON enterprise_members(enterprise_id);

CREATE TABLE IF NOT EXISTS enterprise_settings (
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

-- ---------------------------------------------------------------------------
-- 2. Helper functions
-- ---------------------------------------------------------------------------

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

GRANT EXECUTE ON FUNCTION public.get_default_enterprise_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_enterprise_member(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_enterprise_role(UUID, UUID) TO authenticated;

-- ---------------------------------------------------------------------------
-- 3. Default enterprise + column changes
-- ---------------------------------------------------------------------------

INSERT INTO enterprises (name)
SELECT 'Default'
WHERE NOT EXISTS (SELECT 1 FROM enterprises);

DO $$
DECLARE
  default_ent_id UUID;
  owner_user_id UUID;
BEGIN
  default_ent_id := public.get_default_enterprise_id();

  -- Add enterprise_id (nullable during backfill)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'ingredients' AND column_name = 'enterprise_id'
  ) THEN
    ALTER TABLE ingredients ADD COLUMN enterprise_id UUID REFERENCES enterprises(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'enterprise_id'
  ) THEN
    ALTER TABLE products ADD COLUMN enterprise_id UUID REFERENCES enterprises(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'catalogue_templates' AND column_name = 'enterprise_id'
  ) THEN
    ALTER TABLE catalogue_templates ADD COLUMN enterprise_id UUID REFERENCES enterprises(id) ON DELETE CASCADE;
  END IF;

  UPDATE ingredients SET enterprise_id = default_ent_id WHERE enterprise_id IS NULL;
  UPDATE products SET enterprise_id = default_ent_id WHERE enterprise_id IS NULL;
  UPDATE catalogue_templates SET enterprise_id = default_ent_id WHERE enterprise_id IS NULL;

  -- Rename user_id → created_by
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'ingredients' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE ingredients RENAME COLUMN user_id TO created_by;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE products RENAME COLUMN user_id TO created_by;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'catalogue_templates' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE catalogue_templates RENAME COLUMN user_id TO created_by;
  END IF;

  -- Optimistic locking
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'ingredients' AND column_name = 'version'
  ) THEN
    ALTER TABLE ingredients ADD COLUMN version INTEGER NOT NULL DEFAULT 1;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'version'
  ) THEN
    ALTER TABLE products ADD COLUMN version INTEGER NOT NULL DEFAULT 1;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'catalogue_templates' AND column_name = 'is_public'
  ) THEN
    ALTER TABLE catalogue_templates ADD COLUMN is_public BOOLEAN NOT NULL DEFAULT true;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'product_recipe_versions' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE product_recipe_versions
      ADD COLUMN created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'product_recipe_versions' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE product_recipe_versions
      ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
  END IF;

  UPDATE product_recipe_versions rv
  SET created_by = p.created_by
  FROM products p
  WHERE p.id = rv.product_id AND rv.created_by IS NULL;

  ALTER TABLE ingredients ALTER COLUMN enterprise_id SET NOT NULL;
  ALTER TABLE products ALTER COLUMN enterprise_id SET NOT NULL;
  ALTER TABLE catalogue_templates ALTER COLUMN enterprise_id SET NOT NULL;

  -- Enterprise members: owner = earliest auth user, others = editor
  SELECT id INTO owner_user_id FROM auth.users ORDER BY created_at ASC LIMIT 1;

  INSERT INTO enterprise_members (enterprise_id, user_id, role)
  SELECT default_ent_id, au.user_id,
    CASE WHEN au.user_id = owner_user_id THEN 'owner' ELSE 'editor' END
  FROM app_users au
  WHERE au.status = 'approved'
  ON CONFLICT (enterprise_id, user_id) DO NOTHING;

  -- Enterprise settings from super-admin or earliest user_settings
  IF NOT EXISTS (SELECT 1 FROM enterprise_settings WHERE enterprise_id = default_ent_id) THEN
    INSERT INTO enterprise_settings (
      enterprise_id,
      default_buffer_percentage,
      currency,
      tax_percentage,
      default_labour_cost,
      default_packaging_cost,
      catalogue_title,
      business_name,
      footer_text,
      show_prices,
      show_descriptions,
      show_images,
      products_per_page
    )
    SELECT
      default_ent_id,
      us.default_buffer_percentage,
      us.currency,
      us.tax_percentage,
      us.default_labour_cost,
      us.default_packaging_cost,
      us.catalogue_title,
      us.business_name,
      us.footer_text,
      us.show_prices,
      us.show_descriptions,
      us.show_images,
      us.products_per_page
    FROM user_settings us
    WHERE us.user_id = COALESCE(
      (SELECT user_id FROM app_users WHERE role = 'super_admin' AND status = 'approved' ORDER BY created_at ASC LIMIT 1),
      owner_user_id
    )
    LIMIT 1;

    IF NOT FOUND THEN
      INSERT INTO enterprise_settings (enterprise_id) VALUES (default_ent_id);
    END IF;
  END IF;
END $$;

DROP INDEX IF EXISTS idx_ingredients_user_id;
DROP INDEX IF EXISTS idx_products_user_id;
DROP INDEX IF EXISTS idx_catalogue_templates_user_id;

CREATE INDEX IF NOT EXISTS idx_ingredients_enterprise_id ON ingredients(enterprise_id);
CREATE INDEX IF NOT EXISTS idx_products_enterprise_id ON products(enterprise_id);
CREATE INDEX IF NOT EXISTS idx_catalogue_templates_enterprise_id ON catalogue_templates(enterprise_id);

-- ---------------------------------------------------------------------------
-- 4. Drop user_settings (replaced by enterprise_settings)
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Users can view own settings" ON user_settings;
DROP POLICY IF EXISTS "Users can insert own settings" ON user_settings;
DROP POLICY IF EXISTS "Users can update own settings" ON user_settings;

DROP TABLE IF EXISTS user_settings;

-- ---------------------------------------------------------------------------
-- 5. RLS on new tables
-- ---------------------------------------------------------------------------

ALTER TABLE enterprises ENABLE ROW LEVEL SECURITY;
ALTER TABLE enterprise_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE enterprise_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view own enterprise" ON enterprises;
CREATE POLICY "Members can view own enterprise" ON enterprises
  FOR SELECT USING (
    public.is_enterprise_member(id) AND public.is_approved_user(auth.uid())
  );

DROP POLICY IF EXISTS "Members can view enterprise members" ON enterprise_members;
CREATE POLICY "Members can view enterprise members" ON enterprise_members
  FOR SELECT USING (
    public.is_enterprise_member(enterprise_id) AND public.is_approved_user(auth.uid())
  );

DROP POLICY IF EXISTS "Members can view enterprise settings" ON enterprise_settings;
CREATE POLICY "Members can view enterprise settings" ON enterprise_settings
  FOR SELECT USING (
    public.is_enterprise_member(enterprise_id) AND public.is_approved_user(auth.uid())
  );

DROP POLICY IF EXISTS "Members can insert enterprise settings" ON enterprise_settings;
CREATE POLICY "Members can insert enterprise settings" ON enterprise_settings
  FOR INSERT WITH CHECK (
    public.is_enterprise_member(enterprise_id) AND public.is_approved_user(auth.uid())
  );

DROP POLICY IF EXISTS "Members can update enterprise settings" ON enterprise_settings;
CREATE POLICY "Members can update enterprise settings" ON enterprise_settings
  FOR UPDATE USING (
    public.is_enterprise_member(enterprise_id) AND public.is_approved_user(auth.uid())
  );

-- ---------------------------------------------------------------------------
-- 6. Replace business-data RLS (user_id → enterprise membership)
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Users can view own ingredients" ON ingredients;
DROP POLICY IF EXISTS "Users can insert own ingredients" ON ingredients;
DROP POLICY IF EXISTS "Users can update own ingredients" ON ingredients;
DROP POLICY IF EXISTS "Users can delete own ingredients" ON ingredients;

CREATE POLICY "Members can view enterprise ingredients" ON ingredients
  FOR SELECT USING (public.is_enterprise_member(enterprise_id) AND public.is_approved_user(auth.uid()));
CREATE POLICY "Members can insert enterprise ingredients" ON ingredients
  FOR INSERT WITH CHECK (public.is_enterprise_member(enterprise_id) AND public.is_approved_user(auth.uid()));
CREATE POLICY "Members can update enterprise ingredients" ON ingredients
  FOR UPDATE USING (public.is_enterprise_member(enterprise_id) AND public.is_approved_user(auth.uid()));
CREATE POLICY "Members can delete enterprise ingredients" ON ingredients
  FOR DELETE USING (public.is_enterprise_member(enterprise_id) AND public.is_approved_user(auth.uid()));

DROP POLICY IF EXISTS "Users can view own vendor prices" ON ingredient_vendor_prices;
DROP POLICY IF EXISTS "Users can insert own vendor prices" ON ingredient_vendor_prices;
DROP POLICY IF EXISTS "Users can update own vendor prices" ON ingredient_vendor_prices;
DROP POLICY IF EXISTS "Users can delete own vendor prices" ON ingredient_vendor_prices;

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

DROP POLICY IF EXISTS "Users can view own ingredient vendor price history" ON ingredient_vendor_price_history;
DROP POLICY IF EXISTS "Users can insert own ingredient vendor price history" ON ingredient_vendor_price_history;

CREATE POLICY "Members can view enterprise ingredient vendor price history" ON ingredient_vendor_price_history FOR SELECT USING (
  EXISTS (SELECT 1 FROM ingredients i WHERE i.id = ingredient_vendor_price_history.ingredient_id AND public.is_enterprise_member(i.enterprise_id))
);
CREATE POLICY "Members can insert enterprise ingredient vendor price history" ON ingredient_vendor_price_history FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM ingredients i WHERE i.id = ingredient_vendor_price_history.ingredient_id AND public.is_enterprise_member(i.enterprise_id))
);

DROP POLICY IF EXISTS "Users can view own recipe versions" ON product_recipe_versions;
DROP POLICY IF EXISTS "Users can insert own recipe versions" ON product_recipe_versions;
DROP POLICY IF EXISTS "Users can update own recipe versions" ON product_recipe_versions;
DROP POLICY IF EXISTS "Users can delete own recipe versions" ON product_recipe_versions;

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

DROP POLICY IF EXISTS "Users can view own base recipe ingredients" ON product_base_recipe_ingredients;
DROP POLICY IF EXISTS "Users can insert own base recipe ingredients" ON product_base_recipe_ingredients;
DROP POLICY IF EXISTS "Users can update own base recipe ingredients" ON product_base_recipe_ingredients;
DROP POLICY IF EXISTS "Users can delete own base recipe ingredients" ON product_base_recipe_ingredients;

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

DROP POLICY IF EXISTS "Users can view own selling price history" ON product_variety_selling_price_history;
DROP POLICY IF EXISTS "Users can insert own selling price history" ON product_variety_selling_price_history;

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

DROP POLICY IF EXISTS "Users can view own products" ON products;
DROP POLICY IF EXISTS "Users can insert own products" ON products;
DROP POLICY IF EXISTS "Users can update own products" ON products;
DROP POLICY IF EXISTS "Users can delete own products" ON products;

CREATE POLICY "Members can view enterprise products" ON products
  FOR SELECT USING (public.is_enterprise_member(enterprise_id) AND public.is_approved_user(auth.uid()));
CREATE POLICY "Members can insert enterprise products" ON products
  FOR INSERT WITH CHECK (public.is_enterprise_member(enterprise_id) AND public.is_approved_user(auth.uid()));
CREATE POLICY "Members can update enterprise products" ON products
  FOR UPDATE USING (public.is_enterprise_member(enterprise_id) AND public.is_approved_user(auth.uid()));
CREATE POLICY "Members can delete enterprise products" ON products
  FOR DELETE USING (public.is_enterprise_member(enterprise_id) AND public.is_approved_user(auth.uid()));

DROP POLICY IF EXISTS "Users can view own varieties" ON product_varieties;
DROP POLICY IF EXISTS "Users can insert own varieties" ON product_varieties;
DROP POLICY IF EXISTS "Users can update own varieties" ON product_varieties;
DROP POLICY IF EXISTS "Users can delete own varieties" ON product_varieties;

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

DROP POLICY IF EXISTS "Users can view own variety ingredients" ON product_variety_ingredients;
DROP POLICY IF EXISTS "Users can insert own variety ingredients" ON product_variety_ingredients;
DROP POLICY IF EXISTS "Users can update own variety ingredients" ON product_variety_ingredients;
DROP POLICY IF EXISTS "Users can delete own variety ingredients" ON product_variety_ingredients;

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

DROP POLICY IF EXISTS "Users can view own variety cost history" ON product_variety_cost_history;
DROP POLICY IF EXISTS "Users can insert own variety cost history" ON product_variety_cost_history;

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

DROP POLICY IF EXISTS "Users can view own variety acceptances" ON product_variety_acceptances;
DROP POLICY IF EXISTS "Users can insert own variety acceptances" ON product_variety_acceptances;

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

DROP POLICY IF EXISTS "Users can view own catalogue templates" ON catalogue_templates;
DROP POLICY IF EXISTS "Users can insert own catalogue templates" ON catalogue_templates;
DROP POLICY IF EXISTS "Users can update own catalogue templates" ON catalogue_templates;
DROP POLICY IF EXISTS "Users can delete own catalogue templates" ON catalogue_templates;

CREATE POLICY "Members can view enterprise catalogue templates" ON catalogue_templates
  FOR SELECT USING (public.is_enterprise_member(enterprise_id) AND public.is_approved_user(auth.uid()));
CREATE POLICY "Members can insert enterprise catalogue templates" ON catalogue_templates
  FOR INSERT WITH CHECK (public.is_enterprise_member(enterprise_id) AND public.is_approved_user(auth.uid()));
CREATE POLICY "Members can update enterprise catalogue templates" ON catalogue_templates
  FOR UPDATE USING (public.is_enterprise_member(enterprise_id) AND public.is_approved_user(auth.uid()));
CREATE POLICY "Members can delete enterprise catalogue templates" ON catalogue_templates
  FOR DELETE USING (public.is_enterprise_member(enterprise_id) AND public.is_approved_user(auth.uid()));

-- ---------------------------------------------------------------------------
-- 7. Update auth / approval functions
-- ---------------------------------------------------------------------------

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

CREATE TRIGGER product_recipe_versions_updated
  BEFORE UPDATE ON product_recipe_versions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER enterprise_settings_updated
  BEFORE UPDATE ON enterprise_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER enterprises_updated
  BEFORE UPDATE ON enterprises
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

GRANT ALL ON TABLE public.enterprises TO supabase_auth_admin;
GRANT ALL ON TABLE public.enterprise_members TO supabase_auth_admin;
GRANT ALL ON TABLE public.enterprise_settings TO supabase_auth_admin;
