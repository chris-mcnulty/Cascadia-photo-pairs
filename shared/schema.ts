import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, boolean, timestamp, jsonb, index, numeric } from "drizzle-orm/pg-core";
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
  originalDate: timestamp("original_date"),
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

// ============================================
// INVENTORY & SALES MANAGEMENT SYSTEM
// ============================================

// Products table - core business entity that can reference photos
export const products = pgTable("products", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  photoId: varchar("photo_id").references(() => photos.id), // Optional - future products might not be photos
  title: varchar("title").notNull(),
  description: text("description"),
  originalDate: timestamp("original_date"),
  aspectRatio: varchar("aspect_ratio").notNull(), // "3x2", "2x3", "16x9", "1x1", etc. - orientation specific!
  externalId: varchar("external_id").unique(), // External ID for integration with other systems (e.g., Etsy, Amazon) - must be unique
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_products_photo").on(table.photoId),
  index("idx_products_aspect_ratio").on(table.aspectRatio),
]);

// Product variants (same product in different media types)
export const productVariants = pgTable("product_variants", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  productId: varchar("product_id").notNull().references(() => products.id),
  mediaType: varchar("media_type").notNull(), // "ChromaLuxe", "Framed Archival", "Canvas", etc.
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_product_variants_product").on(table.productId),
  index("idx_product_variants_media").on(table.mediaType),
]);

// Master SKUs - unique combination of product + media + size
export const productSKUs = pgTable("product_skus", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sku: varchar("sku").notNull().unique(), // e.g., "TRUL2020-CL-24x36"
  productId: varchar("product_id").notNull().references(() => products.id),
  mediaType: varchar("media_type").notNull(), // "ChromaLuxe", "Framed Archival", etc.
  productSizeId: varchar("product_size_id").notNull().references(() => productSizes.id),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_product_skus_product").on(table.productId),
  index("idx_product_skus_size").on(table.productSizeId),
  index("idx_product_skus_sku").on(table.sku),
  // Ensure unique combination of product + media + size
  index("idx_product_skus_unique").on(table.productId, table.mediaType, table.productSizeId),
]);

// Channel-specific SKUs (children of master SKUs)
export const channelSKUs = pgTable("channel_skus", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  masterSKUId: varchar("master_sku_id").notNull().references(() => productSKUs.id),
  channelId: varchar("channel_id").notNull().references(() => salesChannels.id),
  channelSKU: varchar("channel_sku").notNull(), // e.g., "AMZN-TRUL2020-CL-24x36"
  channelListingId: varchar("channel_listing_id"), // External ID from Amazon, Etsy, etc.
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_channel_skus_master").on(table.masterSKUId),
  index("idx_channel_skus_channel").on(table.channelId),
  index("idx_channel_skus_unique").on(table.channelId, table.channelSKU),
]);

// Retail prices - YOUR pricing history, not supplier costs
export const retailPrices = pgTable("retail_prices", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  productSizeId: varchar("product_size_id").notNull().references(() => productSizes.id),
  mediaType: varchar("media_type").notNull(), // "ChromaLuxe", "Framed Archival", etc.
  retailPrice: integer("retail_price").notNull(), // Price in cents
  effectiveFrom: timestamp("effective_from").notNull().defaultNow(),
  effectiveTo: timestamp("effective_to"), // NULL for current price
  version: integer("version").notNull().default(1),
  isCurrent: boolean("is_current").default(true).notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_retail_prices_size").on(table.productSizeId),
  index("idx_retail_prices_media").on(table.mediaType),
  index("idx_retail_prices_effective").on(table.effectiveFrom),
  index("idx_retail_prices_current").on(table.isCurrent),
]);

