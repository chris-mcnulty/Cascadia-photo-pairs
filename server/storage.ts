import { 
  type Photo, type InsertPhoto, type Vote, type InsertVote, type Settings, type InsertSettings, 
  type Collection, type InsertCollection, type PhotoPair, type InsertPhotoPair, type PairVote, type InsertPairVote,
  type Product, type InsertProduct, type ProductVariant, type InsertProductVariant,
  type ProductSKU, type InsertProductSKU, type ChannelSKU, type InsertChannelSKU,
  type RetailPrice, type InsertRetailPrice,
  type SalesChannel, type InsertSalesChannel, type Supplier, type InsertSupplier,
  type ProductSize, type InsertProductSize, type SupplierPrice, type InsertSupplierPrice,
  type Sale, type InsertSale, type Order, type InsertOrder, type OrderItem, type InsertOrderItem,
  type InventoryItem, type InsertInventoryItem,
  type DropShipOrder, type InsertDropShipOrder, type ExpenseCategory, type InsertExpenseCategory,
  type Expense, type InsertExpense
} from "@shared/schema";

// DTO for expenses enriched with category name
export type ExpenseWithCategory = Expense & { categoryName: string };
import { randomUUID } from "crypto";
import { db } from "./db";
import { photos, votes, settings, collections, photoPairs, pairVotes, products, productVariants, productSKUs, channelSKUs, retailPrices, salesChannels, suppliers, productSizes, supplierPrices, sales, orders, orderItems, inventoryItems, dropShipOrders, expenseCategories, expenses } from "@shared/schema";
import { eq, sql, inArray, and, or, gte, lte, isNull, desc } from "drizzle-orm";

export interface IStorage {
  // Collections
  getAllCollections(): Promise<Collection[]>;
  getCollection(id: string): Promise<Collection | undefined>;
  createCollection(collection: InsertCollection): Promise<Collection>;
  updateCollection(id: string, updates: Partial<Collection>): Promise<Collection | undefined>;
  deleteCollection(id: string): Promise<boolean>;
  
  // Photos
  getAllPhotos(collectionId?: string): Promise<Photo[]>;
  getPhoto(id: string): Promise<Photo | undefined>;
  createPhoto(photo: InsertPhoto): Promise<Photo>;
  updatePhoto(id: string, updates: Partial<Photo>): Promise<Photo | undefined>;
  
  // Votes
  createVote(vote: InsertVote): Promise<Vote>;
  getTotalVotes(): Promise<number>;
  getUniqueVoters(): Promise<number>;
  
  // Settings
  getSettings(): Promise<Settings>;
  updateSettings(settings: InsertSettings): Promise<Settings>;
  
  // Stats
  getPhotoStats(startDate?: string, endDate?: string, category?: string, voterType?: string): Promise<Photo[]>;
  getRandomPhotoPair(collectionId?: string): Promise<[Photo, Photo] | null>;
  getVotesByDateRange(startDate?: string, endDate?: string): Promise<Vote[]>;
  getTotalVotes(startDate?: string, endDate?: string, voterType?: string): Promise<number>;
  getUniqueVoters(startDate?: string, endDate?: string, voterType?: string): Promise<number>;
  getPhotoCategories(): Promise<string[]>;
  getAllPhotosWithStats(category?: string): Promise<Photo[]>;
  
  // Photo management
  deletePhoto(id: string): Promise<boolean>;
  updatePhotosCategory(photoIds: string[], category: string): Promise<boolean>;
  updatePhotosSaleStatus(photoIds: string[], neverForSale: boolean): Promise<boolean>;
  purgeTestData(beforeDate: string): Promise<{ votesDeleted: number; photosReset: boolean }>;
  
  // Special method for comparison tracking
  recordComparison(winnerPhotoId: string, loserPhotoId: string): Promise<void>;
  
  // Leaderboard methods
  getTopPhotosByVotes(limit?: number): Promise<Photo[]>;
  getTopPhotosByWins(limit?: number): Promise<Photo[]>;
  getUserVotedPhotos(userId: string, limit: number, sortBy: 'votes' | 'wins'): Promise<Photo[]>;
  
  // Pairs functionality
  createPhotoPair(pair: InsertPhotoPair): Promise<PhotoPair>;
  getAllPhotoPairs(): Promise<PhotoPair[]>;
  getPhotoPair(id: string): Promise<PhotoPair | undefined>;
  deletePhotoPair(id: string): Promise<boolean>;
  getPhotoPartnerships(photoId: string): Promise<PhotoPair[]>;
  createPairVote(vote: InsertPairVote): Promise<PairVote>;
  getPairVoteStats(pairId: string): Promise<{ photo1Wins: number; photo2Wins: number; totalVotes: number }>;
  getPhotoPerformanceInPairs(photoId: string): Promise<{ wins: number; losses: number; winRate: number }>;
  checkForPairDisplay(): Promise<[Photo, Photo] | null>;
  archivePhoto(id: string): Promise<boolean>;
  
  // Products
  getAllProducts(): Promise<Product[]>;
  getProduct(id: string): Promise<Product | undefined>;
  createProduct(product: InsertProduct): Promise<Product>;
  updateProduct(id: string, updates: Partial<Product>): Promise<Product | undefined>;
  deleteProduct(id: string): Promise<boolean>;
  getProductsByPhoto(photoId: string): Promise<Product[]>;
  
  // Product Variants
  getProductVariants(productId: string): Promise<ProductVariant[]>;
  createProductVariant(variant: InsertProductVariant): Promise<ProductVariant>;
  updateProductVariant(id: string, updates: Partial<ProductVariant>): Promise<ProductVariant | undefined>;
  deleteProductVariant(id: string): Promise<boolean>;
  
  // Product SKUs
  getAllProductSKUs(): Promise<ProductSKU[]>;
  getAllProductSKUsWithDetails(): Promise<Array<ProductSKU & { productTitle: string; productExternalId: string | null; sizeLabel: string }>>;
  getProductSKU(id: string): Promise<ProductSKU | undefined>;
  createProductSKU(sku: InsertProductSKU): Promise<ProductSKU>;
  updateProductSKU(id: string, updates: Partial<ProductSKU>): Promise<ProductSKU | undefined>;
  deleteProductSKU(id: string): Promise<boolean>;
  getProductSKUsByProduct(productId: string): Promise<ProductSKU[]>;
  
  // Channel SKUs
  getAllChannelSKUs(): Promise<ChannelSKU[]>;
  getChannelSKU(id: string): Promise<ChannelSKU | undefined>;
  getChannelSKUs(masterSKUId: string): Promise<ChannelSKU[]>;
  getChannelSKUsByMaster(masterSKUId: string): Promise<ChannelSKU[]>;
  createChannelSKU(sku: InsertChannelSKU): Promise<ChannelSKU>;
  updateChannelSKU(id: string, updates: Partial<ChannelSKU>): Promise<ChannelSKU | undefined>;
  deleteChannelSKU(id: string): Promise<boolean>;
  
  // Retail Prices
  getRetailPrices(productSizeId: string, mediaType: string): Promise<RetailPrice[]>;
  getCurrentRetailPrice(productSizeId: string, mediaType: string): Promise<RetailPrice | undefined>;
  createRetailPrice(price: InsertRetailPrice): Promise<RetailPrice>;
  updateRetailPrice(id: string, updates: Partial<RetailPrice>): Promise<RetailPrice | undefined>;
  setRetailPrice(productSizeId: string, mediaType: string, newPrice: number, notes?: string): Promise<RetailPrice>;
  
  // Sales Channels
  getAllSalesChannels(): Promise<SalesChannel[]>;
  getSalesChannel(id: string): Promise<SalesChannel | undefined>;
  createSalesChannel(channel: InsertSalesChannel): Promise<SalesChannel>;
  updateSalesChannel(id: string, updates: Partial<SalesChannel>): Promise<SalesChannel | undefined>;
  deleteSalesChannel(id: string): Promise<boolean>;
  
  // Suppliers
  getAllSuppliers(): Promise<Supplier[]>;
  getSupplier(id: string): Promise<Supplier | undefined>;
  createSupplier(supplier: InsertSupplier): Promise<Supplier>;
  updateSupplier(id: string, updates: Partial<Supplier>): Promise<Supplier | undefined>;
  deleteSupplier(id: string): Promise<boolean>;
  
  // Product Sizes
  getAllProductSizes(): Promise<ProductSize[]>;
  getProductSize(id: string): Promise<ProductSize | undefined>;
  createProductSize(size: InsertProductSize): Promise<ProductSize>;
  updateProductSize(id: string, updates: Partial<ProductSize>): Promise<ProductSize | undefined>;
  deleteProductSize(id: string): Promise<boolean>;
  getProductSizesWithPricing(): Promise<Array<{
    size: ProductSize;
    mediaType: string;
    avgSupplierCost: number | null;
    retailPrice: number | null;
    marginPercent: number | null;
  }>>;
  
  // Supplier Prices
  getCurrentSupplierPrices(supplierId?: string): Promise<SupplierPrice[]>;
  getSupplierPriceHistory(supplierId: string, productSizeId: string): Promise<SupplierPrice[]>;
  createSupplierPrice(price: InsertSupplierPrice): Promise<SupplierPrice>;
  updateSupplierPrice(supplierId: string, productSizeId: string, mediaType: string, newPrice: number, notes?: string): Promise<SupplierPrice>;
  
  // Sales
  getAllSales(startDate?: Date, endDate?: Date): Promise<Sale[]>;
  getSale(id: string): Promise<Sale | undefined>;
  createSale(sale: InsertSale): Promise<Sale>;
  updateSale(id: string, updates: Partial<Sale>): Promise<Sale | undefined>;
  deleteSale(id: string): Promise<boolean>;
  getSalesByChannel(channelId: string): Promise<Sale[]>;
  getSalesByPhoto(photoId: string): Promise<Sale[]>;
  getRecentSales(limit?: number): Promise<Array<{
    id: string;
    photoTitle: string | null;
    soldPrice: number;
    saleDate: string;
    channelName: string;
    buyerName: string | null;
  }>>;
  
  // Orders (multi-item purchases)
  getAllOrders(startDate?: Date, endDate?: Date): Promise<Order[]>;
  getOrder(id: string): Promise<Order | undefined>;
  getOrderWithItems(id: string): Promise<(Order & { items: OrderItem[] }) | undefined>;
  createOrder(order: InsertOrder, items: InsertOrderItem[]): Promise<Order>;
  updateOrder(id: string, updates: Partial<Order>): Promise<Order | undefined>;
  deleteOrder(id: string): Promise<boolean>;
  
  // Inventory Items
  getAllInventoryItems(status?: string): Promise<InventoryItem[]>;
  getInventoryItem(id: string): Promise<InventoryItem | undefined>;
  createInventoryItem(item: InsertInventoryItem): Promise<InventoryItem>;
  updateInventoryItem(id: string, updates: Partial<InventoryItem>): Promise<InventoryItem | undefined>;
  deleteInventoryItem(id: string): Promise<boolean>;
  getInventoryByPhoto(photoId: string): Promise<InventoryItem[]>;
  getInventoryWithDetails(): Promise<Array<InventoryItem & { productTitle?: string; photoImageUrl?: string; sizeLabel?: string }>>;
  
  // Drop Ship Orders
  getAllDropShipOrders(status?: string): Promise<DropShipOrder[]>;
  getDropShipOrder(id: string): Promise<DropShipOrder | undefined>;
  createDropShipOrder(order: InsertDropShipOrder): Promise<DropShipOrder>;
  updateDropShipOrder(id: string, updates: Partial<DropShipOrder>): Promise<DropShipOrder | undefined>;
  deleteDropShipOrder(id: string): Promise<boolean>;
  getDropShipOrdersBySale(saleId: string): Promise<DropShipOrder[]>;
  
  // Expense Categories
  getAllExpenseCategories(): Promise<ExpenseCategory[]>;
  getExpenseCategory(id: string): Promise<ExpenseCategory | undefined>;
  createExpenseCategory(category: InsertExpenseCategory): Promise<ExpenseCategory>;
  updateExpenseCategory(id: string, updates: Partial<ExpenseCategory>): Promise<ExpenseCategory | undefined>;
  deleteExpenseCategory(id: string): Promise<boolean>;
  
  // Expenses
  getAllExpenses(startDate?: Date, endDate?: Date): Promise<ExpenseWithCategory[]>;
  getExpense(id: string): Promise<ExpenseWithCategory | undefined>;
  createExpense(expense: InsertExpense): Promise<Expense>;
  updateExpense(id: string, updates: Partial<Expense>): Promise<Expense | undefined>;
  deleteExpense(id: string): Promise<boolean>;
  getExpensesByCategory(categoryId: string): Promise<ExpenseWithCategory[]>;
  getExpensesByVendor(vendor: string): Promise<ExpenseWithCategory[]>;
}

export class MemStorage implements IStorage {
  private photos: Map<string, Photo>;
  private votes: Map<string, Vote>;
  private settings: Settings;
  private voterSessions: Set<string>;

  constructor() {
    this.photos = new Map();
    this.votes = new Map();
    this.voterSessions = new Set();
    this.settings = {
      id: "main",
      purchaseEnabled: false,
      defaultPurchaseUrl: "https://www.chrismcnulty.net/store",
      adminPassword: "BradyBunch12!",
      mfaPhoneNumber: "+16179809810",
      contestSignupText: "Join our monthly photo contest! The person who votes the most wins a free print of their choice.",
      supportEmail: "support@cascadiaoceanic.com",
      privacyPolicyUrl: "/privacy",
      termsOfServiceUrl: "/terms",
      consentCopyLong: "By registering, you agree to receive updates, tips, and offers from Christopher F. McNulty (Chris) and Cascadia Oceanic LLC. You can unsubscribe anytime via the link in our emails or by contacting privacy@chrismcnulty.net. We do not sell your information. See our Privacy Policy: https://www.chrismcnulty.net/privacy",
      consentCopyShort: "I agree to receive updates from Christopher F. McNulty (Chris) & Cascadia Oceanic LLC and accept the Privacy Policy.",
      newsSource: "internal",
      rssUrl: "https://www.chrismcnulty.net/feed",
      rssTag: "photography",
      rssDaysLimit: 90,
      rssMaxItems: 3,
      rssEnabled: false,
      userLoginEnabledDev: true, // ON in development for testing
      userLoginEnabledProd: false, // OFF in production until ready
      monthlyContestText: "Enter our monthly photo contest! Top voters win prizes.",
      quarterlyContestText: "Join our quarterly championship for bigger rewards!",
      monthlyContestEnabled: false,
      monthlyContestStartDate: null,
      monthlyContestEndDate: null,
      quarterlyContestEnabled: false,
      quarterlyContestStartDate: null,
      quarterlyContestEndDate: null,
      announcementEnabled: false,
      announcementText: null,
      announcementType: "info",
      pairsEnabled: false,
      pairsMinInterval: 10,
      pairsMaxInterval: 15
    };
    
    // Initialize with sample photos (using stock photo URLs)
    this.initializePhotos();
  }

