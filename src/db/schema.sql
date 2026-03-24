CREATE TABLE IF NOT EXISTS brands (
  id SERIAL PRIMARY KEY,
  name VARCHAR(120) NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS products (
  id SERIAL PRIMARY KEY,
  brand_id INTEGER NOT NULL REFERENCES brands(id) ON DELETE RESTRICT,
  brand_name VARCHAR(120) NOT NULL,
  type_name VARCHAR(120) NOT NULL,
  name VARCHAR(120) NOT NULL,
  size VARCHAR(60) NOT NULL,
  pattern VARCHAR(120) NOT NULL,
  qty INTEGER NOT NULL CHECK (qty >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE products ADD COLUMN IF NOT EXISTS brand_name VARCHAR(120);
ALTER TABLE products ADD COLUMN IF NOT EXISTS type_name VARCHAR(120);
ALTER TABLE products ADD COLUMN IF NOT EXISTS brand_id INTEGER;

UPDATE products
SET
  brand_name = COALESCE(NULLIF(brand_name, ''), split_part(name, ' ', 1)),
  type_name = COALESCE(
    NULLIF(type_name, ''),
    CASE
      WHEN POSITION(' ' IN name) > 0 THEN SUBSTRING(name FROM POSITION(' ' IN name) + 1)
      ELSE pattern
    END
  )
WHERE brand_name IS NULL OR type_name IS NULL OR brand_name = '' OR type_name = '';

INSERT INTO brands (name)
SELECT DISTINCT brand_name
FROM products
WHERE brand_name IS NOT NULL AND brand_name <> ''
ON CONFLICT (name) DO NOTHING;

UPDATE products p
SET brand_id = b.id
FROM brands b
WHERE p.brand_id IS NULL AND p.brand_name = b.name;

ALTER TABLE products ALTER COLUMN brand_name SET NOT NULL;
ALTER TABLE products ALTER COLUMN type_name SET NOT NULL;
ALTER TABLE products ALTER COLUMN brand_id SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'products_brand_id_fkey'
      AND table_name = 'products'
  ) THEN
    ALTER TABLE products
    ADD CONSTRAINT products_brand_id_fkey
    FOREIGN KEY (brand_id) REFERENCES brands(id) ON DELETE RESTRICT;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS shipments (
  id SERIAL PRIMARY KEY,
  container_number VARCHAR(80) NOT NULL UNIQUE,
  etd TIMESTAMPTZ NOT NULL,
  eta TIMESTAMPTZ NOT NULL,
  forwarder VARCHAR(120) NOT NULL,
  supplier VARCHAR(120) NOT NULL,
  status VARCHAR(40) NOT NULL CHECK (status IN ('ordered', 'on_delivery', 'arrived', 'done')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_name = 'shipments'
      AND constraint_name = 'shipments_status_check'
  ) THEN
    ALTER TABLE shipments DROP CONSTRAINT shipments_status_check;
  END IF;
END $$;

UPDATE shipments
SET status = CASE
  WHEN status = 'in_transit' THEN 'on_delivery'
  WHEN status = 'arrived_unorganized' THEN 'arrived'
  WHEN status = 'ready' THEN 'done'
  ELSE status
END;

ALTER TABLE shipments
ADD CONSTRAINT shipments_status_check
CHECK (status IN ('ordered', 'on_delivery', 'arrived', 'done'));

CREATE TABLE IF NOT EXISTS shipment_items (
  id SERIAL PRIMARY KEY,
  shipment_id INTEGER NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  qty INTEGER NOT NULL CHECK (qty > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(80) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(30) NOT NULL CHECK (role IN ('superadmin', 'admin', 'staff')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_products_brand_id ON products(brand_id);
CREATE INDEX IF NOT EXISTS idx_shipments_status ON shipments(status);
CREATE INDEX IF NOT EXISTS idx_shipment_items_shipment_id ON shipment_items(shipment_id);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