// Sales channels (website, art shows, Amazon, Etsy, etc.)
export const salesChannels = pgTable("sales_channels", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull().unique(),
  description: text("description"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Suppliers for prints
export const suppliers = pgTable("suppliers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull().unique(),
  contactEmail: varchar("contact_email"),
  contactPhone: varchar("contact_phone"),
  website: text("website"),
  notes: text("notes"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Product sizes (8x10, 11x14, 24x13.5, etc.) with aspect ratios
export const productSizes = pgTable("product_sizes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sizeLabel: varchar("size_label").notNull(), // "8x10", "11x14", "24x13.5", etc.
  widthInches: numeric("width_inches", { precision: 5, scale: 2 }).notNull(), // Supports decimals like 13.5
  heightInches: numeric("height_inches", { precision: 5, scale: 2 }).notNull(), // Supports decimals like 13.5
  aspectRatio: text("aspect_ratio").notNull(), // "3x2", "2x3", "16x9", etc. - orientation specific!
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_product_sizes_aspect_ratio").on(table.aspectRatio),
]);

// Historical supplier pricing - versioned by effective dates
export const supplierPrices = pgTable("supplier_prices", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  supplierId: varchar("supplier_id").notNull().references(() => suppliers.id),
  productSizeId: varchar("product_size_id").notNull().references(() => productSizes.id),
  mediaType: varchar("media_type").notNull(), // "ChromaLuxe", "Magnet"
  basePrice: integer("base_price").notNull(), // Price in cents
  effectiveFrom: timestamp("effective_from").notNull().defaultNow(),
  effectiveTo: timestamp("effective_to"), // NULL for current price
  version: integer("version").notNull().default(1),
  isCurrent: boolean("is_current").default(true).notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_supplier_prices_supplier").on(table.supplierId),
  index("idx_supplier_prices_size").on(table.productSizeId),
  index("idx_supplier_prices_effective").on(table.effectiveFrom),
  index("idx_supplier_prices_current").on(table.isCurrent),
]);

// Customers table for tracking buyers
export const customers = pgTable("customers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull(),
  email: varchar("email"),
  phone: varchar("phone"),
  address: text("address"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_customers_email").on(table.email),
]);

// Orders table - represents a purchase with potentially multiple items
export const orders = pgTable("orders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orderNumber: varchar("order_number"), // Optional external order number (e.g., from Etsy, Amazon)
  channelId: varchar("channel_id").notNull().references(() => salesChannels.id),
  customerId: varchar("customer_id").references(() => customers.id),
  
  // Order-level totals
  orderDate: timestamp("order_date").notNull().defaultNow(),
  subtotal: integer("subtotal").notNull(), // Sum of all item prices in cents
  taxCollected: integer("tax_collected").default(0).notNull(), // Total tax in cents
  totalAmount: integer("total_amount").notNull(), // Subtotal + tax in cents
  
  // Legacy buyer information (for backward compatibility when customerId is null)
  buyerName: varchar("buyer_name"),
  buyerEmail: varchar("buyer_email"),
  buyerPhone: varchar("buyer_phone"),
  shippingAddress: text("shipping_address"),
  
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_orders_number").on(table.orderNumber),
  index("idx_orders_channel").on(table.channelId),
  index("idx_orders_customer").on(table.customerId),
  index("idx_orders_date").on(table.orderDate),
]);

// Order items - individual line items within an order
export const orderItems = pgTable("order_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orderId: varchar("order_id").notNull().references(() => orders.id),
  productId: varchar("product_id").references(() => products.id),
  productSKUId: varchar("product_sku_id").references(() => productSKUs.id), // Optional SKU reference
  
  // Item details
  saleType: varchar("sale_type").default("inventory"), // "inventory" or "dropship"
  inventoryItemId: varchar("inventory_item_id"), // Reference to specific inventory item (for inventory sales)
  supplierId: varchar("supplier_id").references(() => suppliers.id), // Supplier reference (for dropship sales)
  
  // Pricing
  quantity: integer("quantity").default(1).notNull(),
  unitPrice: integer("unit_price").notNull(), // Price per unit in cents
  taxAmount: integer("tax_amount").default(0).notNull(), // Tax for this line item in cents
  lineTotal: integer("line_total").notNull(), // (unitPrice * quantity) + taxAmount in cents
  
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_order_items_order").on(table.orderId),
  index("idx_order_items_product").on(table.productId),
  index("idx_order_items_sku").on(table.productSKUId),
  index("idx_order_items_inventory").on(table.inventoryItemId),
  index("idx_order_items_supplier").on(table.supplierId),
]);