  // Collections implementation stubs (not used in MemStorage)
  async getAllCollections(): Promise<Collection[]> { return []; }
  async getCollection(id: string): Promise<Collection | undefined> { return undefined; }
  async createCollection(collection: InsertCollection): Promise<Collection> { 
    throw new Error('Collections not implemented in MemStorage');
  }
  async updateCollection(id: string, updates: Partial<Collection>): Promise<Collection | undefined> { 
    return undefined; 
  }
  async deleteCollection(id: string): Promise<boolean> { return false; }

  // New methods for enhanced analytics
  async getPhotoCategories(): Promise<string[]> { 
    const uniqueCategories = new Set<string>();
    this.photos.forEach(photo => {
      if (photo.category) uniqueCategories.add(photo.category);
    });
    return Array.from(uniqueCategories);
  }
  
  async getAllPhotosWithStats(category?: string): Promise<Photo[]> {
    let filteredPhotos = Array.from(this.photos.values());
    if (category) {
      filteredPhotos = filteredPhotos.filter(photo => photo.category === category);
    }
    return filteredPhotos;
  }

  private initializePhotos() {
    const samplePhotos = [
      {
        title: "Mountain Vista",
        description: "Dramatic landscape captured in the Pacific Northwest",
        imageUrl: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=600",
      },
      {
        title: "Abstract Flow",
        description: "Contemporary abstract composition with dynamic movement",
        imageUrl: "https://images.unsplash.com/photo-1541961017774-22349e4a1262?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=600",
      },
      {
        title: "Forest Depths",
        description: "Misty forest scene with ethereal lighting",
        imageUrl: "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=600",
      },
      {
        title: "Ocean Reflection",
        description: "Serene coastal waters reflecting the sky",
        imageUrl: "https://images.unsplash.com/photo-1505142468610-359e7d316be0?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=600",
      },
      {
        title: "Urban Geometry",
        description: "Modern architectural abstractions",
        imageUrl: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=600",
      },
      {
        title: "Desert Minimalism",
        description: "Clean lines and vast desert spaces",
        imageUrl: "https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=600",
      },
      {
        title: "Gallery Exhibition",
        description: "Contemporary art installation in modern space",
        imageUrl: "https://images.unsplash.com/photo-1544967919-1e2a3b0e48b1?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=600",
      },
      {
        title: "Light Studies",
        description: "Experimental photography exploring natural light",
        imageUrl: "https://images.unsplash.com/photo-1578662996442-48f60103fc96?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=600",
      },
      {
        title: "Cascadia Wilderness",
        description: "Untamed beauty of the Pacific Northwest",
        imageUrl: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=600",
      },
      {
        title: "Color Studies",
        description: "Vibrant abstract color compositions",
        imageUrl: "https://images.unsplash.com/photo-1557804506-669a67965ba0?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=600",
      },
    ];

    samplePhotos.forEach((photoData) => {
      const id = randomUUID();
      const photo: Photo = {
        id,
        title: photoData.title,
        description: photoData.description,
        imageUrl: photoData.imageUrl,
        collectionId: null,
        category: "General",
        createdAt: new Date().toISOString(),
        votes: 0,
        wins: 0,
        comparisons: 0,
        hidden: false,
        archived: false,
        neverForSale: false,
        customPurchaseUrl: null,
      };
      this.photos.set(id, photo);
    });
  }

  async getAllPhotos(collectionId?: string): Promise<Photo[]> {
    return Array.from(this.photos.values());
  }

  async getPhoto(id: string): Promise<Photo | undefined> {
    return this.photos.get(id);
  }

  async createPhoto(insertPhoto: InsertPhoto): Promise<Photo> {
    const id = randomUUID();
    const photo: Photo = {
      ...insertPhoto,
      id,
      collectionId: insertPhoto.collectionId || null,
      category: insertPhoto.category || "General",
      createdAt: new Date().toISOString(),
      votes: 0,
      wins: 0,
      comparisons: 0,
      hidden: false,
      archived: false,
      neverForSale: false,
      description: insertPhoto.description || null,
      customPurchaseUrl: insertPhoto.customPurchaseUrl || null,
    };
    this.photos.set(id, photo);
    return photo;
  }

  async updatePhoto(id: string, updates: Partial<Photo>): Promise<Photo | undefined> {
    const photo = this.photos.get(id);
    if (!photo) return undefined;
    
    const updatedPhoto = { ...photo, ...updates };
    this.photos.set(id, updatedPhoto);
    return updatedPhoto;
  }

  async createVote(insertVote: InsertVote): Promise<Vote> {
    const id = randomUUID();
    const sessionId = `session_${Date.now()}_${Math.random()}`;
    this.voterSessions.add(sessionId);
    
    const vote: Vote = {
      id,
      photoId: insertVote.photoId,
      winnerPhotoId: insertVote.winnerPhotoId || insertVote.photoId,
      loserPhotoId: insertVote.loserPhotoId || insertVote.photoId,
      voterType: insertVote.voterType || "user",
      userId: insertVote.userId || null,
      timestamp: new Date().toISOString(),
    };
    this.votes.set(id, vote);
    
    // Update photo stats
    const photo = this.photos.get(insertVote.photoId);
    if (photo) {
      photo.votes += 1;
      this.photos.set(insertVote.photoId, photo);
    }
    
    return vote;
  }

  async getTotalVotes(startDate?: string, endDate?: string): Promise<number> {
    if (!startDate && !endDate) {
      return this.votes.size;
    }
    
    const votes = Array.from(this.votes.values());
    const filtered = votes.filter(vote => {
      const voteDate = new Date(vote.timestamp);
      const start = startDate ? new Date(startDate) : new Date(0);
      const end = endDate ? new Date(endDate) : new Date();
      return voteDate >= start && voteDate <= end;
    });
    
    return filtered.length;
  }

  async getUniqueVoters(startDate?: string, endDate?: string): Promise<number> {
    if (!startDate && !endDate) {
      return this.voterSessions.size;
    }
    
    // For in-memory storage, we'll approximate unique voters by counting votes in date range
    // In a real database, this would track actual unique session IDs
    return Math.ceil((await this.getTotalVotes(startDate, endDate)) * 0.8);
  }

  async getVotesByDateRange(startDate?: string, endDate?: string): Promise<Vote[]> {
    const votes = Array.from(this.votes.values());
    
    if (!startDate && !endDate) {
      return votes;
    }
    
    return votes.filter(vote => {
      const voteDate = new Date(vote.timestamp);
      const start = startDate ? new Date(startDate) : new Date(0);
      const end = endDate ? new Date(endDate) : new Date();
      return voteDate >= start && voteDate <= end;
    });
  }

  async getSettings(): Promise<Settings> {
    return this.settings;
  }

  async updateSettings(newSettings: InsertSettings): Promise<Settings> {
    this.settings = { ...this.settings, ...newSettings };
    return this.settings;
  }

  async getPhotoStats(startDate?: string, endDate?: string): Promise<Photo[]> {
    const photos = Array.from(this.photos.values());
    
    if (!startDate && !endDate) {
      return photos.sort((a, b) => {
        const aWinRate = a.comparisons > 0 ? (a.wins / a.comparisons) : 0;
        const bWinRate = b.comparisons > 0 ? (b.wins / b.comparisons) : 0;
        return bWinRate - aWinRate || b.votes - a.votes;
      });
    }
    
    // For date-filtered stats, we need to recalculate stats based on votes in that period
    const votesInRange = await this.getVotesByDateRange(startDate, endDate);
    const photoStats = new Map<string, { votes: number; wins: number; comparisons: number }>();
    
    // Initialize stats for all photos
    photos.forEach(photo => {
      photoStats.set(photo.id, { votes: 0, wins: 0, comparisons: 0 });
    });
    
    // Count stats from votes in date range
    votesInRange.forEach(vote => {
      const photoStat = photoStats.get(vote.photoId);
      if (photoStat) {
        photoStat.votes += 1;
      }
    });
    
    // Return photos with recalculated stats for the date range
    return photos.map(photo => {
      const stats = photoStats.get(photo.id) || { votes: 0, wins: 0, comparisons: 0 };
      return {
        ...photo,
        votes: stats.votes,
        wins: stats.wins,
        comparisons: stats.comparisons
      };
    }).sort((a, b) => {
      const aWinRate = a.comparisons > 0 ? (a.wins / a.comparisons) : 0;
      const bWinRate = b.comparisons > 0 ? (b.wins / b.comparisons) : 0;
      return bWinRate - aWinRate || b.votes - a.votes;
    });
  }

  async getRandomPhotoPair(): Promise<[Photo, Photo] | null> {
    const visiblePhotos = Array.from(this.photos.values()).filter(photo => !photo.hidden);
    if (visiblePhotos.length < 2) return null;
    
    // Get the most recent vote to find the last pair shown
    const allVotes = Array.from(this.votes.values());
    const lastVote = allVotes
      .filter(vote => vote.winnerPhotoId && vote.loserPhotoId)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];

    // Get the IDs of photos from the last pair to exclude them
    const excludedPhotoIds = new Set<string>();
    if (lastVote && lastVote.winnerPhotoId && lastVote.loserPhotoId) {
      excludedPhotoIds.add(lastVote.winnerPhotoId);
      excludedPhotoIds.add(lastVote.loserPhotoId);
      console.log(`Excluding last pair from selection: ${lastVote.winnerPhotoId} and ${lastVote.loserPhotoId}`);
    }

    // Filter out photos that were in the last pair
    const eligiblePhotos = visiblePhotos.filter(photo => !excludedPhotoIds.has(photo.id));
    
    // If we don't have enough eligible photos, fall back to all photos
    const photosToUse = eligiblePhotos.length >= 2 ? eligiblePhotos : visiblePhotos;
    
    // Try to find a valid pair (with maximum attempts to prevent infinite loops)
    const maxAttempts = 50;
    let attempts = 0;
    
    while (attempts < maxAttempts) {
      // Shuffle and pick two different photos
      const shuffled = [...photosToUse].sort(() => Math.random() - 0.5);
      const photo1 = shuffled[0];
      const photo2 = shuffled[1];
      
      // Rule 1: Ensure photos are different
      if (photo1.id === photo2.id) {
        attempts++;
        continue;
      }
      
      // Rule 2: If using eligible photos, ensure neither was in the last pair
      if (photosToUse === eligiblePhotos || !excludedPhotoIds.has(photo1.id) && !excludedPhotoIds.has(photo2.id)) {
        console.log(`Selected new photo pair: ${photo1.id} vs ${photo2.id} (attempt ${attempts + 1})`);
        return [photo1, photo2];
      }
      
      attempts++;
    }

    // Fallback: pick any two different photos
    console.log(`Warning: Could not find non-consecutive photo pair after ${maxAttempts} attempts. Using fallback selection.`);
    
    // Ensure the fallback pair has different photos
    for (let i = 0; i < visiblePhotos.length; i++) {
      for (let j = i + 1; j < visiblePhotos.length; j++) {
        if (visiblePhotos[i].id !== visiblePhotos[j].id) {
          return [visiblePhotos[i], visiblePhotos[j]];
        }
      }
    }
    
