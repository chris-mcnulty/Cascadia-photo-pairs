import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const photos = pgTable("photos", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  description: text("description"),
  imageUrl: text("image_url").notNull(),
  createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  votes: integer("votes").default(0).notNull(),
  wins: integer("wins").default(0).notNull(),
  comparisons: integer("comparisons").default(0).notNull(),
  hidden: boolean("hidden").default(false).notNull(),
  customPurchaseUrl: text("custom_purchase_url"),
});

export const votes = pgTable("votes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  photoId: varchar("photo_id").notNull().references(() => photos.id),
  winnerPhotoId: varchar("winner_photo_id").notNull().references(() => photos.id),
  loserPhotoId: varchar("loser_photo_id").notNull().references(() => photos.id),
  timestamp: text("timestamp").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const settings = pgTable("settings", {
  id: varchar("id").primaryKey().default("main"),
  purchaseEnabled: boolean("purchase_enabled").default(false).notNull(),
  defaultPurchaseUrl: text("default_purchase_url").default("https://www.chrismcnulty.net/store"),
  adminPassword: text("admin_password").default("BradyBunch12!").notNull(),
  mfaPhoneNumber: text("mfa_phone_number").default("+16179809810").notNull(),
});

export const insertPhotoSchema = createInsertSchema(photos).omit({
  id: true,
  votes: true,
  wins: true,
  comparisons: true,
  hidden: true,
});

export const updatePhotoSchema = createInsertSchema(photos).omit({
  id: true,
  votes: true,
  wins: true,
  comparisons: true,
  hidden: true,
}).partial();

export const insertVoteSchema = createInsertSchema(votes).omit({
  id: true,
  timestamp: true,
}).extend({
  winnerPhotoId: z.string().optional(),
  loserPhotoId: z.string().optional(),
});

export const insertSettingsSchema = createInsertSchema(settings).omit({
  id: true,
});

export type InsertPhoto = z.infer<typeof insertPhotoSchema>;
export type UpdatePhoto = z.infer<typeof updatePhotoSchema>;
export type Photo = typeof photos.$inferSelect;
export type InsertVote = z.infer<typeof insertVoteSchema>;
export type Vote = typeof votes.$inferSelect;
export type InsertSettings = z.infer<typeof insertSettingsSchema>;
export type Settings = typeof settings.$inferSelect;
