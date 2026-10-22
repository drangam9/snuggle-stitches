CREATE TABLE products_new (
  id TEXT PRIMARY KEY NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  tag TEXT NOT NULL,
  short TEXT NOT NULL,
  description TEXT NOT NULL,
  alt TEXT NOT NULL,
  category TEXT NOT NULL CHECK (length(trim(category)) BETWEEN 1 AND 60),
  price_min_ron INTEGER NOT NULL CHECK (price_min_ron >= 0),
  price_max_ron INTEGER NOT NULL CHECK (price_max_ron >= price_min_ron),
  image_key TEXT,
  image_url TEXT,
  credit_author TEXT NOT NULL DEFAULT '',
  credit_url TEXT NOT NULL DEFAULT '',
  credit_license TEXT NOT NULL DEFAULT '',
  is_published INTEGER NOT NULL DEFAULT 0 CHECK (is_published IN (0, 1)),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (image_key IS NOT NULL OR image_url IS NOT NULL OR is_published = 0)
);

INSERT INTO products_new (
  id, slug, name, tag, short, description, alt, category, price_min_ron, price_max_ron,
  image_key, image_url, credit_author, credit_url, credit_license, is_published, sort_order,
  created_at, updated_at
)
SELECT
  id, slug, name, tag, short, description, alt,
  CASE category
    WHEN 'Animals' THEN 'Animăluțe'
    WHEN 'Seasonal' THEN 'De sezon'
    ELSE category
  END,
  price_min_ron, price_max_ron, image_key, image_url, credit_author, credit_url, credit_license,
  is_published, sort_order, created_at, updated_at
FROM products;

DROP TABLE products;
ALTER TABLE products_new RENAME TO products;
CREATE INDEX products_public_order ON products (is_published, sort_order, created_at);