    return null;
  }

  async recordComparison(winnerPhotoId: string, loserPhotoId: string): Promise<void> {
    const winner = this.photos.get(winnerPhotoId);
    const loser = this.photos.get(loserPhotoId);
    
    if (winner) {
      winner.wins += 1;
      winner.comparisons += 1;
      this.photos.set(winnerPhotoId, winner);
    }
    
    if (loser) {
      loser.comparisons += 1;
      this.photos.set(loserPhotoId, loser);
    }
  }

  async deletePhoto(id: string): Promise<boolean> {
    return this.photos.delete(id);
  }

  async updatePhotosCategory(photoIds: string[], category: string): Promise<boolean> {
    let updated = 0;
    photoIds.forEach(id => {
      const photo = this.photos.get(id);
      if (photo) {
        photo.category = category;
        this.photos.set(id, photo);
        updated++;
      }
    });
    return updated > 0;
  }

  async updatePhotosSaleStatus(photoIds: string[], neverForSale: boolean): Promise<boolean> {
    let updated = 0;
    photoIds.forEach(id => {
      const photo = this.photos.get(id);
      if (photo) {
        photo.neverForSale = neverForSale;
        this.photos.set(id, photo);
        updated++;
      }
    });
    return updated > 0;
  }

  async purgeTestData(beforeDate: string): Promise<{ votesDeleted: number; photosReset: boolean }> {
    const cutoffDate = new Date(beforeDate);
    const votes = Array.from(this.votes.entries());
    let votesDeleted = 0;
    
    // Delete votes before the cutoff date
    votes.forEach(([id, vote]) => {
      if (new Date(vote.timestamp) < cutoffDate) {
        this.votes.delete(id);
        votesDeleted++;
      }
    });
    
    // Reset photo statistics (wins, votes, comparisons) to 0
    this.photos.forEach(photo => {
      photo.votes = 0;
      photo.wins = 0;
      photo.comparisons = 0;
    });
    
    // Reset voter sessions
    this.voterSessions.clear();
    
    return { votesDeleted, photosReset: true };
  }

  async getTopPhotosByVotes(limit: number = 10): Promise<Photo[]> {
    const allPhotos = Array.from(this.photos.values());
    return allPhotos
      .filter(photo => !photo.hidden)
      .sort((a, b) => b.votes - a.votes)
      .slice(0, limit);
  }

  async getTopPhotosByWins(limit: number = 10): Promise<Photo[]> {
    const allPhotos = Array.from(this.photos.values());
    return allPhotos
      .filter(photo => !photo.hidden)
      .sort((a, b) => b.wins - a.wins)
      .slice(0, limit);
  }

  async getUserVotedPhotos(userId: string, limit: number = 10, sortBy: 'votes' | 'wins' = 'votes'): Promise<Photo[]> {
    // In memory storage, we'll return top photos since we don't track user-specific voting
    // This is a placeholder implementation
    if (sortBy === 'wins') {
      return this.getTopPhotosByWins(limit);
    } else {
      return this.getTopPhotosByVotes(limit);
    }
  }

  // Stub implementations for pairs functionality in MemStorage
  async createPhotoPair(pair: InsertPhotoPair): Promise<PhotoPair> {
    throw new Error("Pairs functionality not implemented in MemStorage");
  }

  async getAllPhotoPairs(): Promise<PhotoPair[]> {
    return [];
  }

  async checkIfPairVote(photo1Id: string, photo2Id: string): Promise<boolean> {
    return false;
  }

  async findPairByPhotos(photo1Id: string, photo2Id: string): Promise<PhotoPair | undefined> {
    return undefined;
  }

  async getPhotoPair(id: string): Promise<PhotoPair | undefined> {
    return undefined;
  }

  async deletePhotoPair(id: string): Promise<boolean> {
    return false;
  }

  async getPhotoPartnerships(photoId: string): Promise<PhotoPair[]> {
    return [];
  }

  async createPairVote(vote: InsertPairVote): Promise<PairVote> {
    throw new Error("Pairs functionality not implemented in MemStorage");
  }

  async getPairVoteStats(pairId: string): Promise<{ photo1Wins: number; photo2Wins: number; totalVotes: number }> {
    return { photo1Wins: 0, photo2Wins: 0, totalVotes: 0 };
  }

  async getPhotoPerformanceInPairs(photoId: string): Promise<{ wins: number; losses: number; winRate: number }> {
    return { wins: 0, losses: 0, winRate: 0 };
  }

  async checkForPairDisplay(): Promise<[Photo, Photo] | null> {
    return null;
  }

  async archivePhoto(id: string): Promise<boolean> {
    const photo = this.photos.get(id);
    if (!photo) return false;
    photo.archived = true;
    return true;
  }

  // Product stub implementations for MemStorage
  async getAllProducts(): Promise<Product[]> { return []; }
  async getProduct(id: string): Promise<Product | undefined> { return undefined; }
  async createProduct(product: InsertProduct): Promise<Product> { throw new Error('Not implemented in MemStorage'); }
  async updateProduct(id: string, updates: Partial<Product>): Promise<Product | undefined> { return undefined; }
  async deleteProduct(id: string): Promise<boolean> { return false; }
  async getProductsByPhoto(photoId: string): Promise<Product[]> { return []; }
  
  async getProductVariants(productId: string): Promise<ProductVariant[]> { return []; }
  async createProductVariant(variant: InsertProductVariant): Promise<ProductVariant> { throw new Error('Not implemented in MemStorage'); }
  async updateProductVariant(id: string, updates: Partial<ProductVariant>): Promise<ProductVariant | undefined> { return undefined; }
  async deleteProductVariant(id: string): Promise<boolean> { return false; }
  
  async getAllProductSKUs(): Promise<ProductSKU[]> { return []; }
  async getAllProductSKUsWithDetails(): Promise<Array<ProductSKU & { productTitle: string; productExternalId: string | null; sizeLabel: string }>> { return []; }
  async getProductSKU(id: string): Promise<ProductSKU | undefined> { return undefined; }
  async createProductSKU(sku: InsertProductSKU): Promise<ProductSKU> { throw new Error('Not implemented in MemStorage'); }
  async updateProductSKU(id: string, updates: Partial<ProductSKU>): Promise<ProductSKU | undefined> { return undefined; }
  async deleteProductSKU(id: string): Promise<boolean> { return false; }
  async getProductSKUsByProduct(productId: string): Promise<ProductSKU[]> { return []; }
  
  async getAllChannelSKUs(): Promise<ChannelSKU[]> { return []; }
  async getChannelSKU(id: string): Promise<ChannelSKU | undefined> { return undefined; }
  async getChannelSKUs(masterSKUId: string): Promise<ChannelSKU[]> { return []; }
  async getChannelSKUsByMaster(masterSKUId: string): Promise<ChannelSKU[]> { return []; }
  async createChannelSKU(sku: InsertChannelSKU): Promise<ChannelSKU> { throw new Error('Not implemented in MemStorage'); }
  async updateChannelSKU(id: string, updates: Partial<ChannelSKU>): Promise<ChannelSKU | undefined> { return undefined; }
  async deleteChannelSKU(id: string): Promise<boolean> { return false; }
  
  async getRetailPrices(productSizeId: string, mediaType: string): Promise<RetailPrice[]> { return []; }
  async getCurrentRetailPrice(productSizeId: string, mediaType: string): Promise<RetailPrice | undefined> { return undefined; }
  async createRetailPrice(price: InsertRetailPrice): Promise<RetailPrice> { throw new Error('Not implemented in MemStorage'); }
  async updateRetailPrice(id: string, updates: Partial<RetailPrice>): Promise<RetailPrice | undefined> { return undefined; }
  async setRetailPrice(productSizeId: string, mediaType: string, newPrice: number, notes?: string): Promise<RetailPrice> { throw new Error('Not implemented in MemStorage'); }

  // Inventory stub implementations for MemStorage
  async getAllSalesChannels(): Promise<SalesChannel[]> { return []; }
  async getSalesChannel(id: string): Promise<SalesChannel | undefined> { return undefined; }
  async createSalesChannel(channel: InsertSalesChannel): Promise<SalesChannel> { throw new Error('Not implemented in MemStorage'); }
  async updateSalesChannel(id: string, updates: Partial<SalesChannel>): Promise<SalesChannel | undefined> { return undefined; }
  async deleteSalesChannel(id: string): Promise<boolean> { return false; }
  
  async getAllSuppliers(): Promise<Supplier[]> { return []; }
  async getSupplier(id: string): Promise<Supplier | undefined> { return undefined; }
  async createSupplier(supplier: InsertSupplier): Promise<Supplier> { throw new Error('Not implemented in MemStorage'); }
  async updateSupplier(id: string, updates: Partial<Supplier>): Promise<Supplier | undefined> { return undefined; }
  async deleteSupplier(id: string): Promise<boolean> { return false; }
  
  async getAllProductSizes(): Promise<ProductSize[]> { return []; }
  async getProductSize(id: string): Promise<ProductSize | undefined> { return undefined; }
  async createProductSize(size: InsertProductSize): Promise<ProductSize> { throw new Error('Not implemented in MemStorage'); }
  async updateProductSize(id: string, updates: Partial<ProductSize>): Promise<ProductSize | undefined> { return undefined; }
  async deleteProductSize(id: string): Promise<boolean> { return false; }
  async getProductSizesWithPricing(): Promise<Array<{
    size: ProductSize;
    mediaType: string;
    avgSupplierCost: number | null;
    retailPrice: number | null;
    marginPercent: number | null;
  }>> { return []; }
  
  async getCurrentSupplierPrices(supplierId?: string): Promise<SupplierPrice[]> { return []; }
  async getSupplierPriceHistory(supplierId: string, productSizeId: string): Promise<SupplierPrice[]> { return []; }
  async createSupplierPrice(price: InsertSupplierPrice): Promise<SupplierPrice> { throw new Error('Not implemented in MemStorage'); }
  async updateSupplierPrice(supplierId: string, productSizeId: string, mediaType: string, newPrice: number, notes?: string): Promise<SupplierPrice> { throw new Error('Not implemented in MemStorage'); }
  
  async getAllSales(startDate?: Date, endDate?: Date): Promise<Sale[]> { return []; }
  async getSale(id: string): Promise<Sale | undefined> { return undefined; }
  async createSale(sale: InsertSale): Promise<Sale> { throw new Error('Not implemented in MemStorage'); }
  async updateSale(id: string, updates: Partial<Sale>): Promise<Sale | undefined> { return undefined; }
  async deleteSale(id: string): Promise<boolean> { return false; }
  async getSalesByChannel(channelId: string): Promise<Sale[]> { return []; }
  async getSalesByPhoto(photoId: string): Promise<Sale[]> { return []; }
  async getRecentSales(limit: number = 5): Promise<Array<{
    id: string;
    photoTitle: string | null;
    soldPrice: number;
    saleDate: string;
    channelName: string;
    buyerName: string | null;
  }>> { return []; }
  
  async getAllOrders(startDate?: Date, endDate?: Date): Promise<Order[]> { return []; }
  async getOrder(id: string): Promise<Order | undefined> { return undefined; }
  async getOrderWithItems(id: string): Promise<(Order & { items: OrderItem[] }) | undefined> { return undefined; }
  async createOrder(order: InsertOrder, items: InsertOrderItem[]): Promise<Order> { throw new Error('Not implemented in MemStorage'); }
  async updateOrder(id: string, updates: Partial<Order>): Promise<Order | undefined> { return undefined; }
  async deleteOrder(id: string): Promise<boolean> { return false; }
  
  async getAllInventoryItems(status?: string): Promise<InventoryItem[]> { return []; }
  async getInventoryItem(id: string): Promise<InventoryItem | undefined> { return undefined; }
  async createInventoryItem(item: InsertInventoryItem): Promise<InventoryItem> { throw new Error('Not implemented in MemStorage'); }
  async updateInventoryItem(id: string, updates: Partial<InventoryItem>): Promise<InventoryItem | undefined> { return undefined; }
  async deleteInventoryItem(id: string): Promise<boolean> { return false; }
  async getInventoryByPhoto(photoId: string): Promise<InventoryItem[]> { return []; }
  async getInventoryWithDetails(): Promise<Array<InventoryItem & { productTitle?: string; photoImageUrl?: string; sizeLabel?: string }>> { return []; }
  
  async getAllDropShipOrders(status?: string): Promise<DropShipOrder[]> { return []; }
  async getDropShipOrder(id: string): Promise<DropShipOrder | undefined> { return undefined; }
  async createDropShipOrder(order: InsertDropShipOrder): Promise<DropShipOrder> { throw new Error('Not implemented in MemStorage'); }
  async updateDropShipOrder(id: string, updates: Partial<DropShipOrder>): Promise<DropShipOrder | undefined> { return undefined; }
  async deleteDropShipOrder(id: string): Promise<boolean> { return false; }
  async getDropShipOrdersBySale(saleId: string): Promise<DropShipOrder[]> { return []; }
  
  async getAllExpenseCategories(): Promise<ExpenseCategory[]> { return []; }
  async getExpenseCategory(id: string): Promise<ExpenseCategory | undefined> { return undefined; }
  async createExpenseCategory(category: InsertExpenseCategory): Promise<ExpenseCategory> { throw new Error('Not implemented in MemStorage'); }
  async updateExpenseCategory(id: string, updates: Partial<ExpenseCategory>): Promise<ExpenseCategory | undefined> { return undefined; }
  async deleteExpenseCategory(id: string): Promise<boolean> { return false; }
  
  async getAllExpenses(startDate?: Date, endDate?: Date): Promise<ExpenseWithCategory[]> { return []; }
  async getExpense(id: string): Promise<ExpenseWithCategory | undefined> { return undefined; }
  async createExpense(expense: InsertExpense): Promise<Expense> { throw new Error('Not implemented in MemStorage'); }
  async updateExpense(id: string, updates: Partial<Expense>): Promise<Expense | undefined> { return undefined; }
  async deleteExpense(id: string): Promise<boolean> { return false; }
  async getExpensesByCategory(categoryId: string): Promise<ExpenseWithCategory[]> { return []; }
  async getExpensesByVendor(vendor: string): Promise<ExpenseWithCategory[]> { return []; }
}

// DatabaseStorage implementation
export class DatabaseStorage implements IStorage {
  // Collections methods
  async getAllCollections(): Promise<Collection[]> {
    return await db.select().from(collections);
  }

  async getCollection(id: string): Promise<Collection | undefined> {
    const [collection] = await db.select().from(collections).where(eq(collections.id, id));
    return collection || undefined;
  }

  async createCollection(insertCollection: InsertCollection): Promise<Collection> {
    const [collection] = await db.insert(collections).values(insertCollection).returning();
    return collection;
  }

  async updateCollection(id: string, updates: Partial<Collection>): Promise<Collection | undefined> {
    const [collection] = await db.update(collections)
      .set(updates)
      .where(eq(collections.id, id))
      .returning();
    return collection || undefined;
  }

