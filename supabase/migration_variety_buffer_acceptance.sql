-- Per-variety buffer + acceptance snapshots for product costing

ALTER TABLE product_varieties
  ADD COLUMN IF NOT EXISTS buffer_percentage DECIMAL(5,2) NOT NULL DEFAULT 5.00;

CREATE TABLE IF NOT EXISTS product_variety_acceptances (
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

CREATE INDEX IF NOT EXISTS idx_pva_variety_accepted_at
  ON product_variety_acceptances(product_variety_id, accepted_at DESC);

ALTER TABLE product_variety_acceptances ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own variety acceptances" ON product_variety_acceptances;
DROP POLICY IF EXISTS "Users can insert own variety acceptances" ON product_variety_acceptances;

CREATE POLICY "Users can view own variety acceptances" ON product_variety_acceptances
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM product_varieties pv
      JOIN products p ON p.id = pv.product_id
      WHERE pv.id = product_variety_acceptances.product_variety_id AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own variety acceptances" ON product_variety_acceptances
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM product_varieties pv
      JOIN products p ON p.id = pv.product_id
      WHERE pv.id = product_variety_acceptances.product_variety_id AND p.user_id = auth.uid()
    )
    AND accepted_by = auth.uid()
  );

-- Backfill buffer from user settings
UPDATE product_varieties pv
SET buffer_percentage = COALESCE(
  (SELECT us.default_buffer_percentage FROM user_settings us
   JOIN products p ON p.user_id = us.user_id
   WHERE p.id = pv.product_id LIMIT 1),
  5.00
)
WHERE pv.buffer_percentage = 5.00;

-- Initial acceptance baselines for varieties with cost
INSERT INTO product_variety_acceptances (
  product_variety_id,
  accepted_cost_price,
  accepted_selling_price,
  accepted_margin_value,
  accepted_margin_percentage,
  buffer_percentage_at_time,
  accepted_by,
  accepted_reason_type
)
SELECT
  pv.id,
  pv.current_cost_price,
  pv.selling_price,
  pv.selling_price - pv.current_cost_price,
  CASE WHEN pv.selling_price > 0
    THEN ((pv.selling_price - pv.current_cost_price) / pv.selling_price) * 100
    ELSE 0 END,
  pv.buffer_percentage,
  p.user_id,
  'initial_baseline'
FROM product_varieties pv
JOIN products p ON p.id = pv.product_id
WHERE pv.current_cost_price > 0
  AND NOT EXISTS (
    SELECT 1 FROM product_variety_acceptances a WHERE a.product_variety_id = pv.id
  );
