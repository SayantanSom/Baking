-- Safe migration from v1 schema to v2
-- Prefer reset_database.sql if you do NOT need to keep existing data (simpler).
-- Use this file ONLY when you must preserve v1 data during upgrade.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- Step 1: Extend user_settings
-- =============================================================================
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS catalogue_title TEXT DEFAULT 'Product Catalogue';
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS business_name TEXT DEFAULT '';
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS footer_text TEXT DEFAULT '';
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS show_prices BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS show_descriptions BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS show_images BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS products_per_page INTEGER NOT NULL DEFAULT 4;

-- =============================================================================
-- Step 2: Create v2 tables (must exist BEFORE data migration inserts)
-- =============================================================================

CREATE TABLE IF NOT EXISTS ingredient_vendor_prices (
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

CREATE TABLE IF NOT EXISTS ingredient_price_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ingredient_id UUID NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
  vendor_price_id UUID REFERENCES ingredient_vendor_prices(id) ON DELETE SET NULL,
  previous_cost_per_base_unit DECIMAL(12,6) NOT NULL,
  new_cost_per_base_unit DECIMAL(12,6) NOT NULL,
  percentage_change DECIMAL(8,4) NOT NULL,
  buffer_percentage_at_time DECIMAL(5,2) NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('green', 'amber', 'red')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS product_varieties (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  variety_name TEXT NOT NULL,
  size_label TEXT,
  sku TEXT,
  selling_price DECIMAL(12,4) NOT NULL DEFAULT 0,
  recipe_yield INTEGER NOT NULL DEFAULT 1 CHECK (recipe_yield > 0),
  packaging_cost DECIMAL(12,4) NOT NULL DEFAULT 0,
  labour_cost DECIMAL(12,4) NOT NULL DEFAULT 0,
  current_cost_price DECIMAL(12,4) NOT NULL DEFAULT 0,
  suggested_selling_price DECIMAL(12,4),
  gross_margin DECIMAL(12,4) NOT NULL DEFAULT 0,
  is_catalogue_visible BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS product_variety_ingredients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_variety_id UUID NOT NULL REFERENCES product_varieties(id) ON DELETE CASCADE,
  ingredient_id UUID NOT NULL REFERENCES ingredients(id) ON DELETE RESTRICT,
  quantity_used DECIMAL(12,4) NOT NULL CHECK (quantity_used > 0),
  unit TEXT NOT NULL CHECK (unit IN ('g', 'kg', 'ml', 'l', 'unit')),
  active_vendor_price_id UUID REFERENCES ingredient_vendor_prices(id) ON DELETE SET NULL,
  calculated_cost DECIMAL(12,4) NOT NULL DEFAULT 0,
  UNIQUE (product_variety_id, ingredient_id)
);

CREATE TABLE IF NOT EXISTS product_variety_cost_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_variety_id UUID NOT NULL REFERENCES product_varieties(id) ON DELETE CASCADE,
  previous_cost_price DECIMAL(12,4) NOT NULL,
  new_cost_price DECIMAL(12,4) NOT NULL,
  percentage_change DECIMAL(8,4) NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('green', 'amber', 'red')),
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS catalogue_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
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
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes (IF NOT EXISTS)
CREATE INDEX IF NOT EXISTS idx_vendor_prices_ingredient_id ON ingredient_vendor_prices(ingredient_id);
CREATE INDEX IF NOT EXISTS idx_vendor_prices_active ON ingredient_vendor_prices(ingredient_id, is_active);
CREATE INDEX IF NOT EXISTS idx_ingredient_price_history_ingredient ON ingredient_price_history(ingredient_id);
CREATE INDEX IF NOT EXISTS idx_product_varieties_product_id ON product_varieties(product_id);
CREATE INDEX IF NOT EXISTS idx_product_varieties_sku ON product_varieties(sku);
CREATE INDEX IF NOT EXISTS idx_pvi_variety_id ON product_variety_ingredients(product_variety_id);
CREATE INDEX IF NOT EXISTS idx_pvi_ingredient_id ON product_variety_ingredients(ingredient_id);
CREATE INDEX IF NOT EXISTS idx_pvch_variety_id ON product_variety_cost_history(product_variety_id);
CREATE INDEX IF NOT EXISTS idx_catalogue_templates_user_id ON catalogue_templates(user_id);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);

-- RLS on new tables
ALTER TABLE ingredient_vendor_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingredient_price_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_varieties ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_variety_ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_variety_cost_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE catalogue_templates ENABLE ROW LEVEL SECURITY;

