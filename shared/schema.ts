import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, boolean, timestamp, jsonb, index } from "drizzle-orm/pg-core";
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
  category: text("category").default("General").notNull(),
  createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  votes: integer("votes").default(0).notNull(),
  wins: integer("wins").default(0).notNull(),
  comparisons: integer("comparisons").default(0).notNull(),
  hidden: boolean("hidden").default(false).notNull(),
  archived: boolean("archived").default(false).notNull(), // Archive instead of delete - hides from reports/admin unless specifically enabled
  customPurchaseUrl: text("custom_purchase_url"),
  neverForSale: boolean("never_for_sale").default(true).notNull(), // Changed default to true
});

// Moving users table before votes table
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").notNull().unique(),
  username: varchar("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: text("profile_image_url"),
  emailVerified: boolean("email_verified").default(false).notNull(),
  resetToken: varchar("reset_token"),
  resetTokenExpiry: timestamp("reset_token_expiry"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  lastLoginAt: timestamp("last_login_at"),
  isAdmin: boolean("is_admin").default(false).notNull(),
  isMasterAdmin: boolean("is_master_admin").default(false).notNull(), // Master admin can promote others
}, (table) => [
  index("idx_users_email").on(table.email),
  index("idx_users_reset_token").on(table.resetToken),
]);

export const votes = pgTable("votes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  photoId: varchar("photo_id").notNull().references(() => photos.id),
  winnerPhotoId: varchar("winner_photo_id").notNull().references(() => photos.id),
  loserPhotoId: varchar("loser_photo_id").notNull().references(() => photos.id),
  voterType: text("voter_type").default("user").notNull(), // "admin" or "user"
  userId: varchar("user_id").references(() => users.id), // Track which user voted
  timestamp: text("timestamp").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const settings = pgTable("settings", {
  id: varchar("id").primaryKey().default("main"),
  purchaseEnabled: boolean("purchase_enabled").default(false).notNull(),
  defaultPurchaseUrl: text("default_purchase_url").default("https://www.chrismcnulty.net/store"),
  adminPassword: text("admin_password").default("BradyBunch12!").notNull(),
  mfaPhoneNumber: text("mfa_phone_number").default("+16179809810").notNull(),
  // New fields for customizable content
  contestSignupText: text("contest_signup_text").default("Join our monthly photo contest! The person who votes the most wins a free print of their choice."),
  supportEmail: text("support_email").default("support@cascadiaoceanic.com"),
  privacyPolicyUrl: text("privacy_policy_url").default("/privacy"),
  termsOfServiceUrl: text("terms_of_service_url").default("/terms"),
  consentCopyLong: text("consent_copy_long").default("By registering, you agree to receive updates, tips, and offers from Christopher F. McNulty (Chris) and Cascadia Oceanic LLC. You can unsubscribe anytime via the link in our emails or by contacting privacy@chrismcnulty.net. We do not sell your information. See our Privacy Policy: https://www.chrismcnulty.net/privacy"),
  consentCopyShort: text("consent_copy_short").default("I agree to receive updates from Christopher F. McNulty (Chris) & Cascadia Oceanic LLC and accept the Privacy Policy."),
  // User login feature toggles - separate for dev/prod environments
  
  // News System Configuration
  newsSource: text("news_source").default("internal").notNull(), // "internal" or "rss"
  rssUrl: text("rss_url").default("https://www.chrismcnulty.net/feed"),
  rssTag: text("rss_tag").default("photography"), // Filter by tag
  rssDaysLimit: integer("rss_days_limit").default(90), // Only show posts from last N days
  rssMaxItems: integer("rss_max_items").default(3), // Maximum number of items to show
  rssEnabled: boolean("rss_enabled").default(false).notNull(), // Master toggle for RSS
  userLoginEnabledDev: boolean("user_login_enabled_dev").default(true).notNull(), // ON in development for testing
  userLoginEnabledProd: boolean("user_login_enabled_prod").default(false).notNull(), // OFF in production until ready
  // Contest management fields
  monthlyContestText: text("monthly_contest_text").default("Enter our monthly photo contest! Top voters win prizes."),
  quarterlyContestText: text("quarterly_contest_text").default("Join our quarterly championship for bigger rewards!"),
  monthlyContestEnabled: boolean("monthly_contest_enabled").default(false).notNull(),
  monthlyContestStartDate: timestamp("monthly_contest_start_date"),
  monthlyContestEndDate: timestamp("monthly_contest_end_date"),
  quarterlyContestEnabled: boolean("quarterly_contest_enabled").default(false).notNull(),
  quarterlyContestStartDate: timestamp("quarterly_contest_start_date"),
  quarterlyContestEndDate: timestamp("quarterly_contest_end_date"),
  // Master announcement settings
  announcementEnabled: boolean("announcement_enabled").default(false).notNull(),
  announcementText: text("announcement_text"),
  announcementType: varchar("announcement_type").default("info"), // info, warning, success, contest
  // Pairs Feature Configuration
  pairsEnabled: boolean("pairs_enabled").default(false).notNull(),
  pairsMinInterval: integer("pairs_min_interval").default(10).notNull(), // Minimum votes between pairs
  pairsMaxInterval: integer("pairs_max_interval").default(15).notNull() // Maximum votes between pairs
});

// Photo pairs table for direct comparisons  
export const photoPairs = pgTable("photo_pairs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  photo1Id: varchar("photo1_id").notNull().references(() => photos.id),
  photo2Id: varchar("photo2_id").notNull().references(() => photos.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  createdBy: varchar("created_by").references(() => users.id), // Admin who created the pair
  description: text("description"), // Optional description of the pair relationship
  minFrequency: integer("min_frequency").default(5).notNull(), // Minimum rounds between pair appearances
  maxFrequency: integer("max_frequency").default(15).notNull(), // Maximum rounds between pair appearances
}, (table) => [
  index("idx_photo_pairs_photo1").on(table.photo1Id),
  index("idx_photo_pairs_photo2").on(table.photo2Id),
]);

// Pair votes table - tracks votes specifically between paired photos
export const pairVotes = pgTable("pair_votes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  pairId: varchar("pair_id").notNull().references(() => photoPairs.id),
  winnerPhotoId: varchar("winner_photo_id").notNull().references(() => photos.id),
  loserPhotoId: varchar("loser_photo_id").notNull().references(() => photos.id),
  voterType: text("voter_type").default("user").notNull(), // "admin" or "user"
  userId: varchar("user_id").references(() => users.id),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
}, (table) => [
  index("idx_pair_votes_pair").on(table.pairId),
  index("idx_pair_votes_winner").on(table.winnerPhotoId),
]);

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
  neverForSale: true,
});

