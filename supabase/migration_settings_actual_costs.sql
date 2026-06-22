-- Labour and packaging settings are fixed amounts, not percentages
-- Safe to re-run: handles DBs that still have *_percentage columns or already use default_* names

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'user_settings'
      AND column_name = 'labour_cost_percentage'
  ) THEN
    ALTER TABLE user_settings
      RENAME COLUMN labour_cost_percentage TO default_labour_cost;
  ELSIF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'user_settings'
      AND column_name = 'default_labour_cost'
  ) THEN
    ALTER TABLE user_settings
      ADD COLUMN default_labour_cost DECIMAL(12,4) NOT NULL DEFAULT 0;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'user_settings'
      AND column_name = 'packaging_cost_percentage'
  ) THEN
    ALTER TABLE user_settings
      RENAME COLUMN packaging_cost_percentage TO default_packaging_cost;
  ELSIF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'user_settings'
      AND column_name = 'default_packaging_cost'
  ) THEN
    ALTER TABLE user_settings
      ADD COLUMN default_packaging_cost DECIMAL(12,4) NOT NULL DEFAULT 0;
  END IF;
END $$;

ALTER TABLE user_settings
  ALTER COLUMN default_labour_cost TYPE DECIMAL(12,4);

ALTER TABLE user_settings
  ALTER COLUMN default_packaging_cost TYPE DECIMAL(12,4);
