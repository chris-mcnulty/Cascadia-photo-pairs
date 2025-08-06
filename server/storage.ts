import { type Photo, type InsertPhoto, type Vote, type InsertVote, type Settings, type InsertSettings } from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  // Photos
  getAllPhotos(): Promise<Photo[]>;
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
  getPhotoStats(startDate?: string, endDate?: string): Promise<Photo[]>;
  getRandomPhotoPair(): Promise<[Photo, Photo] | null>;
  getVotesByDateRange(startDate?: string, endDate?: string): Promise<Vote[]>;
  
  // Photo management
  deletePhoto(id: string): Promise<boolean>;
  purgeTestData(beforeDate: string): Promise<{ votesDeleted: number; photosReset: boolean }>;
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

export const storage = new MemStorage();
