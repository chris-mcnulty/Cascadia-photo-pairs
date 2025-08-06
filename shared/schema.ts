import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const photos = pgTable("photos", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  description: text("description"),
  imageUrl: text("image_url").notNull(),
  votes: integer("votes").default(0).notNull(),
  wins: integer("wins").default(0).notNull(),
  comparisons: integer("comparisons").default(0).notNull(),
  customPurchaseUrl: text("custom_purchase_url"),
});

export const votes = pgTable("votes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  photoId: varchar("photo_id").notNull().references(() => photos.id),
  timestamp: text("timestamp").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const settings = pgTable("settings", {
  id: varchar("id").primaryKey().default("main"),
  purchaseEnabled: boolean("purchase_enabled").default(false).notNull(),
  defaultPurchaseUrl: text("default_purchase_url").default("https://www.chrismcnulty.net/store"),
});

export const insertPhotoSchema = createInsertSchema(photos).omit({
  id: true,
  votes: true,
  wins: true,
  comparisons: true,
});

export const insertVoteSchema = createInsertSchema(votes).omit({
  id: true,
  timestamp: true,
});

export const insertSettingsSchema = createInsertSchema(settings).omit({
  id: true,
});

export type InsertPhoto = z.infer<typeof insertPhotoSchema>;
export type Photo = typeof photos.$inferSelect;
export type InsertVote = z.infer<typeof insertVoteSchema>;
export type Vote = typeof votes.$inferSelect;
export type InsertSettings = z.infer<typeof insertSettingsSchema>;
export type Settings = typeof settings.$inferSelect;
