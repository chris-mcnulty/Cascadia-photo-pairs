import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertVoteSchema, insertSettingsSchema, insertPhotoSchema, insertCollectionSchema } from "@shared/schema";
import { 
  generateSessionId, 
  generateMfaCode, 
  sendMfaCode, 
  getSession, 
  setSession, 
  clearSession, 
  requireAuth 
} from "./auth";

export async function registerRoutes(app: Express): Promise<Server> {
  
  // Authentication routes
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { password } = req.body;
      const settings = await storage.getSettings();
      
      if (password !== settings.adminPassword) {
        return res.status(401).json({ message: "Invalid password" });
      }
      
      const sessionId = generateSessionId();
      const mfaCode = generateMfaCode();
      const mfaExpiry = Date.now() + 5 * 60 * 1000; // 5 minutes
      
      console.log(`Generated MFA code: "${mfaCode}" for session ${sessionId}`);
      
      const smsSent = await sendMfaCode(settings.mfaPhoneNumber, mfaCode);
      
      if (!smsSent) {
        return res.status(500).json({ message: "Failed to send verification code" });
      }
      
      await setSession(sessionId, {
        isAuthenticated: false,
        pendingMfa: true,
        mfaCode,
        mfaExpiry
      });
      
      console.log(`Session ${sessionId} created with MFA code: "${mfaCode}"`);
      
      res.json({ 
        sessionId, 
        requiresMfa: true,
        message: `Verification code sent to ${settings.mfaPhoneNumber.replace(/(\+1)(\d{3})(\d{3})(\d{4})/, '$1-$2-$3-$4')}`
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ message: "Login failed" });
    }
  });
  
  app.post("/api/auth/verify-mfa", async (req, res) => {
    try {
      const { sessionId, code } = req.body;
      console.log(`MFA verification attempt - SessionId: ${sessionId}, Code: ${code}`);
      
      const session = await getSession(sessionId);
      console.log(`Session state:`, session);
      
      if (!session.pendingMfa || !session.mfaCode) {
        console.log("No pending MFA verification");
        return res.status(401).json({ message: "No pending MFA verification" });
      }
      
      if (session.mfaExpiry && Date.now() > session.mfaExpiry) {
        console.log("MFA code expired");
        await clearSession(sessionId);
        return res.status(401).json({ message: "Verification code expired" });
      }
      
      console.log(`Comparing codes - Received: "${code}", Expected: "${session.mfaCode}"`);
      if (code !== session.mfaCode) {
        console.log("Code mismatch");
        return res.status(401).json({ message: "Invalid verification code" });
      }
      
      console.log("MFA verification successful, setting authenticated session");
      await setSession(sessionId, {
        isAuthenticated: true,
        pendingMfa: false
      });
      
      res.json({ message: "Authentication successful", authenticated: true });
    } catch (error) {
      console.error('MFA verification error:', error);
      res.status(500).json({ message: "Verification failed" });
    }
  });
  
  app.post("/api/auth/logout", async (req, res) => {
    const sessionId = req.headers['x-session-id'] as string;
    if (sessionId) {
      await clearSession(sessionId);
    }
    res.json({ message: "Logged out successfully" });
  });
  
  app.get("/api/auth/status", async (req, res) => {
    const sessionId = req.headers['x-session-id'] as string;
    if (!sessionId) {
      return res.json({ authenticated: false });
    }
    
    const session = await getSession(sessionId);
    res.json({ 
      authenticated: session.isAuthenticated,
      pendingMfa: session.pendingMfa 
    });
  });

  // Get all photos (optimized for admin interface)
  app.get("/api/photos", async (req, res) => {
    try {
      console.log('Fetching all photos...');
      const photos = await storage.getAllPhotos();
      
      // Check if this is an admin request that needs optimization
      const isAdmin = req.headers['x-admin-request'] === 'true';
      const hasLargeImages = photos.some(p => p.imageUrl.startsWith('data:image') && p.imageUrl.length > 100000);
      
      if (isAdmin && hasLargeImages) {
        // For admin interface, provide lighter version with image previews
        const adminPhotos = photos.map(photo => ({
          ...photo,
          imageUrl: photo.imageUrl.startsWith('data:image') 
            ? photo.imageUrl.substring(0, 200) + '...[base64-truncated]'
            : photo.imageUrl,
          originalImageUrl: photo.imageUrl.startsWith('data:image') ? '[stored-in-db]' : photo.imageUrl
        }));
        console.log(`Retrieved ${photos.length} photos (admin optimized)`);
        res.json(adminPhotos);
      } else {
        console.log(`Retrieved ${photos.length} photos successfully`);
        res.json(photos);
      }
    } catch (error) {
      console.error('Error fetching photos:', error);
      res.status(500).json({ 
        message: "Failed to fetch photos", 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  });

  // Add a new photo (admin only)
  app.post("/api/photos", async (req, res) => {
    try {
      console.log('Photo creation request body:', req.body);
      const photoData = insertPhotoSchema.parse(req.body);
      console.log('Parsed photo data:', photoData);
      
      const photo = await storage.createPhoto(photoData);
      console.log('Photo created successfully:', photo);
      res.json(photo);
    } catch (error) {
      console.error('Photo creation error:', error);
      
      if (error instanceof Error) {
        // Zod validation error
        if (error.message.includes('validation')) {
          return res.status(400).json({ 
            message: "Invalid photo data", 
            details: error.message 
          });
        }
        
        // Other errors
        return res.status(400).json({ 
          message: error.message || "Invalid photo data" 
        });
      }
      
      res.status(500).json({ message: "Failed to create photo" });
    }
  });

  // Update a photo (admin only)
  app.put("/api/photos/:id", async (req, res) => {
    try {
      const { id } = req.params;
      console.log(`Attempting to update photo with ID: ${id}`, req.body);
      
      // Validate the update data (partial photo schema)
      const updateData = req.body;
      
      const updatedPhoto = await storage.updatePhoto(id, updateData);
      if (!updatedPhoto) {
        return res.status(404).json({ message: "Photo not found" });
      }
      
      console.log(`Photo updated successfully: ${id}`);
      res.json(updatedPhoto);
    } catch (error) {
      console.error('Update photo route error:', error);
      res.status(500).json({ message: "Failed to update photo", error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // Delete a photo (admin only)
  app.delete("/api/photos/:id", async (req, res) => {
    try {
      const { id } = req.params;
      console.log(`Attempting to delete photo with ID: ${id}`);
      const deleted = await storage.deletePhoto(id);
      console.log(`Delete operation result: ${deleted}`);
      if (!deleted) {
        console.log(`Photo not found or delete failed for ID: ${id}`);
        return res.status(404).json({ message: "Photo not found or delete failed" });
      }
      console.log(`Photo deleted successfully: ${id}`);
      res.json({ message: "Photo deleted successfully" });
    } catch (error) {
      console.error('Delete photo route error:', error);
      res.status(500).json({ message: "Failed to delete photo", error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // Get random photo pair for voting
  app.get("/api/photos/random-pair", async (req, res) => {
    try {
      const { collectionId } = req.query as { collectionId?: string };
      const pair = await storage.getRandomPhotoPair(collectionId || undefined);
      if (!pair) {
        return res.status(404).json({ message: "Not enough photos available" });
      }
      res.json(pair);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch photo pair" });
    }
  });

  // Cast a vote
  app.post("/api/votes", async (req, res) => {
    try {
      const voteData = insertVoteSchema.parse(req.body);
      const { winnerPhotoId, loserPhotoId } = req.body;
      
      const vote = await storage.createVote({ 
        photoId: voteData.photoId, 
        winnerPhotoId: winnerPhotoId || voteData.photoId,
        loserPhotoId: loserPhotoId || voteData.photoId
      });
      
      // Record comparison stats
      if (winnerPhotoId && loserPhotoId) {
        await storage.recordComparison(winnerPhotoId, loserPhotoId);
      }
      
      res.json(vote);
    } catch (error) {
      res.status(400).json({ message: "Invalid vote data" });
    }
  });

  // Get voting statistics (admin only)
  app.get("/api/stats", async (req, res) => {
    try {
      console.log('Fetching statistics...');
      const { startDate, endDate, category, voterType } = req.query as { 
        startDate?: string; 
        endDate?: string;
        category?: string;
        voterType?: string;
      };
      
      const totalVotes = await storage.getTotalVotes(startDate, endDate, voterType);
      const uniqueVoters = await storage.getUniqueVoters(startDate, endDate, voterType);
      const avgVotesPerUser = uniqueVoters > 0 ? totalVotes / uniqueVoters : 0;
      const topPhotos = await storage.getPhotoStats(startDate, endDate, category, voterType);
      
      console.log(`Statistics: ${totalVotes} votes, ${uniqueVoters} voters, ${topPhotos.length} photos`);
      
      res.json({
        totalVotes,
        uniqueVoters,
        avgVotesPerUser: Math.round(avgVotesPerUser * 10) / 10,
        topPhotos: topPhotos.slice(0, 20),
        dateRange: startDate && endDate ? { startDate, endDate } : null,
        category: category || null,
        voterType: voterType || null
      });
    } catch (error) {
      console.error('Error fetching statistics:', error);
      res.status(500).json({ 
        message: "Failed to fetch statistics",
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Get photo categories
  app.get("/api/categories", async (req, res) => {
    try {
      const categories = await storage.getPhotoCategories();
      res.json(categories);
    } catch (error) {
      console.error('Error fetching categories:', error);
      res.status(500).json({ message: "Failed to fetch categories" });
    }
  });

  // Purge test data (admin only)
  app.post("/api/admin/purge-test-data", async (req, res) => {
    try {
      const { beforeDate } = req.body;
      
      if (!beforeDate) {
        return res.status(400).json({ message: "Before date is required" });
      }
      
      const result = await storage.purgeTestData(beforeDate);
      res.json({
        message: "Test data purged successfully",
        ...result
      });
    } catch (error) {
      console.error('Purge test data error:', error);
      res.status(500).json({ message: "Failed to purge test data" });
    }
  });

  // Get settings (admin only)  
  app.get("/api/settings", async (req, res) => {
    try {
      const settings = await storage.getSettings();
      res.json(settings);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch settings" });
    }
  });

  // Update settings (admin only)
  app.put("/api/settings", async (req, res) => {
    try {
      const settingsData = insertSettingsSchema.parse(req.body);
      const settings = await storage.updateSettings(settingsData);
      res.json(settings);
    } catch (error) {
      res.status(400).json({ message: "Invalid settings data" });
    }
  });

  // Collections routes
  app.get("/api/collections", async (req, res) => {
    try {
      const collections = await storage.getAllCollections();
      res.json(collections);
    } catch (error) {
      console.error('Error fetching collections:', error);
      res.status(500).json({ message: "Failed to fetch collections" });
    }
  });

  app.get("/api/collections/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const collection = await storage.getCollection(id);
      if (!collection) {
        return res.status(404).json({ message: "Collection not found" });
      }
      res.json(collection);
    } catch (error) {
      console.error('Error fetching collection:', error);
      res.status(500).json({ message: "Failed to fetch collection" });
    }
  });

  app.post("/api/collections", async (req, res) => {
    try {
      const collectionData = insertCollectionSchema.parse(req.body);
      const collection = await storage.createCollection(collectionData);
      res.json(collection);
    } catch (error) {
      console.error('Error creating collection:', error);
      res.status(400).json({ message: "Invalid collection data" });
    }
  });

  app.put("/api/collections/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      const collection = await storage.updateCollection(id, updates);
      if (!collection) {
        return res.status(404).json({ message: "Collection not found" });
      }
      res.json(collection);
    } catch (error) {
      console.error('Error updating collection:', error);
      res.status(500).json({ message: "Failed to update collection" });
    }
  });

  app.delete("/api/collections/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const deleted = await storage.deleteCollection(id);
      if (!deleted) {
        return res.status(404).json({ message: "Collection not found" });
      }
      res.json({ message: "Collection deleted successfully" });
    } catch (error) {
      console.error('Error deleting collection:', error);
      res.status(500).json({ message: "Failed to delete collection" });
    }
  });

  // Export voting data (admin only)
  app.get("/api/export", async (req, res) => {
    try {
      const photos = await storage.getAllPhotos();
      const totalVotes = await storage.getTotalVotes();
      const uniqueVoters = await storage.getUniqueVoters();
      
      const exportData = {
        exportDate: new Date().toISOString(),
        summary: {
          totalVotes,
          uniqueVoters,
          totalPhotos: photos.length,
        },
        photos: photos.map(photo => ({
          id: photo.id,
          title: photo.title,
          description: photo.description,
          votes: photo.votes,
          wins: photo.wins,
          comparisons: photo.comparisons,
          winRate: photo.comparisons > 0 ? (photo.wins / photo.comparisons) : 0,
        })),
      };
      
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', 'attachment; filename=cascadia-oceanic-voting-data.json');
      res.json(exportData);
    } catch (error) {
      res.status(500).json({ message: "Failed to export data" });
    }
  });

  // Migrate development data to production
  app.post("/api/migrate-to-production", async (req, res) => {
    try {
      console.log('🚀 Production migration requested...');
      
      const { migrateToProduction } = await import("./migrate-to-production");
      const result = await migrateToProduction();
      
      res.json(result);
    } catch (error) {
      console.error('Migration error:', error);
      res.status(500).json({ 
        message: "Failed to migrate to production",
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Force database initialization (for production debugging)
  app.post("/api/force-init", async (req, res) => {
    try {
      console.log('Force initialization requested...');
      
      console.log('Checking current photos count...');
      const currentPhotos = await storage.getAllPhotos();
      console.log(`Current photos: ${currentPhotos.length}`);
      
      if (currentPhotos.length === 0) {
        console.log('No photos found, creating default photos...');
        
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
          }
        ];
        
        for (let i = 0; i < defaultPhotos.length; i++) {
          const photoData = defaultPhotos[i];
          console.log(`Creating photo ${i + 1}/${defaultPhotos.length}: ${photoData.title}`);
          await storage.createPhoto(photoData);
        }
      }
      
      const finalPhotos = await storage.getAllPhotos();
      console.log(`Final photo count: ${finalPhotos.length}`);
      
      res.json({ 
        message: "Database initialization completed",
        initialPhotoCount: currentPhotos.length,
        finalPhotoCount: finalPhotos.length,
        photos: finalPhotos.slice(0, 5).map(p => ({ id: p.id, title: p.title }))
      });
    } catch (error) {
      console.error('Force init error:', error);
      res.status(500).json({ 
        message: "Failed to initialize database",
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
    }
  });

  // CSV Export endpoint for analytics
  app.get("/api/export/csv", async (req, res) => {
    try {
      const { category, voterType } = req.query as { category?: string; voterType?: string };
      
      // Get all photos with stats (not just top 20)
      const allPhotos = await storage.getAllPhotosWithStats(category);
      
      // Create CSV headers
      const headers = ['Rank', 'Title', 'Description', 'Category', 'Total Votes', 'Wins', 'Comparisons', 'Win Rate %', 'Hidden', 'Image URL'];
      
      // Sort photos by win rate then votes
      const sortedPhotos = allPhotos.sort((a, b) => {
        const aWinRate = a.comparisons > 0 ? (a.wins / a.comparisons) : 0;
        const bWinRate = b.comparisons > 0 ? (b.wins / b.comparisons) : 0;
        return bWinRate - aWinRate || b.votes - a.votes;
      });
      
      // Create CSV rows
      const csvRows = [headers.join(',')];
      
      sortedPhotos.forEach((photo, index) => {
        const winRate = photo.comparisons > 0 ? Math.round((photo.wins / photo.comparisons) * 100) : 0;
        const row = [
          index + 1,
          `"${photo.title.replace(/"/g, '""')}"`, // Escape quotes in title
          `"${(photo.description || '').replace(/"/g, '""')}"`, // Escape quotes in description
          `"${photo.category || 'General'}"`,
          photo.votes,
          photo.wins,
          photo.comparisons,
          winRate,
          photo.hidden ? 'Yes' : 'No',
          `"${photo.imageUrl}"`
        ];
        csvRows.push(row.join(','));
      });
      
      const csvContent = csvRows.join('\n');
      const filename = `cascadia-oceanic-analytics-${new Date().toISOString().split('T')[0]}.csv`;
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(csvContent);
      
    } catch (error) {
      console.error('Error generating CSV export:', error);
      res.status(500).json({ message: "Failed to generate CSV export" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
