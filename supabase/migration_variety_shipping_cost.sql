-- Add shipping as a production overhead on product varieties
ALTER TABLE product_varieties
  ADD COLUMN IF NOT EXISTS shipping_cost DECIMAL(12,4) NOT NULL DEFAULT 0;
