-- Add SKU column to productos table with auto-generated defaults

ALTER TABLE productos ADD COLUMN IF NOT EXISTS sku TEXT;

-- Set DEFAULT to auto-generate SKU for new rows
ALTER TABLE productos ALTER COLUMN sku SET DEFAULT upper(substring(gen_random_uuid()::text, 1, 8));

-- Populate existing rows without SKU
UPDATE productos SET sku = upper(substring(gen_random_uuid()::text, 1, 8)) WHERE sku IS NULL;

-- Add unique constraint
ALTER TABLE productos ADD CONSTRAINT productos_sku_unique UNIQUE (sku);