  async deleteCollection(id: string): Promise<boolean> {
    const result = await db.delete(collections).where(eq(collections.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  async getAllPhotos(collectionId?: string): Promise<Photo[]> {
    try {
      console.log('DatabaseStorage: Starting getAllPhotos query...');
      const result = await db.select().from(photos);
      console.log(`DatabaseStorage: Successfully retrieved ${result.length} photos`);
      return result;
    } catch (error) {
      console.error('DatabaseStorage: Error in getAllPhotos:', error);
      throw error;
    }
  }

  async getPhoto(id: string): Promise<Photo | undefined> {
    const [photo] = await db.select().from(photos).where(eq(photos.id, id));
    return photo || undefined;
  }

  async createPhoto(insertPhoto: InsertPhoto): Promise<Photo> {
    const id = randomUUID();
    const photoData = {
      ...insertPhoto,
      id,
      votes: 0,
      wins: 0,
      comparisons: 0,
      hidden: false,
    };

    const [photo] = await db.insert(photos).values(photoData).returning();
    return photo;
  }

  async updatePhoto(id: string, updates: Partial<Photo>): Promise<Photo | undefined> {
    const [photo] = await db
      .update(photos)
      .set(updates)
      .where(eq(photos.id, id))
      .returning();
    return photo || undefined;
  }

  async createVote(insertVote: InsertVote): Promise<Vote> {
    const id = randomUUID();
    const vote = {
      id,
      photoId: insertVote.photoId,
      winnerPhotoId: insertVote.winnerPhotoId || insertVote.photoId,
      loserPhotoId: insertVote.loserPhotoId || insertVote.photoId,
      voterType: insertVote.voterType || "user",
      userId: insertVote.userId || null,
      timestamp: new Date().toISOString(),
    };

    const [savedVote] = await db.insert(votes).values(vote).returning();
    
    // Update photo vote count
    await db
      .update(photos)
      .set({ votes: sql`${photos.votes} + 1` })
      .where(eq(photos.id, insertVote.photoId));

    return savedVote;
  }



  async getSettings(): Promise<Settings> {
    const [setting] = await db.select().from(settings).limit(1);
    
    if (!setting) {
      // Create default settings
      const defaultSettings = {
        id: "default",
        purchaseEnabled: true,
        defaultPurchaseUrl: "https://chrismcnulty.net/store",
        adminPassword: "BradyBunch12!",
        mfaPhoneNumber: "+16179809810",
        contestSignupText: "Join our monthly photo contest! The person who votes the most wins a free print of their choice.",
        supportEmail: "support@cascadiaoceanic.com",
        privacyPolicyUrl: "/privacy",
        termsOfServiceUrl: "/terms",
        userLoginEnabledDev: true,
        userLoginEnabledProd: false,
      };
      
      const [newSetting] = await db.insert(settings).values(defaultSettings).returning();
      return newSetting;
    }
    
    return setting;
  }

  async updateSettings(insertSettings: InsertSettings): Promise<Settings> {
    const existingSettings = await this.getSettings();
    
    const [updated] = await db
      .update(settings)
      .set(insertSettings)
      .where(eq(settings.id, existingSettings.id))
      .returning();
      
    return updated;
  }



  async getRandomPhotoPair(collectionId?: string): Promise<[Photo, Photo] | null> {
    // First check if we should show a predefined pair vs regular random photos
    const settings = await this.getSettings();
    
    if (settings.pairsEnabled) {
      // Simple counter-based approach
      // Use session-based tracking or a simple modulo of recent votes
      const [totalVotesResult] = await db
        .select({ count: sql<number>`count(*)` })
        .from(votes);
      
      const totalVotes = totalVotesResult?.count || 0;
      const minInterval = settings.pairsMinInterval || 2;
      const maxInterval = settings.pairsMaxInterval || 4;
      
      // Use a simple deterministic approach with some randomness
      // Show pairs every N votes where N varies between min and max
      const interval = minInterval + (Math.floor(totalVotes / 10) % (maxInterval - minInterval + 1));
      const shouldShow = totalVotes > 0 && (totalVotes % interval) === 0;
      
      // Track votes since last pair to determine when to show next pair
      const [lastPairVoteResult] = await db
        .select({ timestamp: pairVotes.timestamp })
        .from(pairVotes)
        .orderBy(sql`${pairVotes.timestamp} DESC`)
        .limit(1);
      
      let votesSinceLastPair = 0;
      if (lastPairVoteResult?.timestamp) {
        const [countResult] = await db
          .select({ count: sql<number>`count(*)` })
          .from(votes)
          .where(sql`${votes.timestamp} > ${lastPairVoteResult.timestamp}`);
        votesSinceLastPair = countResult?.count || 0;
      } else {
        // No pairs shown yet, use a small number to trigger first pair
        votesSinceLastPair = 3;
      }
      
      // Show a pair if we've had enough votes since the last pair
      const finalShouldShow = votesSinceLastPair >= minInterval;
      
      console.log(`Pair decision: votesSinceLastPair=${votesSinceLastPair}, minInterval=${minInterval}, shouldShow=${finalShouldShow}`);
      
      if (finalShouldShow) {
        const pairResult = await this.checkForPairDisplay();
        if (pairResult) {
          console.log(`Showing predefined photo pair! (${votesSinceLastPair} votes since last pair)`);
          return pairResult;
        } else {
          console.log(`Pairs enabled but no valid pairs found to display`);
        }
      } else {
        const nextPairAt = Math.ceil(totalVotes / interval) * interval;
        console.log(`Regular photos: vote #${totalVotes}, next pair at vote #${nextPairAt} (interval: ${interval})`);
      }
    }

    // Fall back to regular random photo selection
    const availablePhotos = await db
      .select()
      .from(photos)
      .where(eq(photos.hidden, false));

    if (availablePhotos.length < 2) {
      return null;
    }

    // Get the most recent vote to find the last pair shown
    const lastVote = await db
      .select({
        winnerPhotoId: votes.winnerPhotoId,
        loserPhotoId: votes.loserPhotoId
      })
      .from(votes)
      .where(sql`${votes.winnerPhotoId} IS NOT NULL AND ${votes.loserPhotoId} IS NOT NULL`)
      .orderBy(sql`${votes.timestamp} DESC`)
      .limit(1);

    // Get the IDs of photos from the last pair to exclude them
    const excludedPhotoIds = new Set<string>();
    if (lastVote.length > 0 && lastVote[0].winnerPhotoId && lastVote[0].loserPhotoId) {
      excludedPhotoIds.add(lastVote[0].winnerPhotoId);
      excludedPhotoIds.add(lastVote[0].loserPhotoId);
      console.log(`Excluding last pair from selection: ${lastVote[0].winnerPhotoId} and ${lastVote[0].loserPhotoId}`);
    }

    // Filter out photos that were in the last pair
    const eligiblePhotos = availablePhotos.filter(photo => !excludedPhotoIds.has(photo.id));
    
    // If we don't have enough eligible photos, fall back to all photos
    const photosToUse = eligiblePhotos.length >= 2 ? eligiblePhotos : availablePhotos;
    
    // Try to find a valid pair (with maximum attempts to prevent infinite loops)
    const maxAttempts = 50;
    let attempts = 0;
    
    while (attempts < maxAttempts) {
      // Shuffle and pick two different photos
      const shuffled = [...photosToUse].sort(() => Math.random() - 0.5);
      const photo1 = shuffled[0];
      const photo2 = shuffled[1];
      
      // Rule 1: Ensure photos are different
      if (photo1.id === photo2.id) {
        attempts++;
        continue;
      }
      
      // Rule 2: If using eligible photos, ensure neither was in the last pair
      if (photosToUse === eligiblePhotos || !excludedPhotoIds.has(photo1.id) && !excludedPhotoIds.has(photo2.id)) {
        console.log(`Selected new photo pair: ${photo1.id} vs ${photo2.id} (attempt ${attempts + 1})`);
        return [photo1, photo2];
      }
      
      attempts++;
    }

    // Fallback: pick any two different photos
    console.log(`Warning: Could not find non-consecutive photo pair after ${maxAttempts} attempts. Using fallback selection.`);
    const shuffled = [...availablePhotos].sort(() => Math.random() - 0.5);
    
    // Ensure the fallback pair has different photos
    for (let i = 0; i < availablePhotos.length; i++) {
      for (let j = i + 1; j < availablePhotos.length; j++) {
        if (availablePhotos[i].id !== availablePhotos[j].id) {
          return [availablePhotos[i], availablePhotos[j]];
        }
      }
    }
    
    return null;
  }

  // New method to determine if a pair should be shown based on frequency settings
  async shouldShowPair(): Promise<boolean> {
    const settings = await this.getSettings();
    if (!settings.pairsEnabled) return false;

    // Count total votes to determine position in frequency cycle
    const totalVotesResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(votes);

    const totalVotes = totalVotesResult[0]?.count || 0;
    const minInterval = settings.pairsMinInterval || 5;
    const maxInterval = settings.pairsMaxInterval || 15;

    // Use a simpler approach: show pairs every N votes within the min/max interval
    // Generate a pseudo-random but consistent interval based on vote count
    const interval = minInterval + (totalVotes % (maxInterval - minInterval + 1));
    
    // Show a pair every 'interval' votes
    const shouldShow = totalVotes > 0 && totalVotes % interval === 0;
    
    if (shouldShow) {
      console.log(`Pair frequency triggered: vote #${totalVotes}, interval ${interval}, showing pair`);
    } else {
      // Log occasionally to debug
      if (totalVotes % 10 === 0) {
        console.log(`Pair check: vote #${totalVotes}, next pair at vote #${Math.ceil(totalVotes / interval) * interval}`);
      }
    }
    
    return shouldShow;
  }

  async getVotesByDateRange(startDate?: string, endDate?: string): Promise<Vote[]> {
    if (startDate && endDate) {
      return await db.select().from(votes).where(and(
        gte(votes.timestamp, startDate),
        lte(votes.timestamp, endDate)
      ));
    } else if (startDate) {
      return await db.select().from(votes).where(gte(votes.timestamp, startDate));
    } else if (endDate) {
      return await db.select().from(votes).where(lte(votes.timestamp, endDate));
    }
    
    return await db.select().from(votes);
  }

  async recordComparison(winnerPhotoId: string, loserPhotoId: string): Promise<void> {
    // Update winner stats
    await db
      .update(photos)
      .set({ 
        wins: sql`${photos.wins} + 1`,
        comparisons: sql`${photos.comparisons} + 1`
      })
      .where(eq(photos.id, winnerPhotoId));

    // Update loser stats (just comparisons)
    await db
      .update(photos)
      .set({ 
        comparisons: sql`${photos.comparisons} + 1`
      })
      .where(eq(photos.id, loserPhotoId));
  }

  async deletePhoto(id: string): Promise<boolean> {
    try {
      // First delete all votes related to this photo (both as winner and loser)
      await db.delete(votes).where(eq(votes.photoId, id));
      await db.delete(votes).where(eq(votes.winnerPhotoId, id));  
      await db.delete(votes).where(eq(votes.loserPhotoId, id));
      
      // Then delete the photo itself
      const [deleted] = await db.delete(photos).where(eq(photos.id, id)).returning();
      return !!deleted;
    } catch (error) {
      console.error('Delete photo error:', error);
      return false;
    }
  }

  async updatePhotosCategory(photoIds: string[], category: string): Promise<boolean> {
    try {
      console.log(`DatabaseStorage: Updating categories for ${photoIds.length} photos to "${category}"`);
      const result = await db
        .update(photos)
        .set({ category })
        .where(inArray(photos.id, photoIds));
      console.log(`DatabaseStorage: Update result:`, result);
      return result.rowCount ? result.rowCount > 0 : false;
    } catch (error) {
      console.error('DatabaseStorage: Error updating photo categories:', error);
      return false;
    }
  }

  async updatePhotosSaleStatus(photoIds: string[], neverForSale: boolean): Promise<boolean> {
    try {
      console.log(`DatabaseStorage: Updating sale status for ${photoIds.length} photos to "${neverForSale ? 'not for sale' : 'for sale'}"`);
      const result = await db
        .update(photos)
        .set({ neverForSale })
        .where(inArray(photos.id, photoIds));
      console.log(`DatabaseStorage: Update result:`, result);
      return result.rowCount ? result.rowCount > 0 : false;
    } catch (error) {
      console.error('DatabaseStorage: Error updating photo sale status:', error);
      return false;
    }
  }

  async purgeTestData(beforeDate: string): Promise<{ votesDeleted: number; photosReset: boolean }> {
    const cutoffDate = new Date(beforeDate);
    const cutoffIso = cutoffDate.toISOString();
    
    // Count votes to be deleted
    const [voteCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(votes)
      .where(lte(votes.timestamp, cutoffIso));
    
    // Delete votes before the cutoff date
    await db.delete(votes).where(lte(votes.timestamp, cutoffIso));
    
    // Reset photo statistics
    await db.update(photos).set({
      votes: 0,
      wins: 0,
      comparisons: 0
    });
    
    return { votesDeleted: voteCount.count, photosReset: true };
  }

  // New methods for enhanced analytics
  async getPhotoCategories(): Promise<string[]> {
    const result = await db.select({ category: photos.category }).from(photos).groupBy(photos.category);
    return result.map(row => row.category).filter(Boolean);
  }

  async getAllPhotosWithStats(category?: string): Promise<Photo[]> {
    if (category) {
      return await db.select().from(photos).where(eq(photos.category, category));
    }
    return await db.select().from(photos);
  }

  async getTotalVotes(startDate?: string, endDate?: string, voterType?: string): Promise<number> {
    let query = db.select({ count: sql<number>`count(*)` }).from(votes);
    
    if (startDate && endDate && voterType) {
      const [result] = await query.where(and(
        gte(votes.timestamp, startDate),
        lte(votes.timestamp, endDate),
        eq(votes.voterType, voterType)
      ));
      return result.count;
    } else if (startDate && endDate) {
      const [result] = await query.where(and(
        gte(votes.timestamp, startDate),
        lte(votes.timestamp, endDate)
      ));
      return result.count;
    } else if (voterType) {
      const [result] = await query.where(eq(votes.voterType, voterType));
      return result.count;
    }
    
    const [result] = await query;
    return result.count;
  }

  async getUniqueVoters(startDate?: string, endDate?: string, voterType?: string): Promise<number> {
    // For database storage, we'll estimate unique voters based on voting patterns
    const totalVotes = await this.getTotalVotes(startDate, endDate, voterType);
    return Math.ceil(totalVotes * 0.8); // Estimate based on typical voting patterns
  }

  async getPhotoStats(startDate?: string, endDate?: string, category?: string, voterType?: string): Promise<Photo[]> {
    const allPhotos = category 
      ? await db.select().from(photos).where(eq(photos.category, category))
      : await db.select().from(photos);
    
    // If filtering by voterType or date range, we need to recalculate stats based on filtered votes
    if (voterType || startDate || endDate) {
      // Build conditions for vote filtering
      const conditions = [];
      if (voterType) conditions.push(eq(votes.voterType, voterType));
      if (startDate) conditions.push(gte(votes.timestamp, startDate));
      if (endDate) conditions.push(lte(votes.timestamp, endDate));
      
      // Get filtered vote counts for each photo
      const photoStatsMap = new Map();
      
      for (const photo of allPhotos) {
        // Count votes for this photo with filters
        const voteCountQuery = db
          .select({ count: sql<number>`count(*)` })
          .from(votes)
          .where(and(
            eq(votes.photoId, photo.id),
            ...conditions
          ));
        
        // Count wins for this photo with filters
        const winCountQuery = db
          .select({ count: sql<number>`count(*)` })
          .from(votes)
          .where(and(
            eq(votes.winnerPhotoId, photo.id),
            ...conditions
          ));
          
        // Count comparisons for this photo with filters
        const comparisonCountQuery = db
          .select({ count: sql<number>`count(*)` })
          .from(votes)
          .where(and(
            or(
              eq(votes.winnerPhotoId, photo.id),
              eq(votes.loserPhotoId, photo.id)
            ),
            ...conditions
          ));
        
        const [voteCount] = await voteCountQuery;
        const [winCount] = await winCountQuery;
        const [comparisonCount] = await comparisonCountQuery;
        
        photoStatsMap.set(photo.id, {
          ...photo,
          votes: voteCount.count,
          wins: winCount.count,
          comparisons: comparisonCount.count
        });
      }
      
      // Convert map to array and sort
      const photosWithFilteredStats = Array.from(photoStatsMap.values());
      return photosWithFilteredStats.sort((a, b) => {
        const aWinRate = a.comparisons > 0 ? (a.wins / a.comparisons) : 0;
        const bWinRate = b.comparisons > 0 ? (b.wins / b.comparisons) : 0;
        return bWinRate - aWinRate || b.votes - a.votes;
      });
    }
    
    // No filtering, return photos with existing stats
    return allPhotos.sort((a, b) => {
      const aWinRate = a.comparisons > 0 ? (a.wins / a.comparisons) : 0;
      const bWinRate = b.comparisons > 0 ? (b.wins / b.comparisons) : 0;
      return bWinRate - aWinRate || b.votes - a.votes;
    });
  }

  async getTopPhotosByVotes(limit: number = 10): Promise<Photo[]> {
    return await db
      .select()
      .from(photos)
      .where(eq(photos.hidden, false))
      .orderBy(sql`${photos.votes} DESC`)
      .limit(limit);
  }

  async getTopPhotosByWins(limit: number = 10): Promise<Photo[]> {
    return await db
      .select()
      .from(photos)
      .where(eq(photos.hidden, false))
      .orderBy(sql`${photos.wins} DESC`)
      .limit(limit);
  }

  async getUserVotedPhotos(userId: string, limit: number = 10, sortBy: 'votes' | 'wins' = 'votes'): Promise<Photo[]> {
    // Get distinct photo IDs that the user has voted on
    const userVotes = await db
      .select({ 
        winnerPhotoId: votes.winnerPhotoId,
        loserPhotoId: votes.loserPhotoId 
      })
      .from(votes)
      .where(eq(votes.userId, userId));
    
    // Collect all unique photo IDs the user has voted on
    const photoIds = new Set<string>();
    userVotes.forEach(vote => {
      if (vote.winnerPhotoId) photoIds.add(vote.winnerPhotoId);
      if (vote.loserPhotoId) photoIds.add(vote.loserPhotoId);
    });
    
    if (photoIds.size === 0) {
      return [];
    }
    
    // Get those photos with their stats
    const photosQuery = db
      .select()
      .from(photos)
      .where(and(
        inArray(photos.id, Array.from(photoIds)),
        eq(photos.hidden, false)
      ));
    
    const userPhotos = await photosQuery;
    
    // Sort based on preference
    if (sortBy === 'wins') {
      return userPhotos.sort((a, b) => b.wins - a.wins).slice(0, limit);
    } else {
      return userPhotos.sort((a, b) => b.votes - a.votes).slice(0, limit);
    }
  }

  // Pairs functionality implementation
  async createPhotoPair(pair: InsertPhotoPair): Promise<PhotoPair> {
    const [newPair] = await db.insert(photoPairs).values(pair).returning();
    return newPair;
  }

  async getAllPhotoPairs(): Promise<PhotoPair[]> {
    return await db.select().from(photoPairs);
  }

  async checkIfPairVote(photo1Id: string, photo2Id: string): Promise<boolean> {
    const [pair] = await db
      .select()
      .from(photoPairs)
      .where(
        sql`(${photoPairs.photo1Id} = ${photo1Id} AND ${photoPairs.photo2Id} = ${photo2Id}) 
            OR (${photoPairs.photo1Id} = ${photo2Id} AND ${photoPairs.photo2Id} = ${photo1Id})`
      )
      .limit(1);
    
    return !!pair;
  }

  async findPairByPhotos(photo1Id: string, photo2Id: string): Promise<PhotoPair | undefined> {
    const [pair] = await db
      .select()
      .from(photoPairs)
      .where(
        sql`(${photoPairs.photo1Id} = ${photo1Id} AND ${photoPairs.photo2Id} = ${photo2Id}) 
            OR (${photoPairs.photo1Id} = ${photo2Id} AND ${photoPairs.photo2Id} = ${photo1Id})`
      )
      .limit(1);
    
    return pair;
  }

  async getPhotoPair(id: string): Promise<PhotoPair | undefined> {
    const [pair] = await db.select().from(photoPairs).where(eq(photoPairs.id, id));
    return pair;
  }

  async deletePhotoPair(id: string): Promise<boolean> {
    const result = await db.delete(photoPairs).where(eq(photoPairs.id, id));
    return (result.rowCount || 0) > 0;
  }

  async getPhotoPartnerships(photoId: string): Promise<PhotoPair[]> {
    return await db.select().from(photoPairs).where(
      or(
        eq(photoPairs.photo1Id, photoId),
        eq(photoPairs.photo2Id, photoId)
      )
    );
  }

  async createPairVote(vote: InsertPairVote): Promise<PairVote> {
    const [newVote] = await db.insert(pairVotes).values(vote).returning();
    return newVote;
  }

  async getPhotoPerformanceMatrix(): Promise<Array<{
    photoId: string;
    photoTitle: string;
    photoImageUrl: string;
    totalWins: number;
    totalVotes: number;
    winRate: number;
    opponents: Array<{
      opponentId: string;
      opponentTitle: string;
      opponentImageUrl: string;
      winsAgainstOpponent: number;
      lossesToOpponent: number;
      totalMatchups: number;
      winRateAgainstOpponent: number;
      regularVotes: { wins: number; losses: number; total: number };
      directPairVotes: { wins: number; losses: number; total: number };
      pairIds: string[];
    }>;
  }>> {
    try {
      const pairs = await this.getAllPhotoPairs();
      const allPhotos = await this.getAllPhotos();
      
      // Get all photos that are in pairs
      const photosInPairs = new Set<string>();
      pairs.forEach((pair: any) => {
        photosInPairs.add(pair.photo1Id);
        photosInPairs.add(pair.photo2Id);
      });
      
      const photoPerformances = await Promise.all(
        Array.from(photosInPairs).map(async (photoId) => {
          const photo = allPhotos.find(p => p.id === photoId);
          if (!photo) return null;
          
          // Get overall stats for this photo
          const [photoWins] = await db
            .select({ count: sql<number>`CAST(count(*) AS INTEGER)` })
            .from(votes)
            .where(eq(votes.winnerPhotoId, photoId));

          const [photoTotal] = await db
            .select({ count: sql<number>`CAST(count(*) AS INTEGER)` })
            .from(votes)
            .where(or(
              eq(votes.winnerPhotoId, photoId),
              eq(votes.loserPhotoId, photoId)
            ));

          // Get all unique opponents this photo is paired with (may be in multiple pairs)
          const uniqueOpponents = new Map<string, any[]>();
          pairs
            .filter((pair: any) => pair.photo1Id === photoId || pair.photo2Id === photoId)
            .forEach((pair: any) => {
              const opponentId = pair.photo1Id === photoId ? pair.photo2Id : pair.photo1Id;
              if (!uniqueOpponents.has(opponentId)) {
                uniqueOpponents.set(opponentId, []);
              }
              uniqueOpponents.get(opponentId)?.push(pair);
            });

          const opponents = await Promise.all(
            Array.from(uniqueOpponents.entries()).map(async ([opponentId, relatedPairs]) => {
              const opponent = allPhotos.find(p => p.id === opponentId);
              if (!opponent) return null;
              
              // Get regular voting head-to-head stats (across all time)
              const [winsAgainst] = await db
                .select({ count: sql<number>`CAST(count(*) AS INTEGER)` })
                .from(votes)
                .where(and(
                  eq(votes.winnerPhotoId, photoId),
                  eq(votes.loserPhotoId, opponentId)
                ));

              const [lossesAgainst] = await db
                .select({ count: sql<number>`CAST(count(*) AS INTEGER)` })
                .from(votes)
                .where(and(
                  eq(votes.winnerPhotoId, opponentId),
                  eq(votes.loserPhotoId, photoId)
                ));

              // Get direct pair voting stats (across all pairs containing these two photos)
              let totalDirectWins = 0;
              let totalDirectLosses = 0;
              
              for (const pair of relatedPairs) {
                const [pairWins] = await db
                  .select({ count: sql<number>`CAST(count(*) AS INTEGER)` })
                  .from(pairVotes)
                  .where(and(
                    eq(pairVotes.pairId, pair.id),
                    eq(pairVotes.winnerPhotoId, photoId)
                  ));

                const [pairLosses] = await db
                  .select({ count: sql<number>`CAST(count(*) AS INTEGER)` })
                  .from(pairVotes)
                  .where(and(
                    eq(pairVotes.pairId, pair.id),
                    eq(pairVotes.winnerPhotoId, opponentId)
                  ));

                totalDirectWins += pairWins?.count || 0;
                totalDirectLosses += pairLosses?.count || 0;
              }

              const regularWins = winsAgainst?.count || 0;
              const regularLosses = lossesAgainst?.count || 0;
              
              const totalMatchups = regularWins + regularLosses + totalDirectWins + totalDirectLosses;
              const totalWinsAgainstOpponent = regularWins + totalDirectWins;

              // Debug logging for impossible results
              if (totalMatchups > 1000 || totalWinsAgainstOpponent > 1000) {
                console.log(`DEBUG: Impossible stats for ${photoId} vs ${opponentId}:`, {
                  regularWins, regularLosses, totalDirectWins, totalDirectLosses,
                  totalMatchups, totalWinsAgainstOpponent,
                  winRate: totalMatchups > 0 ? (totalWinsAgainstOpponent / totalMatchups) * 100 : 0
                });
              }

              return {
                opponentId,
                opponentTitle: opponent.title,
                opponentImageUrl: opponent.imageUrl,
                winsAgainstOpponent: Number(totalWinsAgainstOpponent),
                lossesToOpponent: Number(regularLosses + totalDirectLosses),
                totalMatchups: Number(totalMatchups),
                winRateAgainstOpponent: totalMatchups > 0 ? (totalWinsAgainstOpponent / totalMatchups) * 100 : 0,
                regularVotes: {
                  wins: Number(regularWins),
                  losses: Number(regularLosses),
                  total: Number(regularWins + regularLosses)
                },
                directPairVotes: {
                  wins: Number(totalDirectWins),
                  losses: Number(totalDirectLosses),
                  total: Number(totalDirectWins + totalDirectLosses)
                },
                pairIds: relatedPairs.map(p => p.id)
              };
            })
          );

          const validOpponents = opponents.filter(opp => opp !== null);

          return {
            photoId,
            photoTitle: photo.title,
            photoImageUrl: photo.imageUrl,
            totalWins: Number(photoWins?.count || 0),
            totalVotes: Number(photoTotal?.count || 0),
            winRate: photoTotal?.count > 0 ? (Number(photoWins.count) / Number(photoTotal.count)) * 100 : 0,
            opponents: validOpponents
          };
        })
      );

      return photoPerformances.filter(perf => perf !== null) as Array<{
        photoId: string;
        photoTitle: string;
        photoImageUrl: string;
        totalWins: number;
        totalVotes: number;
        winRate: number;
        opponents: Array<{
          opponentId: string;
          opponentTitle: string;
          opponentImageUrl: string;
          winsAgainstOpponent: number;
          lossesToOpponent: number;
          totalMatchups: number;
          winRateAgainstOpponent: number;
          regularVotes: { wins: number; losses: number; total: number };
          directPairVotes: { wins: number; losses: number; total: number };
          pairIds: string[];
        }>;
      }>;
    } catch (error) {
      console.error('Error fetching photo performance matrix:', error);
      return [];
    }
  }

  async getAllPairMatchups(): Promise<Array<{
    pairId: string;
    photo1Id: string;
    photo2Id: string;
    photo1Title: string;
    photo2Title: string;
    photo1ImageUrl: string;
    photo2ImageUrl: string;
    description?: string;
    createdAt: string;
    directPairVotes: { photo1Wins: number; photo2Wins: number; total: number };
    allTimeHeadToHead: { photo1Wins: number; photo2Wins: number; total: number };
    photo1OverallStats: { wins: number; total: number; winRate: number };
    photo2OverallStats: { wins: number; total: number; winRate: number };
  }>> {
    try {
      const pairs = await this.getAllPhotoPairs();
      const allPhotos = await this.getAllPhotos();
      
      const matchups = await Promise.all(pairs.map(async (pair: any) => {
        const photo1 = allPhotos.find(p => p.id === pair.photo1Id);
        const photo2 = allPhotos.find(p => p.id === pair.photo2Id);
        
        if (!photo1 || !photo2) {
          return null;
        }
        
        // Get direct pair voting stats
        const [photo1DirectWins] = await db
          .select({ count: sql<number>`count(*)` })
          .from(pairVotes)
          .where(and(
            eq(pairVotes.pairId, pair.id),
            eq(pairVotes.winnerPhotoId, pair.photo1Id)
          ));

        const [photo2DirectWins] = await db
          .select({ count: sql<number>`count(*)` })
          .from(pairVotes)
          .where(and(
            eq(pairVotes.pairId, pair.id),
            eq(pairVotes.winnerPhotoId, pair.photo2Id)
          ));

        const [totalDirectVotes] = await db
          .select({ count: sql<number>`count(*)` })
          .from(pairVotes)
          .where(eq(pairVotes.pairId, pair.id));

        // Get all-time head-to-head stats from regular voting
        const [allTimePhoto1Wins] = await db
          .select({ count: sql<number>`count(*)` })
          .from(votes)
          .where(and(
            eq(votes.winnerPhotoId, pair.photo1Id),
            eq(votes.loserPhotoId, pair.photo2Id)
          ));

        const [allTimePhoto2Wins] = await db
          .select({ count: sql<number>`count(*)` })
          .from(votes)
          .where(and(
            eq(votes.winnerPhotoId, pair.photo2Id),
            eq(votes.loserPhotoId, pair.photo1Id)
          ));

        // Get overall performance for each photo
        const [photo1OverallWins] = await db
          .select({ count: sql<number>`count(*)` })
          .from(votes)
          .where(eq(votes.winnerPhotoId, pair.photo1Id));

        const [photo1OverallTotal] = await db
          .select({ count: sql<number>`count(*)` })
          .from(votes)
          .where(or(
            eq(votes.winnerPhotoId, pair.photo1Id),
            eq(votes.loserPhotoId, pair.photo1Id)
          ));

        const [photo2OverallWins] = await db
          .select({ count: sql<number>`count(*)` })
          .from(votes)
          .where(eq(votes.winnerPhotoId, pair.photo2Id));

        const [photo2OverallTotal] = await db
          .select({ count: sql<number>`count(*)` })
          .from(votes)
          .where(or(
            eq(votes.winnerPhotoId, pair.photo2Id),
            eq(votes.loserPhotoId, pair.photo2Id)
          ));

        return {
          pairId: pair.id,
          photo1Id: pair.photo1Id,
          photo2Id: pair.photo2Id,
          photo1Title: photo1.title,
          photo2Title: photo2.title,
          photo1ImageUrl: photo1.imageUrl,
          photo2ImageUrl: photo2.imageUrl,
          description: pair.description,
          createdAt: pair.createdAt,
          directPairVotes: {
            photo1Wins: photo1DirectWins?.count || 0,
            photo2Wins: photo2DirectWins?.count || 0,
            total: totalDirectVotes?.count || 0
          },
          allTimeHeadToHead: {
            photo1Wins: allTimePhoto1Wins?.count || 0,
            photo2Wins: allTimePhoto2Wins?.count || 0,
            total: (allTimePhoto1Wins?.count || 0) + (allTimePhoto2Wins?.count || 0)
          },
          photo1OverallStats: {
            wins: photo1OverallWins?.count || 0,
            total: photo1OverallTotal?.count || 0,
            winRate: photo1OverallTotal?.count > 0 ? (photo1OverallWins.count / photo1OverallTotal.count) * 100 : 0
          },
          photo2OverallStats: {
            wins: photo2OverallWins?.count || 0,
            total: photo2OverallTotal?.count || 0,
            winRate: photo2OverallTotal?.count > 0 ? (photo2OverallWins.count / photo2OverallTotal.count) * 100 : 0
          }
        };
      }));

      return matchups.filter((matchup: any) => matchup !== null) as Array<{
        pairId: string;
        photo1Id: string;
        photo2Id: string;
        photo1Title: string;
        photo2Title: string;
        photo1ImageUrl: string;
        photo2ImageUrl: string;
        description?: string;
        createdAt: string;
        directPairVotes: { photo1Wins: number; photo2Wins: number; total: number };
        allTimeHeadToHead: { photo1Wins: number; photo2Wins: number; total: number };
        photo1OverallStats: { wins: number; total: number; winRate: number };
        photo2OverallStats: { wins: number; total: number; winRate: number };
      }>;
    } catch (error) {
      console.error('Error fetching all pair matchups:', error);
      return [];
    }
  }

  async getPairVoteStats(pairId: string): Promise<{ 
    photo1Wins: number; 
    photo2Wins: number; 
    totalVotes: number;
    photo1WinRate: number;
    photo2WinRate: number;
    photo1VsOthers: { wins: number; total: number; winRate: number };
    photo2VsOthers: { wins: number; total: number; winRate: number };
    headToHeadAllTime: { photo1Wins: number; photo2Wins: number; totalVotes: number };
  }> {
    try {
      const pair = await this.getPhotoPair(pairId);
      if (!pair) return { 
        photo1Wins: 0, photo2Wins: 0, totalVotes: 0, photo1WinRate: 0, photo2WinRate: 0,
        photo1VsOthers: { wins: 0, total: 0, winRate: 0 },
        photo2VsOthers: { wins: 0, total: 0, winRate: 0 },
        headToHeadAllTime: { photo1Wins: 0, photo2Wins: 0, totalVotes: 0 }
      };

      // Get stats for this specific pair (from pair voting only)
      const [photo1Wins] = await db
        .select({ count: sql<number>`count(*)` })
        .from(pairVotes)
        .where(and(
          eq(pairVotes.pairId, pairId),
          eq(pairVotes.winnerPhotoId, pair.photo1Id)
        ));

      const [photo2Wins] = await db
        .select({ count: sql<number>`count(*)` })
        .from(pairVotes)
        .where(and(
          eq(pairVotes.pairId, pairId),
          eq(pairVotes.winnerPhotoId, pair.photo2Id)
        ));

      const [totalPairVotes] = await db
        .select({ count: sql<number>`count(*)` })
        .from(pairVotes)
        .where(eq(pairVotes.pairId, pairId));

      // Get ALL TIME head-to-head data between these two photos (from regular votes table)
      const [allTimePhoto1Wins] = await db
        .select({ count: sql<number>`count(*)` })
        .from(votes)
        .where(and(
          eq(votes.winnerPhotoId, pair.photo1Id),
          eq(votes.loserPhotoId, pair.photo2Id)
        ));

      const [allTimePhoto2Wins] = await db
        .select({ count: sql<number>`count(*)` })
        .from(votes)
        .where(and(
          eq(votes.winnerPhotoId, pair.photo2Id),
          eq(votes.loserPhotoId, pair.photo1Id)
        ));

      // Calculate win rates for this pair
      const pairPhoto1Wins = photo1Wins?.count || 0;
      const pairPhoto2Wins = photo2Wins?.count || 0;
      const pairTotalVotes = totalPairVotes?.count || 0;
      const photo1WinRate = pairTotalVotes > 0 ? (pairPhoto1Wins / pairTotalVotes) * 100 : 0;
      const photo2WinRate = pairTotalVotes > 0 ? (pairPhoto2Wins / pairTotalVotes) * 100 : 0;

      // Get overall performance for each photo across ALL their voting
      const [photo1OverallWins] = await db
        .select({ count: sql<number>`count(*)` })
        .from(votes)
        .where(eq(votes.winnerPhotoId, pair.photo1Id));

      const [photo1OverallTotal] = await db
        .select({ count: sql<number>`count(*)` })
        .from(votes)
        .where(or(
          eq(votes.winnerPhotoId, pair.photo1Id),
          eq(votes.loserPhotoId, pair.photo1Id)
        ));

      const [photo2OverallWins] = await db
        .select({ count: sql<number>`count(*)` })
        .from(votes)
        .where(eq(votes.winnerPhotoId, pair.photo2Id));

      const [photo2OverallTotal] = await db
        .select({ count: sql<number>`count(*)` })
        .from(votes)
        .where(or(
          eq(votes.winnerPhotoId, pair.photo2Id),
          eq(votes.loserPhotoId, pair.photo2Id)
        ));

      const photo1VsOthersWinRate = photo1OverallTotal?.count > 0 ? 
        (photo1OverallWins.count / photo1OverallTotal.count) * 100 : 0;
      const photo2VsOthersWinRate = photo2OverallTotal?.count > 0 ? 
        (photo2OverallWins.count / photo2OverallTotal.count) * 100 : 0;

      const allTimeTotal = Number(allTimePhoto1Wins?.count || 0) + Number(allTimePhoto2Wins?.count || 0);

      return {
        photo1Wins: pairPhoto1Wins,
        photo2Wins: pairPhoto2Wins,
        totalVotes: pairTotalVotes,
        photo1WinRate,
        photo2WinRate,
        photo1VsOthers: {
          wins: photo1OverallWins?.count || 0,
          total: photo1OverallTotal?.count || 0,
          winRate: photo1VsOthersWinRate
        },
        photo2VsOthers: {
          wins: photo2OverallWins?.count || 0,
          total: photo2OverallTotal?.count || 0,
          winRate: photo2VsOthersWinRate
        },
        headToHeadAllTime: {
          photo1Wins: allTimePhoto1Wins?.count || 0,
          photo2Wins: allTimePhoto2Wins?.count || 0,
          totalVotes: allTimeTotal
        }
      };
    } catch (error) {
      console.error('Error fetching pair vote stats:', error);
      return { 
        photo1Wins: 0, photo2Wins: 0, totalVotes: 0, photo1WinRate: 0, photo2WinRate: 0,
        photo1VsOthers: { wins: 0, total: 0, winRate: 0 },
        photo2VsOthers: { wins: 0, total: 0, winRate: 0 },
        headToHeadAllTime: { photo1Wins: 0, photo2Wins: 0, totalVotes: 0 }
      };
    }
  }

  async getPhotoPerformanceInPairs(photoId: string): Promise<{ wins: number; losses: number; winRate: number }> {
    const [wins] = await db
      .select({ count: sql<number>`count(*)` })
      .from(pairVotes)
      .where(eq(pairVotes.winnerPhotoId, photoId));

    const [losses] = await db
      .select({ count: sql<number>`count(*)` })
      .from(pairVotes)
      .where(eq(pairVotes.loserPhotoId, photoId));

    const totalPairVotes = wins.count + losses.count;
    const winRate = totalPairVotes > 0 ? wins.count / totalPairVotes : 0;

    return {
      wins: wins.count,
      losses: losses.count,
      winRate
    };
  }

  async checkForPairDisplay(): Promise<[Photo, Photo] | null> {
    const settings = await this.getSettings();
    console.log(`checkForPairDisplay: pairsEnabled = ${settings.pairsEnabled}`);
    if (!settings.pairsEnabled) return null;

    // Get all available pairs where both photos are visible and not archived
    const availablePairs = await db
      .select({
        id: photoPairs.id,
        photo1Id: photoPairs.photo1Id,
        photo2Id: photoPairs.photo2Id
      })
      .from(photoPairs)
      .innerJoin(photos, eq(photoPairs.photo1Id, photos.id))
      .innerJoin(sql`photos as p2`, sql`${photoPairs.photo2Id} = p2.id`)
      .where(and(
        eq(photos.hidden, false),
        eq(photos.archived, false),
        sql`p2.hidden = false`,
        sql`p2.archived = false`
      ));

    console.log(`checkForPairDisplay: Found ${availablePairs.length} available pairs`);
    if (availablePairs.length === 0) return null;

    // Randomly select one pair and get the full photo objects
    const randomPair = availablePairs[Math.floor(Math.random() * availablePairs.length)];
    console.log(`checkForPairDisplay: Selected pair ${randomPair.id} with photos ${randomPair.photo1Id} and ${randomPair.photo2Id}`);
    
    const photo1 = await this.getPhoto(randomPair.photo1Id);
    const photo2 = await this.getPhoto(randomPair.photo2Id);
    
    if (!photo1 || !photo2) {
      console.log(`checkForPairDisplay: Failed to get photos - photo1: ${!!photo1}, photo2: ${!!photo2}`);
      return null;
    }
    
    // Randomize the order of photos in the pair
    const shouldSwap = Math.random() < 0.5;
    const orderedPair: [Photo, Photo] = shouldSwap ? [photo2, photo1] : [photo1, photo2];
    
    console.log(`checkForPairDisplay: Returning pair with ${orderedPair[0].title} vs ${orderedPair[1].title} (swapped: ${shouldSwap})`);
    return orderedPair;
  }

  async archivePhoto(id: string): Promise<boolean> {
    const result = await db
      .update(photos)
      .set({ archived: true })
      .where(eq(photos.id, id));
    return (result.rowCount || 0) > 0;
  }

  // ============================================
  // PRODUCTS METHODS
  // ============================================
  async getAllProducts(): Promise<Product[]> {
    return await db.select().from(products);
  }

  async getProduct(id: string): Promise<Product | undefined> {
    const [product] = await db.select().from(products).where(eq(products.id, id));
    return product;
  }

  async createProduct(product: InsertProduct): Promise<Product> {
    const [newProduct] = await db.insert(products).values(product).returning();
    return newProduct;
  }

  async updateProduct(id: string, updates: Partial<Product>): Promise<Product | undefined> {
    const [updated] = await db.update(products).set(updates).where(eq(products.id, id)).returning();
    return updated;
  }

  async deleteProduct(id: string): Promise<boolean> {
    try {
      // Delete in reverse order of dependencies
      
      // 1. Delete inventory items that reference this product
      await db.delete(inventoryItems).where(eq(inventoryItems.productId, id));
      
      // 2. Set sales.productId to null for sales referencing this product
      await db.update(sales).set({ productId: null }).where(eq(sales.productId, id));
      
      // 3. Get all product SKUs for this product to delete channel SKUs
      const productSKUsList = await db.select().from(productSKUs).where(eq(productSKUs.productId, id));
      
      // 4. Delete channel SKUs for each product SKU
      for (const sku of productSKUsList) {
        await db.delete(channelSKUs).where(eq(channelSKUs.masterSKUId, sku.id));
      }
      
      // 5. Delete product SKUs
      await db.delete(productSKUs).where(eq(productSKUs.productId, id));
      
      // 6. Delete product variants
      await db.delete(productVariants).where(eq(productVariants.productId, id));
      
      // 7. Finally delete the product itself
      const result = await db.delete(products).where(eq(products.id, id));
      
      return (result.rowCount || 0) > 0;
    } catch (error) {
      console.error('Error deleting product:', error);
      return false;
    }
  }

  async getProductsByPhoto(photoId: string): Promise<Product[]> {
    return await db.select().from(products).where(eq(products.photoId, photoId));
  }

  // Product Variants
  async getProductVariants(productId: string): Promise<ProductVariant[]> {
    return await db.select().from(productVariants).where(eq(productVariants.productId, productId));
  }

  async createProductVariant(variant: InsertProductVariant): Promise<ProductVariant> {
    const [newVariant] = await db.insert(productVariants).values(variant).returning();
    return newVariant;
  }

  async updateProductVariant(id: string, updates: Partial<ProductVariant>): Promise<ProductVariant | undefined> {
    const [updated] = await db.update(productVariants).set(updates).where(eq(productVariants.id, id)).returning();
    return updated;
  }

  async deleteProductVariant(id: string): Promise<boolean> {
    const result = await db.delete(productVariants).where(eq(productVariants.id, id));
    return (result.rowCount || 0) > 0;
  }

  // Product SKUs
  async getAllProductSKUs(): Promise<ProductSKU[]> {
    return await db.select().from(productSKUs);
  }

  async getAllProductSKUsWithDetails(): Promise<Array<ProductSKU & { productTitle: string; productExternalId: string | null; sizeLabel: string }>> {
    const result = await db
      .select({
        id: productSKUs.id,
        sku: productSKUs.sku,
        productId: productSKUs.productId,
        mediaType: productSKUs.mediaType,
        productSizeId: productSKUs.productSizeId,
        isActive: productSKUs.isActive,
        createdAt: productSKUs.createdAt,
        updatedAt: productSKUs.updatedAt,
        productTitle: products.title,
        productExternalId: products.externalId,
        sizeLabel: productSizes.sizeLabel
      })
      .from(productSKUs)
      .innerJoin(products, eq(productSKUs.productId, products.id))
      .innerJoin(productSizes, eq(productSKUs.productSizeId, productSizes.id));
    
    return result;
  }

  async getProductSKU(id: string): Promise<ProductSKU | undefined> {
    const [sku] = await db.select().from(productSKUs).where(eq(productSKUs.id, id));
    return sku;
  }

  async createProductSKU(sku: InsertProductSKU): Promise<ProductSKU> {
    const [newSKU] = await db.insert(productSKUs).values(sku).returning();
    return newSKU;
  }

  async updateProductSKU(id: string, updates: Partial<ProductSKU>): Promise<ProductSKU | undefined> {
    const [updated] = await db.update(productSKUs).set(updates).where(eq(productSKUs.id, id)).returning();
    return updated;
  }

  async deleteProductSKU(id: string): Promise<boolean> {
    const result = await db.delete(productSKUs).where(eq(productSKUs.id, id));
    return (result.rowCount || 0) > 0;
  }

  async getProductSKUsByProduct(productId: string): Promise<ProductSKU[]> {
    return await db.select().from(productSKUs).where(eq(productSKUs.productId, productId));
  }

  // Channel SKUs
  async getAllChannelSKUs(): Promise<ChannelSKU[]> {
    return await db.select().from(channelSKUs);
  }

  async getChannelSKU(id: string): Promise<ChannelSKU | undefined> {
    const [sku] = await db.select().from(channelSKUs).where(eq(channelSKUs.id, id));
    return sku;
  }

  async getChannelSKUs(masterSKUId: string): Promise<ChannelSKU[]> {
    return await db.select().from(channelSKUs).where(eq(channelSKUs.masterSKUId, masterSKUId));
  }

  async getChannelSKUsByMaster(masterSKUId: string): Promise<ChannelSKU[]> {
    return await db.select().from(channelSKUs).where(eq(channelSKUs.masterSKUId, masterSKUId));
  }

  async createChannelSKU(sku: InsertChannelSKU): Promise<ChannelSKU> {
    const [newSKU] = await db.insert(channelSKUs).values(sku).returning();
    return newSKU;
  }

  async updateChannelSKU(id: string, updates: Partial<ChannelSKU>): Promise<ChannelSKU | undefined> {
    const [updated] = await db.update(channelSKUs).set(updates).where(eq(channelSKUs.id, id)).returning();
    return updated;
  }

  async deleteChannelSKU(id: string): Promise<boolean> {
    const result = await db.delete(channelSKUs).where(eq(channelSKUs.id, id));
    return (result.rowCount || 0) > 0;
  }

  // Retail Prices
  async getRetailPrices(productSizeId: string, mediaType: string): Promise<RetailPrice[]> {
    return await db.select()
      .from(retailPrices)
      .where(and(
        eq(retailPrices.productSizeId, productSizeId),
        eq(retailPrices.mediaType, mediaType)
      ))
      .orderBy(desc(retailPrices.effectiveFrom));
  }

  async getCurrentRetailPrice(productSizeId: string, mediaType: string): Promise<RetailPrice | undefined> {
    const [price] = await db.select()
      .from(retailPrices)
      .where(and(
        eq(retailPrices.productSizeId, productSizeId),
        eq(retailPrices.mediaType, mediaType),
        eq(retailPrices.isCurrent, true)
      ));
    return price;
  }

  async createRetailPrice(price: InsertRetailPrice): Promise<RetailPrice> {
    // Mark old prices as not current
    await db.update(retailPrices)
      .set({ isCurrent: false })
      .where(and(
        eq(retailPrices.productSizeId, price.productSizeId),
        eq(retailPrices.mediaType, price.mediaType)
      ));

    const [newPrice] = await db.insert(retailPrices).values({
      ...price,
      isCurrent: true,
      version: 1 // TODO: increment based on existing versions
    }).returning();
    return newPrice;
  }

  async updateRetailPrice(id: string, updates: Partial<RetailPrice>): Promise<RetailPrice | undefined> {
    const [updated] = await db.update(retailPrices).set(updates).where(eq(retailPrices.id, id)).returning();
    return updated;
  }

  async setRetailPrice(
    productSizeId: string,
    mediaType: string,
    newPrice: number,
    notes?: string
  ): Promise<RetailPrice> {
    // Close the current price record by setting effectiveTo
    await db
      .update(retailPrices)
      .set({ 
        effectiveTo: new Date(),
        isCurrent: false 
      })
      .where(and(
        eq(retailPrices.productSizeId, productSizeId),
        eq(retailPrices.mediaType, mediaType),
        isNull(retailPrices.effectiveTo)
      ));

    // Create new price record
    const [created] = await db
      .insert(retailPrices)
      .values({
        productSizeId,
        mediaType,
        retailPrice: newPrice,
        effectiveFrom: new Date(),
        effectiveTo: null,
        isCurrent: true,
        notes: notes || null
      })
      .returning();

    return created;
  }

  // ============================================
  // SALES CHANNELS METHODS
  // ============================================
  
  async getAllSalesChannels(): Promise<SalesChannel[]> {
    return await db.select().from(salesChannels);
  }

  async getSalesChannel(id: string): Promise<SalesChannel | undefined> {
    const [channel] = await db.select().from(salesChannels).where(eq(salesChannels.id, id));
    return channel;
  }

  async createSalesChannel(channel: InsertSalesChannel): Promise<SalesChannel> {
    const [newChannel] = await db.insert(salesChannels).values(channel).returning();
    return newChannel;
  }

  async updateSalesChannel(id: string, updates: Partial<SalesChannel>): Promise<SalesChannel | undefined> {
    const [updated] = await db
      .update(salesChannels)
      .set(updates)
      .where(eq(salesChannels.id, id))
      .returning();
    return updated;
  }

  async deleteSalesChannel(id: string): Promise<boolean> {
    const result = await db.delete(salesChannels).where(eq(salesChannels.id, id));
    return (result.rowCount || 0) > 0;
  }

  // ============================================
  // SUPPLIERS METHODS
  // ============================================
  
  async getAllSuppliers(): Promise<Supplier[]> {
    return await db.select().from(suppliers);
  }

  async getSupplier(id: string): Promise<Supplier | undefined> {
    const [supplier] = await db.select().from(suppliers).where(eq(suppliers.id, id));
    return supplier;
  }

  async createSupplier(supplier: InsertSupplier): Promise<Supplier> {
    const [newSupplier] = await db.insert(suppliers).values(supplier).returning();
    return newSupplier;
  }

  async updateSupplier(id: string, updates: Partial<Supplier>): Promise<Supplier | undefined> {
    const [updated] = await db
      .update(suppliers)
      .set(updates)
      .where(eq(suppliers.id, id))
      .returning();
    return updated;
  }

  async deleteSupplier(id: string): Promise<boolean> {
    const result = await db.delete(suppliers).where(eq(suppliers.id, id));
    return (result.rowCount || 0) > 0;
  }

  // ============================================
  // PRODUCT SIZES METHODS
  // ============================================
  
  async getAllProductSizes(): Promise<ProductSize[]> {
    return await db.select().from(productSizes);
  }

  async getProductSize(id: string): Promise<ProductSize | undefined> {
    const [size] = await db.select().from(productSizes).where(eq(productSizes.id, id));
    return size;
  }

  async createProductSize(size: InsertProductSize): Promise<ProductSize> {
    const [newSize] = await db.insert(productSizes).values(size).returning();
    return newSize;
  }

  async updateProductSize(id: string, updates: Partial<ProductSize>): Promise<ProductSize | undefined> {
    const [updated] = await db
      .update(productSizes)
      .set(updates)
      .where(eq(productSizes.id, id))
      .returning();
    return updated;
  }

  async deleteProductSize(id: string): Promise<boolean> {
    const result = await db.delete(productSizes).where(eq(productSizes.id, id));
    return (result.rowCount || 0) > 0;
  }

  async getProductSizesWithPricing(): Promise<Array<{
    size: ProductSize;
    mediaType: string;
    avgSupplierCost: number | null;
    retailPrice: number | null;
    marginPercent: number | null;
  }>> {
    const sizes = await this.getAllProductSizes();
    
    const currentSupplierPrices = await db
      .select()
      .from(supplierPrices)
      .where(isNull(supplierPrices.effectiveTo));
    
    const currentRetailPrices = await db
      .select()
      .from(retailPrices)
      .where(isNull(retailPrices.effectiveTo));
    
    // Define canonical media types so empty combinations show up
    // Only include ChromaLuxe by default (user's default media type)
    const canonicalMediaTypes = ['ChromaLuxe'];
    
    // Also include any media types found in existing pricing data
    const mediaTypesSet = new Set<string>(canonicalMediaTypes);
    currentSupplierPrices.forEach(p => mediaTypesSet.add(p.mediaType));
    currentRetailPrices.forEach(p => mediaTypesSet.add(p.mediaType));
    
    const results: Array<{
      size: ProductSize;
      mediaType: string;
      avgSupplierCost: number | null;
      retailPrice: number | null;
      marginPercent: number | null;
    }> = [];
    
    // Create entry for every size × media type combination
    for (const size of sizes) {
      for (const mediaType of Array.from(mediaTypesSet)) {
        const supplierPricesForSize = currentSupplierPrices.filter(
          p => p.productSizeId === size.id && p.mediaType === mediaType
        );
        
        // Keep decimal precision, don't round prematurely
        const avgSupplierCost = supplierPricesForSize.length > 0
          ? supplierPricesForSize.reduce((sum, p) => sum + p.basePrice, 0) / 
            supplierPricesForSize.length
          : null;
        
        const retailPriceRecord = currentRetailPrices.find(
          p => p.productSizeId === size.id && p.mediaType === mediaType
        );
        
        const retailPrice = retailPriceRecord ? retailPriceRecord.retailPrice : null;
        
        // Explicit null checks instead of truthy checks
        const marginPercent = 
          avgSupplierCost !== null && retailPrice !== null && avgSupplierCost > 0
            ? Math.round(((retailPrice - avgSupplierCost) / avgSupplierCost) * 100)
            : null;
        
        // Include ALL combinations, even if both prices are null
        results.push({
          size,
          mediaType,
          avgSupplierCost: avgSupplierCost !== null ? Math.round(avgSupplierCost) : null,
          retailPrice,
          marginPercent
        });
      }
    }
    
    return results.sort((a, b) => {
      if (a.size.sizeLabel !== b.size.sizeLabel) {
        return a.size.sizeLabel.localeCompare(b.size.sizeLabel);
      }
      return a.mediaType.localeCompare(b.mediaType);
    });
  }

  // ============================================
  // SUPPLIER PRICES METHODS (with historical versioning)
  // ============================================
  
  async getCurrentSupplierPrices(supplierId?: string): Promise<SupplierPrice[]> {
    if (supplierId) {
      return await db
        .select()
        .from(supplierPrices)
        .where(and(
          eq(supplierPrices.supplierId, supplierId),
          isNull(supplierPrices.effectiveTo)
        ));
    }
    return await db
      .select()
      .from(supplierPrices)
      .where(isNull(supplierPrices.effectiveTo));
  }

  async getSupplierPriceHistory(supplierId: string, productSizeId: string): Promise<SupplierPrice[]> {
    return await db
      .select()
      .from(supplierPrices)
      .where(and(
        eq(supplierPrices.supplierId, supplierId),
        eq(supplierPrices.productSizeId, productSizeId)
      ))
      .orderBy(desc(supplierPrices.effectiveFrom));
  }

  async createSupplierPrice(price: InsertSupplierPrice): Promise<SupplierPrice> {
    const [newPrice] = await db.insert(supplierPrices).values(price).returning();
    return newPrice;
  }

  async updateSupplierPrice(
    supplierId: string, 
    productSizeId: string, 
    mediaType: string, 
    newPrice: number, 
    notes?: string
  ): Promise<SupplierPrice> {
    // Close the current price record by setting effectiveTo
    await db
      .update(supplierPrices)
      .set({ effectiveTo: new Date() })
      .where(and(
        eq(supplierPrices.supplierId, supplierId),
        eq(supplierPrices.productSizeId, productSizeId),
        eq(supplierPrices.mediaType, mediaType),
        isNull(supplierPrices.effectiveTo)
      ));

    // Create new price record
    const [created] = await db
      .insert(supplierPrices)
      .values({
        supplierId,
        productSizeId,
        mediaType,
        basePrice: newPrice,
        effectiveFrom: new Date(),
        effectiveTo: null,
        notes: notes || null
      })
      .returning();

    return created;
  }

  // ============================================
  // SALES METHODS
  // ============================================
  
  async getAllSales(startDate?: Date, endDate?: Date): Promise<Sale[]> {
    console.log('[Storage.getAllSales] Called with:', { startDate, endDate });
    let result: Sale[];
    
    if (startDate && endDate) {
      result = await db
        .select()
        .from(sales)
        .where(and(
          gte(sales.saleDate, startDate),
          lte(sales.saleDate, endDate)
        ))
        .orderBy(desc(sales.saleDate));
    } else if (startDate) {
      result = await db
        .select()
        .from(sales)
        .where(gte(sales.saleDate, startDate))
        .orderBy(desc(sales.saleDate));
    } else if (endDate) {
      result = await db
        .select()
        .from(sales)
        .where(lte(sales.saleDate, endDate))
        .orderBy(desc(sales.saleDate));
    } else {
      result = await db.select().from(sales).orderBy(desc(sales.saleDate));
    }
    
    console.log('[Storage.getAllSales] Returning:', result?.length || 0, 'sales');
    if (result && result.length > 0) {
      console.log('[Storage.getAllSales] First sale:', result[0]);
    }
    return result;
  }

  async getSale(id: string): Promise<Sale | undefined> {
    const [sale] = await db.select().from(sales).where(eq(sales.id, id));
    return sale;
  }

  async createSale(sale: InsertSale): Promise<Sale> {
    const [newSale] = await db.insert(sales).values(sale).returning();
    return newSale;
  }

  async updateSale(id: string, updates: Partial<Sale>): Promise<Sale | undefined> {
    const [updated] = await db
      .update(sales)
      .set(updates)
      .where(eq(sales.id, id))
      .returning();
    return updated;
  }

  async deleteSale(id: string): Promise<boolean> {
    const result = await db.delete(sales).where(eq(sales.id, id));
    return (result.rowCount || 0) > 0;
  }

  async getSalesByChannel(channelId: string): Promise<Sale[]> {
    return await db
      .select()
      .from(sales)
      .where(eq(sales.channelId, channelId))
      .orderBy(desc(sales.saleDate));
  }

  async getSalesByPhoto(photoId: string): Promise<Sale[]> {
    // Find products for this photo first
    const photosProducts = await db.select()
      .from(products)
      .where(eq(products.photoId, photoId));
    
    if (photosProducts.length === 0) return [];
    
    const productIds = photosProducts.map(p => p.id);
    return await db
      .select()
      .from(sales)
      .where(inArray(sales.productId, productIds))
      .orderBy(desc(sales.saleDate));
  }

  async getRecentSales(limit: number = 5): Promise<Array<{
    id: string;
    photoTitle: string | null;
    soldPrice: number;
    saleDate: string;
    channelName: string;
    buyerName: string | null;
  }>> {
    console.log('[Storage.getRecentSales] Called with limit:', limit);
    
    const results = await db
      .select({
        id: sales.id,
        productTitle: products.title,
        soldPrice: sales.soldPrice,
        saleDate: sales.saleDate,
        channelName: salesChannels.name,
        buyerName: sales.buyerName,
      })
      .from(sales)
      .leftJoin(products, eq(sales.productId, products.id))
      .leftJoin(salesChannels, eq(sales.channelId, salesChannels.id))
      .orderBy(desc(sales.createdAt))
      .limit(limit);

    console.log('[Storage.getRecentSales] Query returned:', results?.length || 0, 'records');
    if (results && results.length > 0) {
      console.log('[Storage.getRecentSales] First record:', results[0]);
    }

    const mapped = results.map(row => ({
      id: row.id,
      photoTitle: row.productTitle || "Unlinked sale",
      soldPrice: row.soldPrice,
      saleDate: row.saleDate.toISOString(),
      channelName: row.channelName || "Unknown",
      buyerName: row.buyerName,
    }));
    
    console.log('[Storage.getRecentSales] Returning mapped data:', mapped);
    return mapped;
  }

  // ============================================
  // ORDERS METHODS (MVP - To be fully implemented)
  // ============================================
  
  async getAllOrders(startDate?: Date, endDate?: Date): Promise<Order[]> {
    // TODO: Implement filtering by date
    return await db.select().from(orders).orderBy(desc(orders.orderDate));
  }

  async getOrder(id: string): Promise<Order | undefined> {
    const result = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
    return result[0];
  }

  async getOrderWithItems(id: string): Promise<(Order & { items: OrderItem[] }) | undefined> {
    const order = await this.getOrder(id);
    if (!order) return undefined;
    
    const items = await db.select().from(orderItems).where(eq(orderItems.orderId, id));
    return { ...order, items };
  }

  async createOrder(order: InsertOrder, items: InsertOrderItem[]): Promise<Order> {
    // Create order and items in a transaction
    const [newOrder] = await db.insert(orders).values(order).returning();
    
    // Insert order items
    if (items.length > 0) {
      await db.insert(orderItems).values(
        items.map(item => ({ ...item, orderId: newOrder.id }))
      );
    }
    
    return newOrder;
  }

  async updateOrder(id: string, updates: Partial<Order>): Promise<Order | undefined> {
    const result = await db.update(orders).set(updates).where(eq(orders.id, id)).returning();
    return result[0];
  }

  async deleteOrder(id: string): Promise<boolean> {
    // Delete order items first
    await db.delete(orderItems).where(eq(orderItems.orderId, id));
    // Then delete order
    const result = await db.delete(orders).where(eq(orders.id, id));
    return (result.rowCount || 0) > 0;
  }

  // ============================================
  // INVENTORY ITEMS METHODS
  // ============================================
  
  async getAllInventoryItems(status?: string): Promise<InventoryItem[]> {
    if (status) {
      return await db
        .select()
        .from(inventoryItems)
        .where(eq(inventoryItems.status, status));
    }
    return await db.select().from(inventoryItems);
  }

  async getInventoryItem(id: string): Promise<InventoryItem | undefined> {
    const [item] = await db.select().from(inventoryItems).where(eq(inventoryItems.id, id));
    return item;
  }

  async createInventoryItem(item: InsertInventoryItem): Promise<InventoryItem> {
    const [newItem] = await db.insert(inventoryItems).values(item).returning();
    return newItem;
  }

  async updateInventoryItem(id: string, updates: Partial<InventoryItem>): Promise<InventoryItem | undefined> {
    const [updated] = await db
      .update(inventoryItems)
      .set(updates)
      .where(eq(inventoryItems.id, id))
      .returning();
    return updated;
  }

  async deleteInventoryItem(id: string): Promise<boolean> {
    const result = await db.delete(inventoryItems).where(eq(inventoryItems.id, id));
    return (result.rowCount || 0) > 0;
  }

  async getInventoryByPhoto(photoId: string): Promise<InventoryItem[]> {
    // Find products for this photo first
    const photosProducts = await db.select()
      .from(products)
      .where(eq(products.photoId, photoId));
    
    if (photosProducts.length === 0) return [];
    
    const productIds = photosProducts.map(p => p.id);
    return await db
      .select()
      .from(inventoryItems)
      .where(inArray(inventoryItems.productId, productIds));
  }

  async getInventoryWithDetails(): Promise<Array<InventoryItem & { productTitle?: string; photoImageUrl?: string; sizeLabel?: string }>> {
    const items = await db.select().from(inventoryItems);
    
    const itemsWithDetails = await Promise.all(
      items.map(async (item) => {
        // Get product first, then photo through the product
        const product = item.productId ? await this.getProduct(item.productId) : undefined;
        const photo = product?.photoId ? await this.getPhoto(product.photoId) : undefined;
        const productSize = item.productSizeId ? await this.getProductSize(item.productSizeId) : undefined;
        
        return {
          ...item,
          productTitle: product?.title,
          photoImageUrl: photo?.imageUrl,
          sizeLabel: productSize?.sizeLabel || 'Unknown Size'
        };
      })
    );
    
    return itemsWithDetails;
  }

  // ============================================
  // DROP SHIP ORDERS METHODS
  // ============================================
  
  async getAllDropShipOrders(status?: string): Promise<DropShipOrder[]> {
    if (status) {
      return await db
        .select()
        .from(dropShipOrders)
        .where(eq(dropShipOrders.fulfillmentStatus, status))
        .orderBy(desc(dropShipOrders.orderDate));
    }
    return await db.select().from(dropShipOrders).orderBy(desc(dropShipOrders.orderDate));
  }

  async getDropShipOrder(id: string): Promise<DropShipOrder | undefined> {
    const [order] = await db.select().from(dropShipOrders).where(eq(dropShipOrders.id, id));
    return order;
  }

  async createDropShipOrder(order: InsertDropShipOrder): Promise<DropShipOrder> {
    const [newOrder] = await db.insert(dropShipOrders).values(order).returning();
    return newOrder;
  }

  async updateDropShipOrder(id: string, updates: Partial<DropShipOrder>): Promise<DropShipOrder | undefined> {
    const [updated] = await db
      .update(dropShipOrders)
      .set(updates)
      .where(eq(dropShipOrders.id, id))
      .returning();
    return updated;
  }

  async deleteDropShipOrder(id: string): Promise<boolean> {
    const result = await db.delete(dropShipOrders).where(eq(dropShipOrders.id, id));
    return (result.rowCount || 0) > 0;
  }

  async getDropShipOrdersBySale(saleId: string): Promise<DropShipOrder[]> {
    return await db
      .select()
      .from(dropShipOrders)
      .where(eq(dropShipOrders.saleId, saleId))
      .orderBy(desc(dropShipOrders.orderDate));
  }

  // ============================================
  // EXPENSE CATEGORIES METHODS
  // ============================================
  
  async getAllExpenseCategories(): Promise<ExpenseCategory[]> {
    return await db.select().from(expenseCategories);
  }

  async getExpenseCategory(id: string): Promise<ExpenseCategory | undefined> {
    const [category] = await db.select().from(expenseCategories).where(eq(expenseCategories.id, id));
    return category;
  }

  async createExpenseCategory(category: InsertExpenseCategory): Promise<ExpenseCategory> {
    const [newCategory] = await db.insert(expenseCategories).values(category).returning();
    return newCategory;
  }

  async updateExpenseCategory(id: string, updates: Partial<ExpenseCategory>): Promise<ExpenseCategory | undefined> {
    const [updated] = await db
      .update(expenseCategories)
      .set(updates)
      .where(eq(expenseCategories.id, id))
      .returning();
    return updated;
  }

  async deleteExpenseCategory(id: string): Promise<boolean> {
    const result = await db.delete(expenseCategories).where(eq(expenseCategories.id, id));
    return (result.rowCount || 0) > 0;
  }

  // ============================================
  // EXPENSES METHODS
  // ============================================
  
  async getAllExpenses(startDate?: Date, endDate?: Date): Promise<ExpenseWithCategory[]> {
    let query = db
      .select({
        id: expenses.id,
        categoryId: expenses.categoryId,
        vendor: expenses.vendor,
        amount: expenses.amount,
        expenseDate: expenses.expenseDate,
        purpose: expenses.purpose,
        receiptUrl: expenses.receiptUrl,
        receiptFileName: expenses.receiptFileName,
        notes: expenses.notes,
        createdAt: expenses.createdAt,
        updatedAt: expenses.updatedAt,
        categoryName: expenseCategories.name,
      })
      .from(expenses)
      .innerJoin(expenseCategories, eq(expenses.categoryId, expenseCategories.id))
      .orderBy(desc(expenses.expenseDate))
      .$dynamic();

    if (startDate && endDate) {
      query = query.where(and(
        gte(expenses.expenseDate, startDate),
        lte(expenses.expenseDate, endDate)
      ));
    } else if (startDate) {
      query = query.where(gte(expenses.expenseDate, startDate));
    } else if (endDate) {
      query = query.where(lte(expenses.expenseDate, endDate));
    }
    
    return await query;
  }

  async getExpense(id: string): Promise<ExpenseWithCategory | undefined> {
    const [expense] = await db
      .select({
        id: expenses.id,
        categoryId: expenses.categoryId,
        vendor: expenses.vendor,
        amount: expenses.amount,
        expenseDate: expenses.expenseDate,
        purpose: expenses.purpose,
        receiptUrl: expenses.receiptUrl,
        receiptFileName: expenses.receiptFileName,
        notes: expenses.notes,
        createdAt: expenses.createdAt,
        updatedAt: expenses.updatedAt,
        categoryName: expenseCategories.name,
      })
      .from(expenses)
      .innerJoin(expenseCategories, eq(expenses.categoryId, expenseCategories.id))
      .where(eq(expenses.id, id));
    return expense;
  }

  async createExpense(expense: InsertExpense): Promise<Expense> {
    const [newExpense] = await db.insert(expenses).values(expense).returning();
    return newExpense;
  }

  async updateExpense(id: string, updates: Partial<Expense>): Promise<Expense | undefined> {
    const [updated] = await db
      .update(expenses)
      .set(updates)
      .where(eq(expenses.id, id))
      .returning();
    return updated;
  }

  async deleteExpense(id: string): Promise<boolean> {
    const result = await db.delete(expenses).where(eq(expenses.id, id));
    return (result.rowCount || 0) > 0;
  }

  async getExpensesByCategory(categoryId: string): Promise<ExpenseWithCategory[]> {
    return await db
      .select({
        id: expenses.id,
        categoryId: expenses.categoryId,
        vendor: expenses.vendor,
        amount: expenses.amount,
        expenseDate: expenses.expenseDate,
        purpose: expenses.purpose,
        receiptUrl: expenses.receiptUrl,
        receiptFileName: expenses.receiptFileName,
        notes: expenses.notes,
        createdAt: expenses.createdAt,
        updatedAt: expenses.updatedAt,
        categoryName: expenseCategories.name,
      })
      .from(expenses)
      .innerJoin(expenseCategories, eq(expenses.categoryId, expenseCategories.id))
      .where(eq(expenses.categoryId, categoryId))
      .orderBy(desc(expenses.expenseDate));
  }

  async getExpensesByVendor(vendor: string): Promise<ExpenseWithCategory[]> {
    return await db
      .select({
        id: expenses.id,
        categoryId: expenses.categoryId,
        vendor: expenses.vendor,
        amount: expenses.amount,
        expenseDate: expenses.expenseDate,
        purpose: expenses.purpose,
        receiptUrl: expenses.receiptUrl,
        receiptFileName: expenses.receiptFileName,
        notes: expenses.notes,
        createdAt: expenses.createdAt,
        updatedAt: expenses.updatedAt,
        categoryName: expenseCategories.name,
      })
      .from(expenses)
      .innerJoin(expenseCategories, eq(expenses.categoryId, expenseCategories.id))
      .where(eq(expenses.vendor, vendor))
      .orderBy(desc(expenses.expenseDate));
  }
}

// Use database storage instead of memory storage
export const storage = new DatabaseStorage();

// Initialize database with default photos if empty
async function initializeDatabase() {
  try {
    console.log('Starting database initialization check...');
    
    // Test database connection first
    console.log('Testing database connection...');
    await storage.getSettings();
    console.log('Database connection successful');
    
    console.log('Checking for existing photos...');
    const existingPhotos = await storage.getAllPhotos();
    console.log(`Found ${existingPhotos.length} existing photos`);
    
    if (existingPhotos.length === 0) {
      console.log('Database empty, initializing with default photos...');
      
      const defaultPhotos = [
        {
          imageUrl: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&h=600&fit=crop",
          title: "Mountain Lake Reflection",
          description: "Crystal clear lake reflecting towering peaks in golden hour light"
        },
        {
          imageUrl: "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=800&h=600&fit=crop",
          title: "Forest Trail", 
          description: "Misty morning path through ancient evergreen forest"
        },
        {
          imageUrl: "https://images.unsplash.com/photo-1511593358241-7eea1f3c84e5?w=800&h=600&fit=crop",
          title: "Desert Canyon",
          description: "Dramatic red rock formations under expansive desert sky"
        },
        {
          imageUrl: "https://images.unsplash.com/photo-1439066615861-d1af74d74000?w=800&h=600&fit=crop",
          title: "Ocean Sunset",
          description: "Peaceful waves meeting golden sunset horizon"
        },
        {
          imageUrl: "https://images.unsplash.com/photo-1464822759356-8d6106e78f86?w=800&h=600&fit=crop",
          title: "Mountain Vista",
          description: "Snow-capped peaks rising above misty valley"
        }
      ];
      
      console.log(`Creating ${defaultPhotos.length} default photos...`);
      for (let i = 0; i < defaultPhotos.length; i++) {
        const photoData = defaultPhotos[i];
        console.log(`Creating photo ${i + 1}/${defaultPhotos.length}: ${photoData.title}`);
        try {
          await storage.createPhoto(photoData);
          console.log(`✓ Successfully created: ${photoData.title}`);
        } catch (error) {
          console.error(`✗ Failed to create photo ${photoData.title}:`, error);
        }
      }
      
      console.log('Verifying photo creation...');
      const newPhotos = await storage.getAllPhotos();
      console.log(`✓ Database now contains ${newPhotos.length} photos`);
    } else {
      console.log(`✓ Database already contains ${existingPhotos.length} photos - no initialization needed`);
    }
    
    console.log('✓ Database initialization completed successfully');
  } catch (error) {
    console.error('✗ Database initialization failed:', error);
    if (error instanceof Error) {
      console.error('Error details:', error.message);
      console.error('Error stack:', error.stack);
    }
  }
}

// Initialize database on startup with a delay to ensure server is ready
setTimeout(() => {
  console.log('Delayed database initialization starting...');
  initializeDatabase();
}, 2000);
