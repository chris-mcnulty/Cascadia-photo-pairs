-- Social publisher tables: connected IG/FB accounts, queued posts, CSV imports, click tracking.
CREATE TABLE IF NOT EXISTS social_accounts (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  platform varchar NOT NULL,
  display_name varchar NOT NULL,
  external_id varchar NOT NULL,
  page_id varchar,
  token_secret_key varchar NOT NULL,
  token_last_four varchar,
  token_expires_at timestamp,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_social_accounts_platform ON social_accounts(platform);
CREATE INDEX IF NOT EXISTS idx_social_accounts_active ON social_accounts(is_active);

CREATE TABLE IF NOT EXISTS social_csv_imports (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  filename varchar NOT NULL,
  campaign_name varchar,
  row_count integer NOT NULL DEFAULT 0,
  success_count integer NOT NULL DEFAULT 0,
  failed_count integer NOT NULL DEFAULT 0,
  status varchar NOT NULL DEFAULT 'pending',
  created_by varchar REFERENCES users(id),
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS social_posts (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id varchar NOT NULL REFERENCES social_accounts(id),
  platform varchar NOT NULL,
  caption text NOT NULL,
  media_urls text[] NOT NULL DEFAULT ARRAY[]::text[],
  link_url text,
  tracked_slug varchar UNIQUE,
  utm_campaign varchar,
  first_comment text,
  scheduled_at timestamp NOT NULL,
  status varchar NOT NULL DEFAULT 'scheduled',
  external_post_id varchar,
  external_permalink text,
  error_message text,
  attempt_count integer NOT NULL DEFAULT 0,
  next_retry_at timestamp,
  posted_at timestamp,
  click_count integer NOT NULL DEFAULT 0,
  csv_import_id varchar REFERENCES social_csv_imports(id),
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_social_posts_status ON social_posts(status);
CREATE INDEX IF NOT EXISTS idx_social_posts_scheduled ON social_posts(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_social_posts_account ON social_posts(account_id);
CREATE INDEX IF NOT EXISTS idx_social_posts_csv ON social_posts(csv_import_id);
CREATE INDEX IF NOT EXISTS idx_social_posts_tracked_slug ON social_posts(tracked_slug);
CREATE INDEX IF NOT EXISTS idx_social_posts_account_external ON social_posts(account_id, external_post_id);

CREATE TABLE IF NOT EXISTS social_clicks (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id varchar NOT NULL REFERENCES social_posts(id),
  clicked_at timestamp NOT NULL DEFAULT now(),
  user_agent text,
  referer text,
  ip_hash varchar
);
CREATE INDEX IF NOT EXISTS idx_social_clicks_post ON social_clicks(post_id);
CREATE INDEX IF NOT EXISTS idx_social_clicks_at ON social_clicks(clicked_at);

-- Encrypted token storage + de-dup index (added later in development)
ALTER TABLE social_accounts ALTER COLUMN token_secret_key DROP NOT NULL;
ALTER TABLE social_accounts ADD COLUMN IF NOT EXISTS access_token_encrypted text;
DROP INDEX IF EXISTS uniq_social_posts_account_external_post;
CREATE UNIQUE INDEX IF NOT EXISTS uniq_social_posts_account_external_post
  ON social_posts(account_id, external_post_id) WHERE external_post_id IS NOT NULL;
