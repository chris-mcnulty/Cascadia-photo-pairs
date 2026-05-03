-- Unified web traffic reporting
-- Self-hosted page-view logging, sliding 30-min sessions, daily-rotated
-- visitor-hash salts, and funnel/engagement events. Adds session linkage
-- columns to votes/pair_votes so voting metrics can be derived from real
-- vote rows joined to analytics sessions (no separate client beacon).

CREATE TABLE IF NOT EXISTS "page_views" (
  "id"           varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "session_id"   varchar NOT NULL,
  "visitor_hash" varchar NOT NULL,
  "path"         text    NOT NULL,
  "referrer"     text,
  "utm_source"   text,
  "utm_medium"   text,
  "utm_campaign" text,
  "device"       text,
  "browser"      text,
  "country"      text,
  "is_bot"       boolean NOT NULL DEFAULT false,
  "user_id"      varchar REFERENCES "users"("id"),
  "created_at"   timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "idx_page_views_session" ON "page_views" ("session_id");
CREATE INDEX IF NOT EXISTS "idx_page_views_path"    ON "page_views" ("path");
CREATE INDEX IF NOT EXISTS "idx_page_views_created" ON "page_views" ("created_at");

CREATE TABLE IF NOT EXISTS "traffic_events" (
  "id"         varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "session_id" varchar NOT NULL,
  "event_type" text    NOT NULL,
  "path"       text,
  "metadata"   jsonb,
  "user_id"    varchar REFERENCES "users"("id"),
  "created_at" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "idx_traffic_events_session" ON "traffic_events" ("session_id");
CREATE INDEX IF NOT EXISTS "idx_traffic_events_type"    ON "traffic_events" ("event_type");
CREATE INDEX IF NOT EXISTS "idx_traffic_events_created" ON "traffic_events" ("created_at");

CREATE TABLE IF NOT EXISTS "traffic_sessions" (
  "id"              varchar PRIMARY KEY,
  "visitor_hash"    varchar NOT NULL,
  "first_seen_at"   timestamp NOT NULL DEFAULT now(),
  "last_seen_at"    timestamp NOT NULL DEFAULT now(),
  "page_view_count" integer   NOT NULL DEFAULT 0,
  "entry_path"      text,
  "referrer"        text,
  "utm_source"      text,
  "utm_medium"      text,
  "utm_campaign"    text,
  "device"          text,
  "browser"         text,
  "country"         text,
  "is_bot"          boolean   NOT NULL DEFAULT false
);
CREATE INDEX IF NOT EXISTS "idx_traffic_sessions_visitor"    ON "traffic_sessions" ("visitor_hash");
CREATE INDEX IF NOT EXISTS "idx_traffic_sessions_last_seen"  ON "traffic_sessions" ("last_seen_at");
CREATE INDEX IF NOT EXISTS "idx_traffic_sessions_first_seen" ON "traffic_sessions" ("first_seen_at");

CREATE TABLE IF NOT EXISTS "daily_traffic_salts" (
  "day"        varchar PRIMARY KEY,
  "salt"       text    NOT NULL,
  "created_at" timestamp NOT NULL DEFAULT now()
);

ALTER TABLE "votes"      ADD COLUMN IF NOT EXISTS "session_id"   varchar;
ALTER TABLE "votes"      ADD COLUMN IF NOT EXISTS "visitor_hash" varchar;
ALTER TABLE "votes"      ADD COLUMN IF NOT EXISTS "is_bot"       boolean NOT NULL DEFAULT false;

ALTER TABLE "pair_votes" ADD COLUMN IF NOT EXISTS "session_id"   varchar;
ALTER TABLE "pair_votes" ADD COLUMN IF NOT EXISTS "visitor_hash" varchar;
ALTER TABLE "pair_votes" ADD COLUMN IF NOT EXISTS "is_bot"       boolean NOT NULL DEFAULT false;