-- Policies (create only if missing)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ingredient_vendor_prices' AND policyname = 'Users can view own vendor prices') THEN
    CREATE POLICY "Users can view own vendor prices" ON ingredient_vendor_prices FOR SELECT USING (
      EXISTS (SELECT 1 FROM ingredients WHERE ingredients.id = ingredient_vendor_prices.ingredient_id AND ingredients.user_id = auth.uid())
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ingredient_vendor_prices' AND policyname = 'Users can insert own vendor prices') THEN
    CREATE POLICY "Users can insert own vendor prices" ON ingredient_vendor_prices FOR INSERT WITH CHECK (
      EXISTS (SELECT 1 FROM ingredients WHERE ingredients.id = ingredient_vendor_prices.ingredient_id AND ingredients.user_id = auth.uid())
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ingredient_vendor_prices' AND policyname = 'Users can update own vendor prices') THEN
    CREATE POLICY "Users can update own vendor prices" ON ingredient_vendor_prices FOR UPDATE USING (
      EXISTS (SELECT 1 FROM ingredients WHERE ingredients.id = ingredient_vendor_prices.ingredient_id AND ingredients.user_id = auth.uid())
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ingredient_vendor_prices' AND policyname = 'Users can delete own vendor prices') THEN
    CREATE POLICY "Users can delete own vendor prices" ON ingredient_vendor_prices FOR DELETE USING (
      EXISTS (SELECT 1 FROM ingredients WHERE ingredients.id = ingredient_vendor_prices.ingredient_id AND ingredients.user_id = auth.uid())
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ingredient_price_history' AND policyname = 'Users can view own ingredient price history') THEN
    CREATE POLICY "Users can view own ingredient price history" ON ingredient_price_history FOR SELECT USING (
      EXISTS (SELECT 1 FROM ingredients WHERE ingredients.id = ingredient_price_history.ingredient_id AND ingredients.user_id = auth.uid())
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ingredient_price_history' AND policyname = 'Users can insert own ingredient price history') THEN
    CREATE POLICY "Users can insert own ingredient price history" ON ingredient_price_history FOR INSERT WITH CHECK (
      EXISTS (SELECT 1 FROM ingredients WHERE ingredients.id = ingredient_price_history.ingredient_id AND ingredients.user_id = auth.uid())
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'product_varieties' AND policyname = 'Users can view own varieties') THEN
    CREATE POLICY "Users can view own varieties" ON product_varieties FOR SELECT USING (
      EXISTS (SELECT 1 FROM products WHERE products.id = product_varieties.product_id AND products.user_id = auth.uid())
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'product_varieties' AND policyname = 'Users can insert own varieties') THEN
    CREATE POLICY "Users can insert own varieties" ON product_varieties FOR INSERT WITH CHECK (
      EXISTS (SELECT 1 FROM products WHERE products.id = product_varieties.product_id AND products.user_id = auth.uid())
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'product_varieties' AND policyname = 'Users can update own varieties') THEN
    CREATE POLICY "Users can update own varieties" ON product_varieties FOR UPDATE USING (
      EXISTS (SELECT 1 FROM products WHERE products.id = product_varieties.product_id AND products.user_id = auth.uid())
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'product_varieties' AND policyname = 'Users can delete own varieties') THEN
    CREATE POLICY "Users can delete own varieties" ON product_varieties FOR DELETE USING (
      EXISTS (SELECT 1 FROM products WHERE products.id = product_varieties.product_id AND products.user_id = auth.uid())
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'product_variety_ingredients' AND policyname = 'Users can view own variety ingredients') THEN
    CREATE POLICY "Users can view own variety ingredients" ON product_variety_ingredients FOR SELECT USING (
      EXISTS (SELECT 1 FROM product_varieties pv JOIN products p ON p.id = pv.product_id
        WHERE pv.id = product_variety_ingredients.product_variety_id AND p.user_id = auth.uid())
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'product_variety_ingredients' AND policyname = 'Users can insert own variety ingredients') THEN
    CREATE POLICY "Users can insert own variety ingredients" ON product_variety_ingredients FOR INSERT WITH CHECK (
      EXISTS (SELECT 1 FROM product_varieties pv JOIN products p ON p.id = pv.product_id
        WHERE pv.id = product_variety_ingredients.product_variety_id AND p.user_id = auth.uid())
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'product_variety_ingredients' AND policyname = 'Users can update own variety ingredients') THEN
    CREATE POLICY "Users can update own variety ingredients" ON product_variety_ingredients FOR UPDATE USING (
      EXISTS (SELECT 1 FROM product_varieties pv JOIN products p ON p.id = pv.product_id
        WHERE pv.id = product_variety_ingredients.product_variety_id AND p.user_id = auth.uid())
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'product_variety_ingredients' AND policyname = 'Users can delete own variety ingredients') THEN
    CREATE POLICY "Users can delete own variety ingredients" ON product_variety_ingredients FOR DELETE USING (
      EXISTS (SELECT 1 FROM product_varieties pv JOIN products p ON p.id = pv.product_id
        WHERE pv.id = product_variety_ingredients.product_variety_id AND p.user_id = auth.uid())
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'product_variety_cost_history' AND policyname = 'Users can view own variety cost history') THEN
    CREATE POLICY "Users can view own variety cost history" ON product_variety_cost_history FOR SELECT USING (
      EXISTS (SELECT 1 FROM product_varieties pv JOIN products p ON p.id = pv.product_id
        WHERE pv.id = product_variety_cost_history.product_variety_id AND p.user_id = auth.uid())
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'product_variety_cost_history' AND policyname = 'Users can insert own variety cost history') THEN
    CREATE POLICY "Users can insert own variety cost history" ON product_variety_cost_history FOR INSERT WITH CHECK (
      EXISTS (SELECT 1 FROM product_varieties pv JOIN products p ON p.id = pv.product_id
        WHERE pv.id = product_variety_cost_history.product_variety_id AND p.user_id = auth.uid())
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'catalogue_templates' AND policyname = 'Users can view own catalogue templates') THEN
    CREATE POLICY "Users can view own catalogue templates" ON catalogue_templates FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'catalogue_templates' AND policyname = 'Users can insert own catalogue templates') THEN
    CREATE POLICY "Users can insert own catalogue templates" ON catalogue_templates FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'catalogue_templates' AND policyname = 'Users can update own catalogue templates') THEN
    CREATE POLICY "Users can update own catalogue templates" ON catalogue_templates FOR UPDATE USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'catalogue_templates' AND policyname = 'Users can delete own catalogue templates') THEN
    CREATE POLICY "Users can delete own catalogue templates" ON catalogue_templates FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;

-- =============================================================================
-- Step 3: Migrate ingredients (v1 pack columns → vendor prices)
-- =============================================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'ingredients' AND column_name = 'pack_size'
  ) THEN
    -- Rename unit → base_unit if still on v1 column name
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'ingredients' AND column_name = 'unit'
    ) AND NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'ingredients' AND column_name = 'base_unit'
    ) THEN
      ALTER TABLE ingredients RENAME COLUMN unit TO base_unit;
    END IF;

    ALTER TABLE ingredients ADD COLUMN IF NOT EXISTS default_buffer_percentage DECIMAL(5,2) DEFAULT 5.00;
    ALTER TABLE ingredients ADD COLUMN IF NOT EXISTS notes TEXT;
    ALTER TABLE ingredients ADD COLUMN IF NOT EXISTS active_vendor_price_id UUID;
    ALTER TABLE ingredients ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

    -- Migrate pack data into vendor prices
    INSERT INTO ingredient_vendor_prices (
      ingredient_id, vendor_name, pack_size, pack_unit, pack_cost,
      cost_per_base_unit, is_active, last_checked_at
    )
    SELECT
      i.id,
      COALESCE(i.supplier, 'Legacy supplier'),
      i.pack_size,
      COALESCE(i.base_unit, 'g'),
      i.pack_cost,
      CASE WHEN i.pack_size > 0 THEN i.pack_cost / i.pack_size ELSE 0 END,
      true,
      COALESCE(i.last_updated, NOW())
    FROM ingredients i
    WHERE i.pack_size IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM ingredient_vendor_prices ivp WHERE ivp.ingredient_id = i.id
      );

    UPDATE ingredients i
    SET active_vendor_price_id = (
      SELECT ivp.id FROM ingredient_vendor_prices ivp
      WHERE ivp.ingredient_id = i.id AND ivp.is_active = true
      ORDER BY ivp.created_at LIMIT 1
    )
    WHERE i.active_vendor_price_id IS NULL;

    -- Migrate supplier_prices if present
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'supplier_prices') THEN
      INSERT INTO ingredient_vendor_prices (
        ingredient_id, vendor_name, pack_size, pack_unit, pack_cost,
        cost_per_base_unit, is_active, product_url, last_checked_at
      )
      SELECT
        sp.ingredient_id,
        sp.retailer,
        sp.pack_size,
        COALESCE(i.base_unit, 'g'),
        sp.price,
        CASE WHEN sp.pack_size > 0 THEN sp.price / sp.pack_size ELSE 0 END,
        false,
        sp.product_url,
        sp.checked_at
      FROM supplier_prices sp
      JOIN ingredients i ON i.id = sp.ingredient_id
      WHERE NOT EXISTS (
        SELECT 1 FROM ingredient_vendor_prices ivp
        WHERE ivp.ingredient_id = sp.ingredient_id
          AND ivp.vendor_name = sp.retailer
          AND ivp.pack_size = sp.pack_size
      );
    END IF;

    -- Drop v1 ingredient columns
    ALTER TABLE ingredients DROP COLUMN IF EXISTS supplier;
    ALTER TABLE ingredients DROP COLUMN IF EXISTS pack_size;
    ALTER TABLE ingredients DROP COLUMN IF EXISTS pack_cost;
    ALTER TABLE ingredients DROP COLUMN IF EXISTS unit_cost;
    ALTER TABLE ingredients DROP COLUMN IF EXISTS last_updated;

    -- Drop old trigger if present
    DROP TRIGGER IF EXISTS ingredient_updated ON ingredients;
  END IF;
