import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertVoteSchema, insertSettingsSchema } from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  
  // Get all photos
  app.get("/api/photos", async (req, res) => {
    try {
      const photos = await storage.getAllPhotos();
      res.json(photos);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch photos" });
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
      
      const vote = await storage.createVote({ photoId: voteData.photoId });
      
      // Record comparison stats
      if (winnerPhotoId && loserPhotoId) {
        await storage.recordComparison(winnerPhotoId, loserPhotoId);
      }
      
      res.json(vote);
    } catch (error) {
      res.status(400).json({ message: "Invalid vote data" });
    }
  });

  // Get voting statistics
  app.get("/api/stats", async (req, res) => {
    try {
      const totalVotes = await storage.getTotalVotes();
      const uniqueVoters = await storage.getUniqueVoters();
      const avgVotesPerUser = uniqueVoters > 0 ? totalVotes / uniqueVoters : 0;
      const topPhotos = await storage.getPhotoStats();
      
      res.json({
        totalVotes,
        uniqueVoters,
        avgVotesPerUser: Math.round(avgVotesPerUser * 10) / 10,
        topPhotos: topPhotos.slice(0, 20),
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch statistics" });
    }
  });

  // Get settings
  app.get("/api/settings", async (req, res) => {
    try {
      const settings = await storage.getSettings();
      res.json(settings);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch settings" });
    }
  });

  // Update settings
  app.put("/api/settings", async (req, res) => {
    try {
      const settingsData = insertSettingsSchema.parse(req.body);
      const settings = await storage.updateSettings(settingsData);
      res.json(settings);
    } catch (error) {
      res.status(400).json({ message: "Invalid settings data" });
    }
  });

  // Export voting data
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

  const httpServer = createServer(app);
  return httpServer;
}
