import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertVoteSchema, insertSettingsSchema, insertPhotoSchema, updatePhotoSchema } from "@shared/schema";
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
      
      setSession(sessionId, {
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
      
      const session = getSession(sessionId);
      console.log(`Session state:`, session);
      
      if (!session.pendingMfa || !session.mfaCode) {
        console.log("No pending MFA verification");
        return res.status(401).json({ message: "No pending MFA verification" });
      }
      
      if (session.mfaExpiry && Date.now() > session.mfaExpiry) {
        console.log("MFA code expired");
        clearSession(sessionId);
        return res.status(401).json({ message: "Verification code expired" });
      }
      
      console.log(`Comparing codes - Received: "${code}", Expected: "${session.mfaCode}"`);
      if (code !== session.mfaCode) {
        console.log("Code mismatch");
        return res.status(401).json({ message: "Invalid verification code" });
      }
      
      console.log("MFA verification successful, setting authenticated session");
      setSession(sessionId, {
        isAuthenticated: true,
        pendingMfa: false
      });
      
      res.json({ message: "Authentication successful", authenticated: true });
    } catch (error) {
      console.error('MFA verification error:', error);
      res.status(500).json({ message: "Verification failed" });
    }
  });
  
  app.post("/api/auth/logout", (req, res) => {
    const sessionId = req.headers['x-session-id'] as string;
    if (sessionId) {
      clearSession(sessionId);
    }
    res.json({ message: "Logged out successfully" });
  });
  
  app.get("/api/auth/status", (req, res) => {
    const sessionId = req.headers['x-session-id'] as string;
    if (!sessionId) {
      return res.json({ authenticated: false });
    }
    
    const session = getSession(sessionId);
    res.json({ 
      authenticated: session.isAuthenticated,
      pendingMfa: session.pendingMfa 
    });
  });

  // Get all photos
  app.get("/api/photos", async (req, res) => {
    try {
      const photos = await storage.getAllPhotos();
      res.json(photos);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch photos" });
    }
  });

  // Add a new photo (admin only)
  app.post("/api/photos", requireAuth, async (req, res) => {
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
  app.put("/api/photos/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const photoData = updatePhotoSchema.parse(req.body);
      const photo = await storage.updatePhoto(id, photoData);
      if (!photo) {
        return res.status(404).json({ message: "Photo not found" });
      }
      res.json(photo);
    } catch (error) {
      res.status(400).json({ message: "Invalid photo data" });
    }
  });

  // Delete a photo (admin only)
  app.delete("/api/photos/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const deleted = await storage.deletePhoto(id);
      if (!deleted) {
        return res.status(404).json({ message: "Photo not found" });
      }
      res.json({ message: "Photo deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete photo" });
    }
  });

  // Get random photo pair for voting
  app.get("/api/photos/random-pair", async (req, res) => {
    try {
      const pair = await storage.getRandomPhotoPair();
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
  app.get("/api/stats", requireAuth, async (req, res) => {
    try {
      const { startDate, endDate } = req.query as { startDate?: string; endDate?: string };
      
      const totalVotes = await storage.getTotalVotes(startDate, endDate);
      const uniqueVoters = await storage.getUniqueVoters(startDate, endDate);
      const avgVotesPerUser = uniqueVoters > 0 ? totalVotes / uniqueVoters : 0;
      const topPhotos = await storage.getPhotoStats(startDate, endDate);
      
      res.json({
        totalVotes,
        uniqueVoters,
        avgVotesPerUser: Math.round(avgVotesPerUser * 10) / 10,
        topPhotos: topPhotos.slice(0, 20),
        dateRange: startDate && endDate ? { startDate, endDate } : null
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch statistics" });
    }
  });

  // Purge test data (admin only)
  app.post("/api/admin/purge-test-data", requireAuth, async (req, res) => {
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
  app.get("/api/settings", requireAuth, async (req, res) => {
    try {
      const settings = await storage.getSettings();
      res.json(settings);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch settings" });
    }
  });

  // Update settings (admin only)
  app.put("/api/settings", requireAuth, async (req, res) => {
    try {
      const settingsData = insertSettingsSchema.parse(req.body);
      const settings = await storage.updateSettings(settingsData);
      res.json(settings);
    } catch (error) {
      res.status(400).json({ message: "Invalid settings data" });
    }
  });

  // Export voting data (admin only)
  app.get("/api/export", requireAuth, async (req, res) => {
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

  const httpServer = createServer(app);
  return httpServer;
}
