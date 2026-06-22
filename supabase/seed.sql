-- Sample seed data (run AFTER creating a user account)
-- Replace 'YOUR_USER_ID' with your actual auth.users id

-- Example: Get your user id with: SELECT id FROM auth.users WHERE email = 'your@email.com';

/*
INSERT INTO ingredients (user_id, name, unit, supplier, pack_size, pack_cost) VALUES
  ('YOUR_USER_ID', 'Unsalted Butter', 'g', 'Local Dairy', 500, 3.50),
  ('YOUR_USER_ID', 'Plain Flour', 'kg', 'Wholesale Foods', 1, 0.65),
  ('YOUR_USER_ID', 'Caster Sugar', 'kg', 'Wholesale Foods', 1, 0.89),
  ('YOUR_USER_ID', 'Free Range Eggs', 'unit', 'Farm Direct', 12, 3.60),
  ('YOUR_USER_ID', 'Vanilla Extract', 'ml', 'Baking Supplies Co', 100, 4.99),
  ('YOUR_USER_ID', 'Dark Chocolate', 'g', 'Cocoa Traders', 200, 2.80);

INSERT INTO products (user_id, name, description, buffer_percentage, units_per_batch, current_cost_price) VALUES
  ('YOUR_USER_ID', 'Chocolate Chip Cookies', 'Classic bakery cookies with dark chocolate chips', 5.00, 24, 0),
  ('YOUR_USER_ID', 'Victoria Sponge', 'Traditional two-layer sponge cake', 5.00, 1, 0),
  ('YOUR_USER_ID', 'Butter Shortbread', 'Scottish-style shortbread fingers', 5.00, 16, 0);

-- Link recipes (adjust ingredient/product IDs after insert)
-- INSERT INTO product_ingredients (product_id, ingredient_id, quantity_used) VALUES ...
*/