END $$;

-- FK from ingredients → active vendor (after vendor rows exist)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_ingredients_active_vendor_price'
  ) THEN
    ALTER TABLE ingredients
      ADD CONSTRAINT fk_ingredients_active_vendor_price
      FOREIGN KEY (active_vendor_price_id)
      REFERENCES ingredient_vendor_prices(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Ensure base_unit exists on ingredients already migrated or fresh v2 partial state
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'ingredients' AND column_name = 'base_unit'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'ingredients' AND column_name = 'unit'
  ) THEN
    ALTER TABLE ingredients RENAME COLUMN unit TO base_unit;
  END IF;
END $$;

-- =============================================================================
-- Step 4: Migrate products → varieties
-- =============================================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'buffer_percentage'
  ) THEN
    ALTER TABLE products ADD COLUMN IF NOT EXISTS category TEXT;
    ALTER TABLE products ADD COLUMN IF NOT EXISTS image_url TEXT;
    ALTER TABLE products ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

    INSERT INTO product_varieties (
      product_id, variety_name, size_label, selling_price, recipe_yield,
      packaging_cost, labour_cost, current_cost_price, gross_margin, is_catalogue_visible
    )
    SELECT
      p.id,
      'Default',
      'Standard',
      0,
      COALESCE(p.units_per_batch, 1),
      0,
      0,
      COALESCE(p.current_cost_price, 0),
      0,
      true
    FROM products p
    WHERE NOT EXISTS (
      SELECT 1 FROM product_varieties pv WHERE pv.product_id = p.id
    );

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'product_ingredients') THEN
      INSERT INTO product_variety_ingredients (
        product_variety_id, ingredient_id, quantity_used, unit, calculated_cost
      )
      SELECT
        pv.id,
        pi.ingredient_id,
        pi.quantity_used,
        COALESCE(i.base_unit, 'g'),
        pi.quantity_used * COALESCE(
          (SELECT ivp.cost_per_base_unit FROM ingredient_vendor_prices ivp
           WHERE ivp.id = i.active_vendor_price_id),
          0
        )
      FROM product_ingredients pi
      JOIN product_varieties pv ON pv.product_id = pi.product_id AND pv.variety_name = 'Default'
      JOIN ingredients i ON i.id = pi.ingredient_id
      WHERE NOT EXISTS (
        SELECT 1 FROM product_variety_ingredients pvi
        WHERE pvi.product_variety_id = pv.id AND pvi.ingredient_id = pi.ingredient_id
      );

      UPDATE ingredients i
      SET default_buffer_percentage = sub.buffer_percentage
      FROM (
        SELECT DISTINCT ON (pi.ingredient_id) pi.ingredient_id, p.buffer_percentage
        FROM product_ingredients pi
        JOIN products p ON p.id = pi.product_id
        ORDER BY pi.ingredient_id, p.created_at
      ) sub
      WHERE i.id = sub.ingredient_id;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'cost_history') THEN
      INSERT INTO product_variety_cost_history (
        product_variety_id, previous_cost_price, new_cost_price,
        percentage_change, status, reason, created_at
      )
      SELECT
        pv.id,
        ch.previous_cost,
        ch.new_cost,
        ch.percentage_change,
        ch.status,
        'Migrated from v1 cost history',
        ch.created_at
      FROM cost_history ch
      JOIN product_varieties pv ON pv.product_id = ch.product_id AND pv.variety_name = 'Default'
      WHERE NOT EXISTS (
        SELECT 1 FROM product_variety_cost_history pvch
        WHERE pvch.product_variety_id = pv.id
          AND pvch.created_at = ch.created_at
      );
    END IF;

    ALTER TABLE products DROP COLUMN IF EXISTS buffer_percentage;
    ALTER TABLE products DROP COLUMN IF EXISTS units_per_batch;
    ALTER TABLE products DROP COLUMN IF EXISTS current_cost_price;
  END IF;
END $$;

-- Optional: drop legacy tables after verifying migration
-- DROP TABLE IF EXISTS product_ingredients CASCADE;
-- DROP TABLE IF EXISTS cost_history CASCADE;
-- DROP TABLE IF EXISTS supplier_prices CASCADE;
