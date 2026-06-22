-- Product Cost Manager - Supabase Schema
-- Run this in the Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- User settings
CREATE TABLE user_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  default_buffer_percentage DECIMAL(5,2) NOT NULL DEFAULT 5.00,
  currency TEXT NOT NULL DEFAULT '£',
  tax_percentage DECIMAL(5,2) NOT NULL DEFAULT 20.00,
  labour_cost_percentage DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  packaging_cost_percentage DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ingredients
CREATE TABLE ingredients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  unit TEXT NOT NULL CHECK (unit IN ('g', 'kg', 'ml', 'l', 'unit')),
  supplier TEXT,
  pack_size DECIMAL(12,4) NOT NULL CHECK (pack_size > 0),
  pack_cost DECIMAL(12,4) NOT NULL CHECK (pack_cost >= 0),
  unit_cost DECIMAL(12,6) GENERATED ALWAYS AS (pack_cost / pack_size) STORED,
  last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Products
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  buffer_percentage DECIMAL(5,2) NOT NULL DEFAULT 5.00,
  units_per_batch INTEGER NOT NULL DEFAULT 1 CHECK (units_per_batch > 0),
  current_cost_price DECIMAL(12,4) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Product ingredients (recipe)
CREATE TABLE product_ingredients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  ingredient_id UUID NOT NULL REFERENCES ingredients(id) ON DELETE RESTRICT,
  quantity_used DECIMAL(12,4) NOT NULL CHECK (quantity_used > 0),
  UNIQUE (product_id, ingredient_id)
);

-- Cost history
CREATE TABLE cost_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  previous_cost DECIMAL(12,4) NOT NULL,
  new_cost DECIMAL(12,4) NOT NULL,
  percentage_change DECIMAL(8,4) NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('green', 'amber', 'red')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Supplier prices
CREATE TABLE supplier_prices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ingredient_id UUID NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
  retailer TEXT NOT NULL,
  price DECIMAL(12,4) NOT NULL CHECK (price >= 0),
  pack_size DECIMAL(12,4) NOT NULL CHECK (pack_size > 0),
  product_url TEXT,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_ingredients_user_id ON ingredients(user_id);
CREATE INDEX idx_ingredients_name ON ingredients(name);
CREATE INDEX idx_products_user_id ON products(user_id);
CREATE INDEX idx_products_name ON products(name);
CREATE INDEX idx_product_ingredients_product_id ON product_ingredients(product_id);
CREATE INDEX idx_product_ingredients_ingredient_id ON product_ingredients(ingredient_id);
CREATE INDEX idx_cost_history_product_id ON cost_history(product_id);
CREATE INDEX idx_cost_history_created_at ON cost_history(created_at DESC);
CREATE INDEX idx_supplier_prices_ingredient_id ON supplier_prices(ingredient_id);

-- Row Level Security
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE cost_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_prices ENABLE ROW LEVEL SECURITY;

-- User settings policies
CREATE POLICY "Users can view own settings" ON user_settings
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own settings" ON user_settings
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own settings" ON user_settings
  FOR UPDATE USING (auth.uid() = user_id);

-- Ingredients policies
CREATE POLICY "Users can view own ingredients" ON ingredients
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own ingredients" ON ingredients
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own ingredients" ON ingredients
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own ingredients" ON ingredients
  FOR DELETE USING (auth.uid() = user_id);

-- Products policies
CREATE POLICY "Users can view own products" ON products
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own products" ON products
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own products" ON products
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own products" ON products
  FOR DELETE USING (auth.uid() = user_id);

-- Product ingredients policies (via product ownership)
CREATE POLICY "Users can view own product ingredients" ON product_ingredients
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM products WHERE products.id = product_ingredients.product_id AND products.user_id = auth.uid())
  );
CREATE POLICY "Users can insert own product ingredients" ON product_ingredients
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM products WHERE products.id = product_ingredients.product_id AND products.user_id = auth.uid())
  );
CREATE POLICY "Users can update own product ingredients" ON product_ingredients
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM products WHERE products.id = product_ingredients.product_id AND products.user_id = auth.uid())
  );
CREATE POLICY "Users can delete own product ingredients" ON product_ingredients
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM products WHERE products.id = product_ingredients.product_id AND products.user_id = auth.uid())
  );

-- Cost history policies
CREATE POLICY "Users can view own cost history" ON cost_history
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM products WHERE products.id = cost_history.product_id AND products.user_id = auth.uid())
  );
CREATE POLICY "Users can insert own cost history" ON cost_history
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM products WHERE products.id = cost_history.product_id AND products.user_id = auth.uid())
  );

-- Supplier prices policies (via ingredient ownership)
CREATE POLICY "Users can view own supplier prices" ON supplier_prices
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM ingredients WHERE ingredients.id = supplier_prices.ingredient_id AND ingredients.user_id = auth.uid())
  );
CREATE POLICY "Users can insert own supplier prices" ON supplier_prices
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM ingredients WHERE ingredients.id = supplier_prices.ingredient_id AND ingredients.user_id = auth.uid())
  );
CREATE POLICY "Users can update own supplier prices" ON supplier_prices
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM ingredients WHERE ingredients.id = supplier_prices.ingredient_id AND ingredients.user_id = auth.uid())
  );
CREATE POLICY "Users can delete own supplier prices" ON supplier_prices
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM ingredients WHERE ingredients.id = supplier_prices.ingredient_id AND ingredients.user_id = auth.uid())
  );

-- Function to create default settings on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_settings (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Allow auth service to run the signup trigger
GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO supabase_auth_admin;
GRANT ALL ON TABLE public.user_settings TO supabase_auth_admin;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Function to update ingredient last_updated
CREATE OR REPLACE FUNCTION update_ingredient_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.last_updated = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ingredient_updated
  BEFORE UPDATE ON ingredients
  FOR EACH ROW
  WHEN (OLD.pack_cost IS DISTINCT FROM NEW.pack_cost OR OLD.pack_size IS DISTINCT FROM NEW.pack_size)
  EXECUTE FUNCTION update_ingredient_timestamp();
