import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const collections = pgTable("collections", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  color: text("color").default("#3B82F6").notNull(),
  createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const photos = pgTable("photos", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  description: text("description"),
  imageUrl: text("image_url").notNull(),
  collectionId: varchar("collection_id").references(() => collections.id),
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

export const sessions = pgTable("sessions", {
  id: varchar("id").primaryKey(),
  isAuthenticated: boolean("is_authenticated").default(false).notNull(),
  pendingMfa: boolean("pending_mfa").default(false).notNull(),
  mfaCode: text("mfa_code"),
  mfaExpiry: text("mfa_expiry"),
  createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  lastActiveAt: text("last_active_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertCollectionSchema = createInsertSchema(collections).omit({
  id: true,
  createdAt: true,
});

export const insertPhotoSchema = createInsertSchema(photos).omit({
  id: true,
  votes: true,
  wins: true,
  comparisons: true,
  hidden: true,
});

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

export const insertSessionSchema = createInsertSchema(sessions).omit({
  createdAt: true,
  lastActiveAt: true,
});

export type InsertCollection = z.infer<typeof insertCollectionSchema>;
export type Collection = typeof collections.$inferSelect;
export type InsertPhoto = z.infer<typeof insertPhotoSchema>;
export type Photo = typeof photos.$inferSelect;
export type InsertVote = z.infer<typeof insertVoteSchema>;
export type Vote = typeof votes.$inferSelect;
export type InsertSettings = z.infer<typeof insertSettingsSchema>;
export type Settings = typeof settings.$inferSelect;
export type InsertSession = z.infer<typeof insertSessionSchema>;
export type Session = typeof sessions.$inferSelect;