// Sales records with buyer information (LEGACY - will be replaced by orders + order_items)
export const sales = pgTable("sales", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  productId: varchar("product_id").references(() => products.id), // Changed from photoId
  channelId: varchar("channel_id").notNull().references(() => salesChannels.id),
  customerId: varchar("customer_id").references(() => customers.id), // Reference to customers table
  saleDate: timestamp("sale_date").notNull().defaultNow(),
  soldPrice: integer("sold_price").notNull(), // Price in cents - can override standard pricing
  taxCollected: integer("tax_collected").default(0).notNull(), // Tax in cents
  
  // Sale type and item tracking
  saleType: varchar("sale_type").default("inventory"), // "inventory" or "dropship"
  inventoryItemId: varchar("inventory_item_id"), // Reference to specific inventory item (for inventory sales)
  supplierId: varchar("supplier_id").references(() => suppliers.id), // Supplier reference (for dropship sales)
  
  // Legacy buyer information (for backward compatibility)
  buyerName: varchar("buyer_name"),
  buyerEmail: varchar("buyer_email"),
  buyerPhone: varchar("buyer_phone"),
  shippingAddress: text("shipping_address"),
  
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_sales_product").on(table.productId),
  index("idx_sales_channel").on(table.channelId),
  index("idx_sales_customer").on(table.customerId),
  index("idx_sales_date").on(table.saleDate),
  index("idx_sales_inventory_item").on(table.inventoryItemId),
  index("idx_sales_supplier").on(table.supplierId),
]);

// Individual inventory items (each physical print)
export const inventoryItems = pgTable("inventory_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  productSKUId: varchar("product_sku_id").references(() => productSKUs.id), // References master SKU (nullable for backward compat)
  productId: varchar("product_id").notNull().references(() => products.id), // Product reference (has title/description)
  supplierId: varchar("supplier_id").notNull().references(() => suppliers.id), // Track supplier for each item
  orderItemId: varchar("order_item_id").references(() => orderItems.id), // Link to order item when sold
  
  // Print details (no longer duplicate title/description/originalDate - get from product)
  mediaType: varchar("media_type").notNull(), // "ChromaLuxe", "Magnet"
  productSizeId: varchar("product_size_id").notNull().references(() => productSizes.id),
  
  // Financial details
  acquisitionCost: integer("acquisition_cost").notNull(), // Cost in cents (actual cost for this specific item)
  listPrice: integer("list_price").notNull(), // List price in cents
  
  // Status tracking
  status: varchar("status").notNull().default("ordered"), // "ordered", "in_stock", "sold", "shipped"
  purchaseDate: timestamp("purchase_date"), // When we ordered/bought it
  receivedDate: timestamp("received_date"), // When we received it
  soldDate: timestamp("sold_date"), // When it sold
  shippedDate: timestamp("shipped_date"), // When we shipped it
  
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_inventory_items_sku").on(table.productSKUId),
  index("idx_inventory_items_product").on(table.productId),
  index("idx_inventory_items_supplier").on(table.supplierId),
  index("idx_inventory_items_status").on(table.status),
  index("idx_inventory_items_order_item").on(table.orderItemId),
]);

// Drop-ship orders for online sales (ordered before inventory arrives)
export const dropShipOrders = pgTable("drop_ship_orders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orderItemId: varchar("order_item_id").notNull().references(() => orderItems.id),
  inventoryItemId: varchar("inventory_item_id").references(() => inventoryItems.id),
  supplierId: varchar("supplier_id").notNull().references(() => suppliers.id),
  
  orderNumber: varchar("order_number"),
  trackingNumber: varchar("tracking_number"),
  orderDate: timestamp("order_date").notNull().defaultNow(),
  estimatedDelivery: timestamp("estimated_delivery"),
  actualDelivery: timestamp("actual_delivery"),
  
  fulfillmentStatus: varchar("fulfillment_status").notNull().default("pending"), // "pending", "ordered", "shipped", "delivered", "cancelled"
  
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_drop_ship_order_item").on(table.orderItemId),
  index("idx_drop_ship_status").on(table.fulfillmentStatus),
]);

