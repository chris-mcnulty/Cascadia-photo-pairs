-- Inventory exhibit support
-- Adds an optional "location" column to inventory items so individual prints
-- can be tracked while on exhibit at a venue (e.g. "Texaco", "Beaumont Cellars").
-- The new "on_exhibit" value for the existing "status" column is enforced in the
-- application layer (status is a plain varchar), so no constraint change is needed.

ALTER TABLE "inventory_items" ADD COLUMN IF NOT EXISTS "location" varchar;

CREATE INDEX IF NOT EXISTS "idx_inventory_items_location" ON "inventory_items" ("location");