export const insertVoteSchema = createInsertSchema(votes).omit({
  id: true,
  timestamp: true,
}).extend({
  winnerPhotoId: z.string().optional(),
  loserPhotoId: z.string().optional(),
  voterType: z.string().optional(),
  userId: z.string().optional(),
});

export const insertSettingsSchema = createInsertSchema(settings).omit({
  id: true,
});

export const insertSessionSchema = createInsertSchema(sessions).omit({
  createdAt: true,
  lastActiveAt: true,
});

export const insertPhotoPairSchema = createInsertSchema(photoPairs).omit({
  id: true,
  createdAt: true,
});

export const insertPairVoteSchema = createInsertSchema(pairVotes).omit({
  id: true,
  timestamp: true,
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
export type InsertPhotoPair = z.infer<typeof insertPhotoPairSchema>;
export type PhotoPair = typeof photoPairs.$inferSelect;
export type InsertPairVote = z.infer<typeof insertPairVoteSchema>;
export type PairVote = typeof pairVotes.$inferSelect;

// User statistics table
export const userStats = pgTable("user_stats", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id).unique(),
  totalVotes: integer("total_votes").default(0).notNull(),
  monthlyVotes: integer("monthly_votes").default(0).notNull(),
  quarterlyVotes: integer("quarterly_votes").default(0).notNull(),
  favoritePhotos: jsonb("favorite_photos").default([]).$type<string[]>(),
  purchasedPhotos: jsonb("purchased_photos").default([]).$type<string[]>(),
  lastVoteAt: timestamp("last_vote_at"),
  currentStreak: integer("current_streak").default(0).notNull(),
  longestStreak: integer("longest_streak").default(0).notNull(),
});

// Contest entries table
export const contestEntries = pgTable("contest_entries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  contestPeriod: varchar("contest_period").notNull(), // "2025-01" for monthly, "2025-Q1" for quarterly
  contestType: varchar("contest_type").notNull(), // "monthly" or "quarterly"
  voteCount: integer("vote_count").default(0).notNull(),
  enteredAt: timestamp("entered_at").defaultNow().notNull(),
  isWinner: boolean("is_winner").default(false).notNull(),
}, (table) => [
  index("idx_contest_entries_period").on(table.contestPeriod),
  index("idx_contest_entries_user").on(table.userId),
]);

// User favorites table for tracking favorite photos
export const userFavorites = pgTable("user_favorites", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  photoId: varchar("photo_id").notNull().references(() => photos.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_user_favorites_user").on(table.userId),
  index("idx_user_favorites_photo").on(table.photoId),
]);

// Email verification tokens
export const emailVerifications = pgTable("email_verifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  token: varchar("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Insert schemas for new tables
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  emailVerified: true,
  isAdmin: true,
});

export const insertUserStatsSchema = createInsertSchema(userStats).omit({
  id: true,
});

export const insertContestEntrySchema = createInsertSchema(contestEntries).omit({
  id: true,
  enteredAt: true,
  isWinner: true,
});

export const insertUserFavoriteSchema = createInsertSchema(userFavorites).omit({
  id: true,
  createdAt: true,
});

export const insertEmailVerificationSchema = createInsertSchema(emailVerifications).omit({
  id: true,
  createdAt: true,
});

// Type exports for new tables
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type UserStats = typeof userStats.$inferSelect;
export type InsertUserStats = z.infer<typeof insertUserStatsSchema>;
export type ContestEntry = typeof contestEntries.$inferSelect;
export type InsertContestEntry = z.infer<typeof insertContestEntrySchema>;
export type UserFavorite = typeof userFavorites.$inferSelect;
export type InsertUserFavorite = z.infer<typeof insertUserFavoriteSchema>;
export type EmailVerification = typeof emailVerifications.$inferSelect;
export type InsertEmailVerification = z.infer<typeof insertEmailVerificationSchema>;

// News/Announcements table
export const newsItems = pgTable("news_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: varchar("title").notNull(),
  description: text("description").notNull(),
  link: text("link").notNull(),
  publishDate: timestamp("publish_date").notNull(),
  expiryDate: timestamp("expiry_date"),
  isActive: boolean("is_active").default(true).notNull(),
  priority: integer("priority").default(0).notNull(), // Higher priority shows first
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_news_items_publish_date").on(table.publishDate),
  index("idx_news_items_active").on(table.isActive),
]);

export const insertNewsItemSchema = createInsertSchema(newsItems).omit({
  id: true,
  createdAt: true,
});

export type InsertNewsItem = z.infer<typeof insertNewsItemSchema>;
export type NewsItem = typeof newsItems.$inferSelect;
