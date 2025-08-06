import { type Photo, type InsertPhoto, type UpdatePhoto, type Vote, type InsertVote, type Settings, type InsertSettings } from "@shared/schema";
import { randomUUID } from "crypto";
import { db } from "./db";
import { photos, votes, settings } from "@shared/schema";
import { eq, sql } from "drizzle-orm";

export interface IStorage {
  // Photos
  getAllPhotos(): Promise<Photo[]>;
  getPhoto(id: string): Promise<Photo | undefined>;
  createPhoto(photo: InsertPhoto): Promise<Photo>;
  updatePhoto(id: string, updates: UpdatePhoto): Promise<Photo | undefined>;
  
  // Votes
  createVote(vote: InsertVote): Promise<Vote>;
  getTotalVotes(): Promise<number>;
  getUniqueVoters(): Promise<number>;
  
  // Settings
  getSettings(): Promise<Settings>;
  updateSettings(settings: InsertSettings): Promise<Settings>;
  
  // Stats
  getPhotoStats(startDate?: string, endDate?: string): Promise<Photo[]>;
  getRandomPhotoPair(): Promise<[Photo, Photo] | null>;
  getVotesByDateRange(startDate?: string, endDate?: string): Promise<Vote[]>;
  
  // Photo management
  deletePhoto(id: string): Promise<boolean>;
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
        createdAt: new Date().toISOString(),
        votes: 0,
        wins: 0,
        comparisons: 0,
        hidden: false,
        customPurchaseUrl: null,
      };
      this.photos.set(id, photo);
    });
  }

  async getAllPhotos(): Promise<Photo[]> {
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
      createdAt: new Date().toISOString(),
      votes: 0,
      wins: 0,
      comparisons: 0,
      hidden: false,
      description: insertPhoto.description || null,
      customPurchaseUrl: insertPhoto.customPurchaseUrl || null,
    };
    this.photos.set(id, photo);
    return photo;
  }

  async updatePhoto(id: string, updates: UpdatePhoto): Promise<Photo | undefined> {
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
    
    const shuffled = [...visiblePhotos].sort(() => Math.random() - 0.5);
    return [shuffled[0], shuffled[1]];
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
  async getAllPhotos(): Promise<Photo[]> {
    return await db.select().from(photos);
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
      createdAt: new Date().toISOString(),
      votes: 0,
      wins: 0,
      comparisons: 0,
      hidden: false,
    };

    const [photo] = await db.insert(photos).values(photoData).returning();
    return photo;
  }

  async updatePhoto(id: string, updates: UpdatePhoto): Promise<Photo | undefined> {
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

  async getTotalVotes(startDate?: string, endDate?: string): Promise<number> {
    let query = db.select({ count: sql<number>`count(*)` }).from(votes);
    
    if (startDate || endDate) {
      if (startDate && endDate) {
        query = query.where(sql`${votes.timestamp} >= ${startDate} AND ${votes.timestamp} <= ${endDate}`);
      } else if (startDate) {
        query = query.where(sql`${votes.timestamp} >= ${startDate}`);
      } else if (endDate) {
        query = query.where(sql`${votes.timestamp} <= ${endDate}`);
      }
    }
    
    const [result] = await query;
    return result.count;
  }

  async getUniqueVoters(startDate?: string, endDate?: string): Promise<number> {
    // For database storage, we'll estimate unique voters based on voting patterns
    const totalVotes = await this.getTotalVotes(startDate, endDate);
    return Math.ceil(totalVotes * 0.8); // Estimate based on typical voting patterns
  }

  async getSettings(): Promise<Settings> {
    const [setting] = await db.select().from(settings).limit(1);
    
    if (!setting) {
      // Create default settings
      const defaultSettings = {
        id: "default",
        purchaseLinksEnabled: true,
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

  async getPhotoStats(startDate?: string, endDate?: string): Promise<Photo[]> {
    if (!startDate && !endDate) {
      const allPhotos = await db.select().from(photos);
      return allPhotos.sort((a, b) => b.votes - a.votes);
    }

    // For date-filtered stats, we'd need to recalculate based on votes in that period
    // This is a simplified version - in production you'd want more sophisticated analytics
    const allPhotos = await db.select().from(photos);
    return allPhotos.sort((a, b) => {
      const aWinRate = a.comparisons > 0 ? (a.wins / a.comparisons) : 0;
      const bWinRate = b.comparisons > 0 ? (b.wins / b.comparisons) : 0;
      return bWinRate - aWinRate || b.votes - a.votes;
    });
  }

  async getRandomPhotoPair(): Promise<[Photo, Photo] | null> {
    const availablePhotos = await db
      .select()
      .from(photos)
      .where(eq(photos.hidden, false));

    if (availablePhotos.length < 2) {
      return null;
    }

    const shuffled = availablePhotos.sort(() => Math.random() - 0.5);
    return [shuffled[0], shuffled[1]];
  }

  async getVotesByDateRange(startDate?: string, endDate?: string): Promise<Vote[]> {
    let query = db.select().from(votes);
    
    if (startDate || endDate) {
      if (startDate && endDate) {
        query = query.where(sql`${votes.timestamp} >= ${startDate} AND ${votes.timestamp} <= ${endDate}`);
      } else if (startDate) {
        query = query.where(sql`${votes.timestamp} >= ${startDate}`);
      } else if (endDate) {
        query = query.where(sql`${votes.timestamp} <= ${endDate}`);
      }
    }
    
    return await query;
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
    const [deleted] = await db.delete(photos).where(eq(photos.id, id)).returning();
    return !!deleted;
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
}

// Use database storage instead of memory storage
export const storage = new DatabaseStorage();

// Initialize database with default photos if empty
async function initializeDatabase() {
  try {
    const existingPhotos = await storage.getAllPhotos();
    
    if (existingPhotos.length === 0) {
      console.log('Initializing database with default photos...');
      
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
      
      for (const photo of defaultPhotos) {
        await storage.createPhoto(photo);
      }
      
      console.log(`Initialized database with ${defaultPhotos.length} default photos`);
    }
  } catch (error) {
    console.error('Failed to initialize database:', error);
  }
}

// Initialize database on startup
initializeDatabase();
