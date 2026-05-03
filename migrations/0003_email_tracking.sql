-- Email open + click tracking
-- Adds optional per-campaign tracking flags, aggregate counts, per-recipient
-- open/click timestamps & counts, and a per-event log table fed by the
-- SendGrid event webhook.

ALTER TABLE "email_campaigns" ADD COLUMN IF NOT EXISTS "track_opens"        boolean NOT NULL DEFAULT true;
ALTER TABLE "email_campaigns" ADD COLUMN IF NOT EXISTS "track_clicks"       boolean NOT NULL DEFAULT true;
ALTER TABLE "email_campaigns" ADD COLUMN IF NOT EXISTS "open_count"         integer NOT NULL DEFAULT 0;
ALTER TABLE "email_campaigns" ADD COLUMN IF NOT EXISTS "unique_open_count"  integer NOT NULL DEFAULT 0;
ALTER TABLE "email_campaigns" ADD COLUMN IF NOT EXISTS "click_count"        integer NOT NULL DEFAULT 0;
ALTER TABLE "email_campaigns" ADD COLUMN IF NOT EXISTS "unique_click_count" integer NOT NULL DEFAULT 0;

ALTER TABLE "email_campaign_recipients" ADD COLUMN IF NOT EXISTS "opened_at"   timestamp;
ALTER TABLE "email_campaign_recipients" ADD COLUMN IF NOT EXISTS "open_count"  integer NOT NULL DEFAULT 0;
ALTER TABLE "email_campaign_recipients" ADD COLUMN IF NOT EXISTS "clicked_at"  timestamp;
ALTER TABLE "email_campaign_recipients" ADD COLUMN IF NOT EXISTS "click_count" integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS "idx_ecr_sgid" ON "email_campaign_recipients" ("sendgrid_message_id");

CREATE TABLE IF NOT EXISTS "email_campaign_events" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "campaign_id" varchar NOT NULL REFERENCES "email_campaigns"("id") ON DELETE CASCADE,
  "recipient_id" varchar REFERENCES "email_campaign_recipients"("id") ON DELETE CASCADE,
  "contact_id" varchar REFERENCES "contacts"("id") ON DELETE SET NULL,
  "email" varchar NOT NULL,
  "event_type" varchar NOT NULL,
  "url" text,
  "user_agent" text,
  "ip" varchar,
  "sg_event_id" varchar,
  "sg_message_id" varchar,
  "occurred_at" timestamp NOT NULL,
  "created_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX        IF NOT EXISTS "idx_ece_campaign"          ON "email_campaign_events" ("campaign_id");
CREATE INDEX        IF NOT EXISTS "idx_ece_recipient"         ON "email_campaign_events" ("recipient_id");
CREATE INDEX        IF NOT EXISTS "idx_ece_type"              ON "email_campaign_events" ("event_type");
CREATE UNIQUE INDEX IF NOT EXISTS "idx_ece_sg_event_unique"   ON "email_campaign_events" ("sg_event_id");
