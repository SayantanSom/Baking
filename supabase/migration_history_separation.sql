-- Product Cost Manager — history separation, base recipe versioning, locking
-- Idempotent migration for existing v2 databases

-- 1. Selling price history
CREATE TABLE IF NOT EXISTS product_variety_selling_price_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_variety_id UUID NOT NULL REFERENCES product_varieties(id) ON DELETE CASCADE,
  previous_selling_price DECIMAL(12,4) NOT NULL,
  new_selling_price DECIMAL(12,4) NOT NULL,
  percentage_change DECIMAL(8,4) NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pvsph_variety_id ON product_variety_selling_price_history(product_variety_id);

ALTER TABLE product_variety_selling_price_history ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'product_variety_selling_price_history' AND policyname = 'Users can view own selling price history'
  ) THEN
    CREATE POLICY "Users can view own selling price history" ON product_variety_selling_price_history FOR SELECT USING (
      EXISTS (
        SELECT 1 FROM product_varieties pv
        JOIN products p ON p.id = pv.product_id
        WHERE pv.id = product_variety_selling_price_history.product_variety_id AND p.user_id = auth.uid()
      )
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'product_variety_selling_price_history' AND policyname = 'Users can insert own selling price history'
  ) THEN
    CREATE POLICY "Users can insert own selling price history" ON product_variety_selling_price_history FOR INSERT WITH CHECK (
      EXISTS (
        SELECT 1 FROM product_varieties pv
        JOIN products p ON p.id = pv.product_id
        WHERE pv.id = product_variety_selling_price_history.product_variety_id AND p.user_id = auth.uid()
      )
    );
  END IF;
END $$;

-- 2. Rename ingredient price history → ingredient_vendor_price_history
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ingredient_price_history')
     AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ingredient_vendor_price_history') THEN
    ALTER TABLE ingredient_price_history RENAME TO ingredient_vendor_price_history;
  END IF;
END $$;

ALTER TABLE ingredient_vendor_price_history ADD COLUMN IF NOT EXISTS vendor_name TEXT;
ALTER TABLE ingredient_vendor_price_history ADD COLUMN IF NOT EXISTS pack_size DECIMAL(12,4);
ALTER TABLE ingredient_vendor_price_history ADD COLUMN IF NOT EXISTS pack_unit TEXT;
ALTER TABLE ingredient_vendor_price_history ADD COLUMN IF NOT EXISTS pack_cost DECIMAL(12,4);
ALTER TABLE ingredient_vendor_price_history ADD COLUMN IF NOT EXISTS converted_pack_size DECIMAL(12,4);
ALTER TABLE ingredient_vendor_price_history ADD COLUMN IF NOT EXISTS previous_pack_cost DECIMAL(12,4);
ALTER TABLE ingredient_vendor_price_history ADD COLUMN IF NOT EXISTS checked_at TIMESTAMPTZ;

-- Backfill vendor fields from vendor_prices where possible
UPDATE ingredient_vendor_price_history h
SET
  vendor_name = COALESCE(h.vendor_name, vp.vendor_name),
  pack_size = COALESCE(h.pack_size, vp.pack_size),
  pack_unit = COALESCE(h.pack_unit, vp.pack_unit),
  pack_cost = COALESCE(h.pack_cost, vp.pack_cost),
  checked_at = COALESCE(h.checked_at, h.created_at)
FROM ingredient_vendor_prices vp
WHERE h.vendor_price_id = vp.id;

UPDATE ingredient_vendor_price_history
SET checked_at = created_at
WHERE checked_at IS NULL;

-- 3. Recipe versions
CREATE TABLE IF NOT EXISTS product_recipe_versions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  name TEXT NOT NULL,
  notes TEXT,
  recipe_yield INTEGER NOT NULL DEFAULT 1 CHECK (recipe_yield > 0),
  is_current BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (product_id, version_number)
);

CREATE INDEX IF NOT EXISTS idx_recipe_versions_product ON product_recipe_versions(product_id);

