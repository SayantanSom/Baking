-- Sample seed data for Product Cost Manager v2
-- Replace YOUR_USER_ID with your auth.users id before running

-- Example: use after signup
-- SELECT id FROM auth.users LIMIT 1;

/*
DO $$
DECLARE
  uid UUID := 'YOUR_USER_ID';
  ing_flour UUID;
  ing_sugar UUID;
  ing_butter UUID;
  ing_cream UUID;
  ing_biscuit UUID;
  ing_eggs UUID;
  ing_vanilla UUID;
  ing_choc UUID;
  vp_flour_tesco UUID;
  vp_flour_aldi UUID;
  vp_flour_amazon UUID;
  vp_butter_tesco UUID;
  vp_butter_sains UUID;
  vp_butter_wholesale UUID;
  vp_cream_tesco UUID;
  vp_cream_aldi UUID;
  vp_cream_amazon UUID;
  prod_cheese UUID;
  prod_choc UUID;
  prod_sponge UUID;
  var_8_cheese UUID;
  var_10_cheese UUID;
  var_8_choc UUID;
  var_10_choc UUID;
  var_cupcake UUID;
BEGIN
  -- Ingredients
  INSERT INTO ingredients (id, user_id, name, base_unit, default_buffer_percentage, notes)
  VALUES (uuid_generate_v4(), uid, 'Flour', 'g', 5, 'Plain flour') RETURNING id INTO ing_flour;
  INSERT INTO ingredients (user_id, name, base_unit, default_buffer_percentage) VALUES (uid, 'Sugar', 'g', 5) RETURNING id INTO ing_sugar;
  INSERT INTO ingredients (user_id, name, base_unit, default_buffer_percentage) VALUES (uid, 'Butter', 'g', 8) RETURNING id INTO ing_butter;
  INSERT INTO ingredients (user_id, name, base_unit, default_buffer_percentage) VALUES (uid, 'Cream Cheese', 'g', 8) RETURNING id INTO ing_cream;
  INSERT INTO ingredients (user_id, name, base_unit, default_buffer_percentage) VALUES (uid, 'Digestive Biscuits', 'g', 5) RETURNING id INTO ing_biscuit;
  INSERT INTO ingredients (user_id, name, base_unit, default_buffer_percentage) VALUES (uid, 'Eggs', 'unit', 5) RETURNING id INTO ing_eggs;
  INSERT INTO ingredients (user_id, name, base_unit, default_buffer_percentage) VALUES (uid, 'Vanilla', 'ml', 5) RETURNING id INTO ing_vanilla;
  INSERT INTO ingredients (user_id, name, base_unit, default_buffer_percentage) VALUES (uid, 'Chocolate', 'g', 12) RETURNING id INTO ing_choc;

  -- Flour vendor prices (500g @ £1.20, 2kg @ £3.20, 1kg Amazon @ £2.10)
  INSERT INTO ingredient_vendor_prices (ingredient_id, vendor_name, pack_size, pack_unit, pack_cost, cost_per_base_unit, is_active)
  VALUES (ing_flour, 'Tesco', 500, 'g', 1.20, 0.0024, true) RETURNING id INTO vp_flour_tesco;
  INSERT INTO ingredient_vendor_prices (ingredient_id, vendor_name, pack_size, pack_unit, pack_cost, cost_per_base_unit, is_active)
  VALUES (ing_flour, 'Aldi', 2000, 'kg', 3.20, 0.0016, false) RETURNING id INTO vp_flour_aldi;
  INSERT INTO ingredient_vendor_prices (ingredient_id, vendor_name, pack_size, pack_unit, pack_cost, cost_per_base_unit, is_active)
  VALUES (ing_flour, 'Amazon', 1000, 'g', 2.10, 0.0021, false) RETURNING id INTO vp_flour_amazon;
  UPDATE ingredients SET active_vendor_price_id = vp_flour_tesco WHERE id = ing_flour;

  -- Butter vendor prices
  INSERT INTO ingredient_vendor_prices (ingredient_id, vendor_name, pack_size, pack_unit, pack_cost, cost_per_base_unit, is_active)
  VALUES (ing_butter, 'Tesco', 250, 'g', 2.50, 0.01, true) RETURNING id INTO vp_butter_tesco;
  INSERT INTO ingredient_vendor_prices (ingredient_id, vendor_name, pack_size, pack_unit, pack_cost, cost_per_base_unit, is_active)
  VALUES (ing_butter, 'Sainsbury''s', 500, 'g', 4.50, 0.009, false);
  INSERT INTO ingredient_vendor_prices (ingredient_id, vendor_name, pack_size, pack_unit, pack_cost, cost_per_base_unit, is_active)
  VALUES (ing_butter, 'Wholesale supplier', 2000, 'g', 14.00, 0.007, false);
  UPDATE ingredients SET active_vendor_price_id = vp_butter_tesco WHERE id = ing_butter;

  -- Cream cheese vendor prices
  INSERT INTO ingredient_vendor_prices (ingredient_id, vendor_name, pack_size, pack_unit, pack_cost, cost_per_base_unit, is_active)
  VALUES (ing_cream, 'Tesco', 300, 'g', 2.80, 0.00933, true) RETURNING id INTO vp_cream_tesco;
  INSERT INTO ingredient_vendor_prices (ingredient_id, vendor_name, pack_size, pack_unit, pack_cost, cost_per_base_unit, is_active)
  VALUES (ing_cream, 'Aldi', 200, 'g', 1.75, 0.00875, false);
  INSERT INTO ingredient_vendor_prices (ingredient_id, vendor_name, pack_size, pack_unit, pack_cost, cost_per_base_unit, is_active)
  VALUES (ing_cream, 'Amazon', 500, 'g', 4.25, 0.0085, false);
  UPDATE ingredients SET active_vendor_price_id = vp_cream_tesco WHERE id = ing_cream;

  -- Products
  INSERT INTO products (user_id, name, description, category) VALUES (uid, 'Cheese Cake', 'Classic baked cheesecake', 'Cakes') RETURNING id INTO prod_cheese;
  INSERT INTO products (user_id, name, description, category) VALUES (uid, 'Chocolate Cake', 'Rich chocolate layer cake', 'Cakes') RETURNING id INTO prod_choc;
  INSERT INTO products (user_id, name, description, category) VALUES (uid, 'Sponge Cake', 'Light vanilla sponge', 'Cakes') RETURNING id INTO prod_sponge;

  -- Varieties
  INSERT INTO product_varieties (product_id, variety_name, size_label, sku, selling_price, packaging_cost, labour_cost)
  VALUES (prod_cheese, '8 inch', '8 inch', 'CC-8', 24.99, 1.50, 3.00) RETURNING id INTO var_8_cheese;
  INSERT INTO product_varieties (product_id, variety_name, size_label, sku, selling_price, packaging_cost, labour_cost)
  VALUES (prod_cheese, '10 inch', '10 inch', 'CC-10', 34.99, 2.00, 4.00) RETURNING id INTO var_10_cheese;
  INSERT INTO product_varieties (product_id, variety_name, size_label, sku, selling_price, packaging_cost, labour_cost)
  VALUES (prod_choc, '8 inch', '8 inch', 'CHC-8', 22.99, 1.50, 2.50) RETURNING id INTO var_8_choc;
  INSERT INTO product_varieties (product_id, variety_name, size_label, sku, selling_price, packaging_cost, labour_cost)
  VALUES (prod_choc, '10 inch', '10 inch', 'CHC-10', 32.99, 2.00, 3.50) RETURNING id INTO var_10_choc;
  INSERT INTO product_varieties (product_id, variety_name, size_label, sku, selling_price, packaging_cost, labour_cost)
  VALUES (prod_sponge, '12 Cupcake Box', '12 Cupcake Box', 'SP-12C', 18.99, 2.50, 2.00) RETURNING id INTO var_cupcake;

  -- 8 inch Cheese Cake recipe
  INSERT INTO product_variety_ingredients (product_variety_id, ingredient_id, quantity_used, unit, active_vendor_price_id)
  VALUES (var_8_cheese, ing_cream, 500, 'g', vp_cream_tesco);
  INSERT INTO product_variety_ingredients (product_variety_id, ingredient_id, quantity_used, unit)
  VALUES (var_8_cheese, ing_biscuit, 200, 'g');
  INSERT INTO product_variety_ingredients (product_variety_id, ingredient_id, quantity_used, unit, active_vendor_price_id)
  VALUES (var_8_cheese, ing_butter, 100, 'g', vp_butter_tesco);

  -- 10 inch Cheese Cake recipe
  INSERT INTO product_variety_ingredients (product_variety_id, ingredient_id, quantity_used, unit, active_vendor_price_id)
  VALUES (var_10_cheese, ing_cream, 750, 'g', vp_cream_tesco);
  INSERT INTO product_variety_ingredients (product_variety_id, ingredient_id, quantity_used, unit)
  VALUES (var_10_cheese, ing_biscuit, 300, 'g');
  INSERT INTO product_variety_ingredients (product_variety_id, ingredient_id, quantity_used, unit, active_vendor_price_id)
  VALUES (var_10_cheese, ing_butter, 150, 'g', vp_butter_tesco);
END $$;
*/

-- TypeScript seed helper: see src/services/seedData.ts for programmatic seeding via app
