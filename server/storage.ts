import { type Photo, type InsertPhoto, type Vote, type InsertVote, type Settings, type InsertSettings, type Collection, type InsertCollection } from "@shared/schema";
import { randomUUID } from "crypto";
import { db } from "./db";
import { photos, votes, settings, collections } from "@shared/schema";
import { eq, sql, inArray, and, or } from "drizzle-orm";

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
  purgeTestData(beforeDate: string): Promise<{ votesDeleted: number; photosReset: boolean }>;
  
  // Special method for comparison tracking
  recordComparison(winnerPhotoId: string, loserPhotoId: string): Promise<void>;
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

  async getVotesByDateRange(startDate?: string, endDate?: string): Promise<Vote[]> {
    if (startDate && endDate) {
      return await db.select().from(votes).where(sql`${votes.timestamp} >= ${startDate} AND ${votes.timestamp} <= ${endDate}`);
    } else if (startDate) {
      return await db.select().from(votes).where(sql`${votes.timestamp} >= ${startDate}`);
    } else if (endDate) {
      return await db.select().from(votes).where(sql`${votes.timestamp} <= ${endDate}`);
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

  async purgeTestData(beforeDate: string): Promise<{ votesDeleted: number; photosReset: boolean }> {
    const cutoffDate = new Date(beforeDate);
    
    // Count votes to be deleted
    const [voteCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(votes)
      .where(sql`${votes.timestamp} < ${cutoffDate.toISOString()}`);
    
    // Delete votes before the cutoff date
    await db.delete(votes).where(sql`${votes.timestamp} < ${cutoffDate.toISOString()}`);
    
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
      const [result] = await query.where(sql`${votes.timestamp} >= ${startDate} AND ${votes.timestamp} <= ${endDate} AND ${votes.voterType} = ${voterType}`);
      return result.count;
    } else if (startDate && endDate) {
      const [result] = await query.where(sql`${votes.timestamp} >= ${startDate} AND ${votes.timestamp} <= ${endDate}`);
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
    let query = db.select().from(photos);
    
    if (category) {
      query = query.where(eq(photos.category, category));
    }
    
    const allPhotos = await query;
    
    // If filtering by voterType or date range, we need to recalculate stats based on filtered votes
    if (voterType || startDate || endDate) {
      // Build conditions for vote filtering
      const conditions = [];
      if (voterType) conditions.push(eq(votes.voterType, voterType));
      if (startDate) conditions.push(sql`${votes.timestamp} >= ${startDate}`);
      if (endDate) conditions.push(sql`${votes.timestamp} <= ${endDate}`);
      
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
