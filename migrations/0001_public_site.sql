-- Public-site migration for chrismcnulty.net (T001).
-- Captures the schema additions made directly in the DB on 2026-05-02.
-- Idempotent — safe to re-run. Authoritative source is shared/schema.ts.

-- collections: public-site fields (matches shared/schema.ts)
ALTER TABLE collections ADD COLUMN IF NOT EXISTS slug VARCHAR;
ALTER TABLE collections ADD COLUMN IF NOT EXISTS hero_image_url TEXT;
ALTER TABLE collections ADD COLUMN IF NOT EXISTS display_order INTEGER NOT NULL DEFAULT 0;
ALTER TABLE collections ADD COLUMN IF NOT EXISTS show_on_portfolio BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE collections ADD COLUMN IF NOT EXISTS show_on_store BOOLEAN NOT NULL DEFAULT true;
CREATE UNIQUE INDEX IF NOT EXISTS collections_slug_key ON collections (slug);

-- products: public-site fields (matches shared/schema.ts)
ALTER TABLE products ADD COLUMN IF NOT EXISTS slug VARCHAR;
ALTER TABLE products ADD COLUMN IF NOT EXISTS badge VARCHAR;
ALTER TABLE products ADD COLUMN IF NOT EXISTS hero_image_url TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS collection_id VARCHAR REFERENCES collections(id);
ALTER TABLE products ADD COLUMN IF NOT EXISTS show_on_store BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE products ADD COLUMN IF NOT EXISTS base_price_cents INTEGER;
CREATE UNIQUE INDEX IF NOT EXISTS products_slug_key ON products (slug);
CREATE INDEX IF NOT EXISTS idx_products_collection ON products (collection_id);
CREATE INDEX IF NOT EXISTS idx_products_slug ON products (slug);

-- news_items: ALTER existing tables, or CREATE if absent. Authoritative
-- shape lives in shared/schema.ts; this captures the columns the public
-- API and seeder require.
ALTER TABLE IF EXISTS news_items ADD COLUMN IF NOT EXISTS slug VARCHAR;
ALTER TABLE IF EXISTS news_items ADD COLUMN IF NOT EXISTS body TEXT;
ALTER TABLE IF EXISTS news_items ADD COLUMN IF NOT EXISTS category VARCHAR;
ALTER TABLE IF EXISTS news_items ADD COLUMN IF NOT EXISTS author VARCHAR;
ALTER TABLE IF EXISTS news_items ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE IF EXISTS news_items ADD COLUMN IF NOT EXISTS publish_date TIMESTAMP;
ALTER TABLE IF EXISTS news_items ADD COLUMN IF NOT EXISTS link TEXT;
ALTER TABLE IF EXISTS news_items ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE IF EXISTS news_items ADD COLUMN IF NOT EXISTS display_order INTEGER NOT NULL DEFAULT 0;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='news_items') THEN
    BEGIN
      CREATE UNIQUE INDEX IF NOT EXISTS news_items_slug_key ON news_items (slug);
    EXCEPTION WHEN others THEN NULL; END;
  END IF;
END $$;
CREATE TABLE IF NOT EXISTS news_items (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  slug VARCHAR UNIQUE,
  title VARCHAR NOT NULL,
  description TEXT,
  body TEXT,
  category VARCHAR,
  author VARCHAR,
  image_url TEXT,
  publish_date TIMESTAMP,
  link TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_news_items_publish_date ON news_items (publish_date DESC);
CREATE INDEX IF NOT EXISTS idx_news_items_active ON news_items (is_active);

-- events table (calendar)
CREATE TABLE IF NOT EXISTS events (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR NOT NULL,
  slug VARCHAR UNIQUE,
  description TEXT,
  location VARCHAR,
  venue_address TEXT,
  start_date TIMESTAMP NOT NULL,
  end_date TIMESTAMP,
  image_url TEXT,
  cta_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_events_start_date ON events (start_date);
CREATE INDEX IF NOT EXISTS idx_events_active ON events (is_active);

-- orders.order_number must be unique for Stripe-driven idempotency
-- (success-page confirm + webhook both use checkout session id as order_number).
CREATE UNIQUE INDEX IF NOT EXISTS orders_order_number_key ON orders (order_number);