CREATE TABLE IF NOT EXISTS product_base_recipe_ingredients (
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

CREATE INDEX IF NOT EXISTS idx_base_recipe_version ON product_base_recipe_ingredients(recipe_version_id);

-- 4. Variety columns for base recipe + locking
ALTER TABLE product_varieties ADD COLUMN IF NOT EXISTS base_recipe_factor DECIMAL(8,4) NOT NULL DEFAULT 1;
ALTER TABLE product_varieties ADD COLUMN IF NOT EXISTS source_recipe_version_id UUID REFERENCES product_recipe_versions(id) ON DELETE SET NULL;
ALTER TABLE product_varieties ADD COLUMN IF NOT EXISTS created_from_base_recipe_at TIMESTAMPTZ;
ALTER TABLE product_varieties ADD COLUMN IF NOT EXISTS last_base_recipe_sync_at TIMESTAMPTZ;
ALTER TABLE product_varieties ADD COLUMN IF NOT EXISTS has_manual_recipe_overrides BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE product_varieties ADD COLUMN IF NOT EXISTS price_locked_until TIMESTAMPTZ;
ALTER TABLE product_varieties ADD COLUMN IF NOT EXISTS cost_locked_until TIMESTAMPTZ;
ALTER TABLE product_varieties ADD COLUMN IF NOT EXISTS locked_selling_price DECIMAL(12,4);
ALTER TABLE product_varieties ADD COLUMN IF NOT EXISTS locked_cost_price DECIMAL(12,4);

-- 5. RLS for recipe tables
ALTER TABLE product_recipe_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_base_recipe_ingredients ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'product_recipe_versions' AND policyname = 'Users can view own recipe versions') THEN
    CREATE POLICY "Users can view own recipe versions" ON product_recipe_versions FOR SELECT USING (
      EXISTS (SELECT 1 FROM products WHERE products.id = product_recipe_versions.product_id AND products.user_id = auth.uid())
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'product_recipe_versions' AND policyname = 'Users can insert own recipe versions') THEN
    CREATE POLICY "Users can insert own recipe versions" ON product_recipe_versions FOR INSERT WITH CHECK (
      EXISTS (SELECT 1 FROM products WHERE products.id = product_recipe_versions.product_id AND products.user_id = auth.uid())
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'product_recipe_versions' AND policyname = 'Users can update own recipe versions') THEN
    CREATE POLICY "Users can update own recipe versions" ON product_recipe_versions FOR UPDATE USING (
      EXISTS (SELECT 1 FROM products WHERE products.id = product_recipe_versions.product_id AND products.user_id = auth.uid())
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'product_recipe_versions' AND policyname = 'Users can delete own recipe versions') THEN
    CREATE POLICY "Users can delete own recipe versions" ON product_recipe_versions FOR DELETE USING (
      EXISTS (SELECT 1 FROM products WHERE products.id = product_recipe_versions.product_id AND products.user_id = auth.uid())
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'product_base_recipe_ingredients' AND policyname = 'Users can view own base recipe ingredients') THEN
    CREATE POLICY "Users can view own base recipe ingredients" ON product_base_recipe_ingredients FOR SELECT USING (
      EXISTS (
        SELECT 1 FROM product_recipe_versions rv
        JOIN products p ON p.id = rv.product_id
        WHERE rv.id = product_base_recipe_ingredients.recipe_version_id AND p.user_id = auth.uid()
      )
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'product_base_recipe_ingredients' AND policyname = 'Users can insert own base recipe ingredients') THEN
    CREATE POLICY "Users can insert own base recipe ingredients" ON product_base_recipe_ingredients FOR INSERT WITH CHECK (
      EXISTS (
        SELECT 1 FROM product_recipe_versions rv
        JOIN products p ON p.id = rv.product_id
        WHERE rv.id = product_base_recipe_ingredients.recipe_version_id AND p.user_id = auth.uid()
      )
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'product_base_recipe_ingredients' AND policyname = 'Users can update own base recipe ingredients') THEN
    CREATE POLICY "Users can update own base recipe ingredients" ON product_base_recipe_ingredients FOR UPDATE USING (
      EXISTS (
        SELECT 1 FROM product_recipe_versions rv
        JOIN products p ON p.id = rv.product_id
        WHERE rv.id = product_base_recipe_ingredients.recipe_version_id AND p.user_id = auth.uid()
      )
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'product_base_recipe_ingredients' AND policyname = 'Users can delete own base recipe ingredients') THEN
    CREATE POLICY "Users can delete own base recipe ingredients" ON product_base_recipe_ingredients FOR DELETE USING (
      EXISTS (
        SELECT 1 FROM product_recipe_versions rv
        JOIN products p ON p.id = rv.product_id
        WHERE rv.id = product_base_recipe_ingredients.recipe_version_id AND p.user_id = auth.uid()
      )
    );
  END IF;
END $$;

-- Triggers
DROP TRIGGER IF EXISTS base_recipe_ingredients_updated ON product_base_recipe_ingredients;
CREATE TRIGGER base_recipe_ingredients_updated
  BEFORE UPDATE ON product_base_recipe_ingredients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 6. Backfill recipe versions from first variety per product (if no versions exist)
INSERT INTO product_recipe_versions (product_id, version_number, name, notes, recipe_yield, is_current)
SELECT p.id, 1, 'Original Recipe', 'Migrated from existing variety recipe', 1, true
FROM products p
WHERE NOT EXISTS (
  SELECT 1 FROM product_recipe_versions rv WHERE rv.product_id = p.id
)
AND EXISTS (
  SELECT 1 FROM product_varieties pv
  JOIN product_variety_ingredients pvi ON pvi.product_variety_id = pv.id
  WHERE pv.product_id = p.id
);

INSERT INTO product_base_recipe_ingredients (
  recipe_version_id, ingredient_id, quantity_used, unit, scaling_mode, active_vendor_price_id, calculated_cost
)
SELECT DISTINCT ON (rv.id, pvi.ingredient_id)
  rv.id,
  pvi.ingredient_id,
  pvi.quantity_used / GREATEST(pv.base_recipe_factor, 1),
  pvi.unit,
  'proportional',
  pvi.active_vendor_price_id,
  pvi.calculated_cost
FROM product_recipe_versions rv
JOIN product_varieties pv ON pv.product_id = rv.product_id
JOIN product_variety_ingredients pvi ON pvi.product_variety_id = pv.id
WHERE rv.version_number = 1
  AND rv.name = 'Original Recipe'
  AND NOT EXISTS (
    SELECT 1 FROM product_base_recipe_ingredients bri WHERE bri.recipe_version_id = rv.id
  )
ORDER BY rv.id, pvi.ingredient_id, pv.created_at ASC;

UPDATE product_varieties SET has_manual_recipe_overrides = true WHERE has_manual_recipe_overrides = false;