// Expense categories
export const expenseCategories = pgTable("expense_categories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull().unique(),
  description: text("description"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Business expenses with receipt storage
export const expenses = pgTable("expenses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  categoryId: varchar("category_id").notNull().references(() => expenseCategories.id),
  vendor: varchar("vendor").notNull(),
  amount: integer("amount").notNull(), // Amount in cents
  expenseDate: timestamp("expense_date").notNull(),
  purpose: text("purpose").notNull(),
  receiptUrl: text("receipt_url"), // SharePoint URL
  receiptFileName: text("receipt_file_name"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_expenses_category").on(table.categoryId),
  index("idx_expenses_date").on(table.expenseDate),
  index("idx_expenses_vendor").on(table.vendor),
]);

// Insert schemas
export const insertProductSchema = createInsertSchema(products).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertProductVariantSchema = createInsertSchema(productVariants).omit({
  id: true,
  createdAt: true,
});

export const insertProductSKUSchema = createInsertSchema(productSKUs).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertChannelSKUSchema = createInsertSchema(channelSKUs).omit({
  id: true,
  createdAt: true,
});

export const insertRetailPriceSchema = createInsertSchema(retailPrices).omit({
  id: true,
  createdAt: true,
  effectiveFrom: true,
  version: true,
  isCurrent: true,
});

export const insertSalesChannelSchema = createInsertSchema(salesChannels).omit({
  id: true,
  createdAt: true,
});

export const insertSupplierSchema = createInsertSchema(suppliers).omit({
  id: true,
  createdAt: true,
});

export const insertProductSizeSchema = createInsertSchema(productSizes).omit({
  id: true,
  createdAt: true,
});

export const insertSupplierPriceSchema = createInsertSchema(supplierPrices).omit({
  id: true,
  createdAt: true,
});

export const insertOrderSchema = createInsertSchema(orders).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertOrderItemSchema = createInsertSchema(orderItems).omit({
  id: true,
  createdAt: true,
});

export const insertSaleSchema = createInsertSchema(sales).omit({
  id: true,
  createdAt: true,
});

export const insertInventoryItemSchema = createInsertSchema(inventoryItems).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertDropShipOrderSchema = createInsertSchema(dropShipOrders).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertExpenseCategorySchema = createInsertSchema(expenseCategories).omit({
  id: true,
  createdAt: true,
});

export const insertExpenseSchema = createInsertSchema(expenses).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Type exports
export type Product = typeof products.$inferSelect;
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type ProductVariant = typeof productVariants.$inferSelect;
export type InsertProductVariant = z.infer<typeof insertProductVariantSchema>;
export type ProductSKU = typeof productSKUs.$inferSelect;
export type InsertProductSKU = z.infer<typeof insertProductSKUSchema>;
export type ChannelSKU = typeof channelSKUs.$inferSelect;
export type InsertChannelSKU = z.infer<typeof insertChannelSKUSchema>;
export type RetailPrice = typeof retailPrices.$inferSelect;
export type InsertRetailPrice = z.infer<typeof insertRetailPriceSchema>;
export type SalesChannel = typeof salesChannels.$inferSelect;
export type InsertSalesChannel = z.infer<typeof insertSalesChannelSchema>;
export type Supplier = typeof suppliers.$inferSelect;
export type InsertSupplier = z.infer<typeof insertSupplierSchema>;
export type ProductSize = typeof productSizes.$inferSelect;
export type InsertProductSize = z.infer<typeof insertProductSizeSchema>;
export type SupplierPrice = typeof supplierPrices.$inferSelect;
export type InsertSupplierPrice = z.infer<typeof insertSupplierPriceSchema>;
export type Order = typeof orders.$inferSelect;
export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type OrderItem = typeof orderItems.$inferSelect;
export type InsertOrderItem = z.infer<typeof insertOrderItemSchema>;
export type Sale = typeof sales.$inferSelect;
export type InsertSale = z.infer<typeof insertSaleSchema>;
export type InventoryItem = typeof inventoryItems.$inferSelect;
export type InsertInventoryItem = z.infer<typeof insertInventoryItemSchema>;
export type DropShipOrder = typeof dropShipOrders.$inferSelect;
export type InsertDropShipOrder = z.infer<typeof insertDropShipOrderSchema>;
export type ExpenseCategory = typeof expenseCategories.$inferSelect;
export type InsertExpenseCategory = z.infer<typeof insertExpenseCategorySchema>;
export type Expense = typeof expenses.$inferSelect;
export type InsertExpense = z.infer<typeof insertExpenseSchema>;
