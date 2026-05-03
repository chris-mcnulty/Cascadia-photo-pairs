-- Email campaigns & centralized contacts
-- This migration is idempotent (safe to re-run).
-- pgcrypto provides gen_random_bytes (CSPRNG). We need it for the
-- 32-byte unsubscribe tokens generated below.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ===== contacts =====
CREATE TABLE IF NOT EXISTS "contacts" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "email" varchar NOT NULL,
  "first_name" varchar,
  "last_name" varchar,
  "source" varchar NOT NULL DEFAULT 'manual',
  "source_user_id" varchar REFERENCES "users"("id"),
  "source_customer_id" varchar REFERENCES "customers"("id"),
  "tags" text[] NOT NULL DEFAULT ARRAY[]::text[],
  "marketing_opt_in" boolean NOT NULL DEFAULT false,
  "unsubscribe_token" varchar NOT NULL,
  "unsubscribed_at" timestamp,
  "last_emailed_at" timestamp,
  "notes" text,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

DO $$ BEGIN
  ALTER TABLE "contacts" ADD CONSTRAINT "contacts_email_key" UNIQUE ("email");
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "contacts" ADD CONSTRAINT "contacts_unsubscribe_token_key" UNIQUE ("unsubscribe_token");
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "idx_contacts_email"   ON "contacts" ("email");
CREATE INDEX IF NOT EXISTS "idx_contacts_source"  ON "contacts" ("source");
CREATE INDEX IF NOT EXISTS "idx_contacts_opt_in"  ON "contacts" ("marketing_opt_in");

-- ===== contact_lists =====
CREATE TABLE IF NOT EXISTS "contact_lists" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" varchar NOT NULL UNIQUE,
  "description" text,
  "created_at" timestamp NOT NULL DEFAULT now()
);

-- ===== contact_list_members =====
CREATE TABLE IF NOT EXISTS "contact_list_members" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "list_id" varchar NOT NULL REFERENCES "contact_lists"("id") ON DELETE CASCADE,
  "contact_id" varchar NOT NULL REFERENCES "contacts"("id") ON DELETE CASCADE,
  "added_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX        IF NOT EXISTS "idx_clm_list"   ON "contact_list_members" ("list_id");
CREATE INDEX        IF NOT EXISTS "idx_clm_contact" ON "contact_list_members" ("contact_id");
CREATE UNIQUE INDEX IF NOT EXISTS "idx_clm_unique" ON "contact_list_members" ("list_id", "contact_id");

-- ===== email_campaigns =====
CREATE TABLE IF NOT EXISTS "email_campaigns" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" varchar NOT NULL,
  "subject" varchar NOT NULL,
  "from_name" varchar NOT NULL,
  "from_email" varchar NOT NULL,
  "reply_to" varchar,
  "body_html" text NOT NULL,
  "list_id" varchar REFERENCES "contact_lists"("id"),
  "status" varchar NOT NULL DEFAULT 'draft',
  "sent_count" integer NOT NULL DEFAULT 0,
  "failed_count" integer NOT NULL DEFAULT 0,
  "unsubscribed_count" integer NOT NULL DEFAULT 0,
  "total_recipients" integer NOT NULL DEFAULT 0,
  "scheduled_for" timestamp,
  "sent_at" timestamp,
  "created_by" varchar REFERENCES "users"("id"),
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_email_campaigns_status" ON "email_campaigns" ("status");
CREATE INDEX IF NOT EXISTS "idx_email_campaigns_list"   ON "email_campaigns" ("list_id");

-- ===== email_campaign_recipients =====
CREATE TABLE IF NOT EXISTS "email_campaign_recipients" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "campaign_id" varchar NOT NULL REFERENCES "email_campaigns"("id") ON DELETE CASCADE,
  "contact_id" varchar NOT NULL REFERENCES "contacts"("id"),
  "email" varchar NOT NULL,
  "status" varchar NOT NULL DEFAULT 'pending',
  "sendgrid_message_id" varchar,
  "error_message" text,
  "sent_at" timestamp,
  "created_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX        IF NOT EXISTS "idx_ecr_campaign" ON "email_campaign_recipients" ("campaign_id");
CREATE INDEX        IF NOT EXISTS "idx_ecr_contact"  ON "email_campaign_recipients" ("contact_id");
CREATE INDEX        IF NOT EXISTS "idx_ecr_status"   ON "email_campaign_recipients" ("status");
CREATE UNIQUE INDEX IF NOT EXISTS "idx_ecr_unique"   ON "email_campaign_recipients" ("campaign_id", "contact_id");

-- ===== settings: marketing defaults =====
ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "campaign_from_name"       text DEFAULT 'Cascadia Oceanic';
ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "campaign_from_email"      text DEFAULT 'cascadia@chrismcnulty.net';
ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "campaign_reply_to"        text DEFAULT 'cascadia@chrismcnulty.net';
ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "campaign_mailing_address" text;

-- ===== FK upgrade: drop the old contact_id FK if it lacks ON DELETE CASCADE,
--       then re-add it with cascade so deleting a contact removes its history.
DO $$
DECLARE fkname text;
BEGIN
  SELECT conname INTO fkname
    FROM pg_constraint
   WHERE conrelid = '"email_campaign_recipients"'::regclass
     AND contype = 'f'
     AND conkey = (
       SELECT array_agg(attnum) FROM pg_attribute
        WHERE attrelid = '"email_campaign_recipients"'::regclass AND attname = 'contact_id'
     )
     AND confdeltype <> 'c';
  IF fkname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE "email_campaign_recipients" DROP CONSTRAINT %I', fkname);
    ALTER TABLE "email_campaign_recipients"
      ADD CONSTRAINT "email_campaign_recipients_contact_id_fkey"
      FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE CASCADE;
  END IF;
END $$;

-- Backfill contacts from existing users + customers (idempotent via ON CONFLICT).
-- Opt-in policy: users registered through the signup flow which presents the
-- privacy notice, so they are treated as opted in. Customers come from the
-- order pipeline without an explicit marketing consent step and start opted out.
INSERT INTO contacts (email, first_name, last_name, source, source_user_id,
                      tags, marketing_opt_in, unsubscribe_token)
SELECT lower(trim(u.email)), u.first_name, u.last_name, 'user', u.id,
       ARRAY[]::text[], true, encode(gen_random_bytes(32), 'hex')
  FROM users u
 WHERE u.email IS NOT NULL AND u.email <> ''
ON CONFLICT (email) DO NOTHING;

INSERT INTO contacts (email, first_name, last_name, source, source_customer_id,
                      tags, marketing_opt_in, unsubscribe_token)
SELECT lower(trim(c.email)),
       split_part(coalesce(c.name, ''), ' ', 1),
       NULLIF(regexp_replace(coalesce(c.name, ''), '^\S+\s*', ''), ''),
       'customer', c.id, ARRAY[]::text[], false,
       encode(gen_random_bytes(32), 'hex')
  FROM customers c
 WHERE c.email IS NOT NULL AND c.email <> ''
ON CONFLICT (email) DO NOTHING;

-- Promote previously-backfilled user contacts to opted in (one-time).
UPDATE contacts SET marketing_opt_in = true, updated_at = now()
 WHERE source = 'user' AND marketing_opt_in = false AND unsubscribed_at IS NULL;

-- Rotate any tokens still using a non-CSPRNG path. Skip contacts who have
-- received an email so their existing unsubscribe links keep working.
UPDATE contacts
   SET unsubscribe_token = encode(gen_random_bytes(32), 'hex')
 WHERE unsubscribe_token ~ '^[0-9a-f]{64}$'
   AND last_emailed_at IS NULL;

