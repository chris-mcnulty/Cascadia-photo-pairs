import type { Express } from "express";
import { createServer, type Server } from "http";
import { db } from "./db";
import { 
  photos, 
  votes, 
  settings, 
  settings as settingsTable,
  collections, 
  users, 
  emailVerifications, 
  userStats, 
  newsItems as newsItemsTable 
} from "@shared/schema";
import { eq, sql, and, or, inArray, gte, lte, desc, isNull } from "drizzle-orm";
import { storage } from "./storage";
import { insertVoteSchema, insertSettingsSchema, insertPhotoSchema, insertCollectionSchema } from "@shared/schema";
import { 
  createUser, 
  authenticateUser, 
  generateToken, 
  verifyToken,
  resetPassword,
  generateVerificationToken,
  trackUserVote
} from "./auth";
import { sendVerificationEmail, sendPasswordResetEmail } from "./email";
import { sendAdminMFACode, isEmailServiceAvailable, isSMSServiceAvailable } from "./sendgrid";
import { rssService } from "./rss-service";

// Simple middleware for admin auth check (for pairs endpoints)
const isAuthenticated = async (req: any, res: any, next: any) => {
  const sessionId = req.headers['x-session-id'];
  if (sessionId === 'admin-session') {
    return next();
  }
  return res.status(401).json({ message: "Admin authentication required" });
};

// Temporary storage for MFA sessions
const adminMfaSessions = new Map<string, { code: string; expires: number; isMasterAdmin: boolean }>();

// Helper functions for admin authentication
async function checkAdminAuth(req: any): Promise<{ authenticated: boolean; isAdmin: boolean }> {
  try {
    const sessionId = req.headers['x-session-id'] || req.query.sessionId;
    
    if (!sessionId || sessionId !== 'admin-session') {
      return { authenticated: false, isAdmin: false };
    }
    
    // Simple session validation - admin is authenticated
    return { authenticated: true, isAdmin: true };
  } catch (error) {
    return { authenticated: false, isAdmin: false };
  }
}

async function getCurrentAdminUser(req: any): Promise<any> {
  try {
    // Check for backdoor MFA challenge
    const mfaChallenge = req.headers['x-mfa-challenge'] || req.query.mfaChallenge;
    if (mfaChallenge === '121365') {
      // Return the new master admin user for backdoor access
      const [user] = await db.select().from(users).where(eq(users.email, 'cmcnulty2000@yahoo.com'));
      return user;
    }
    
    // Default to original master admin
    const [user] = await db.select().from(users).where(eq(users.email, 'chris.mcnulty@synozur.com'));
    return user;
  } catch (error) {
    return null;
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  
  // Admin Authentication routes (temporarily simplified)
  app.post("/api/auth/admin-login", async (req, res) => {
    try {
      const { password } = req.body;
      const settings = await storage.getSettings();
      
      if (!password) {
        return res.status(400).json({ message: "Password is required" });
      }
      
      // Check for master admin password
      const isMasterAdmin = password === 'BradyBunch12!';
      const isCoAdmin = password === settings.adminPassword;
      
      if (!isMasterAdmin && !isCoAdmin) {
        return res.status(401).json({ message: "Invalid password" });
      }
      
      // Generate a session ID that includes the admin type
      const sessionId = isMasterAdmin 
        ? 'chris-master-admin-' + Math.random().toString(36).substring(2) 
        : 'admin-' + Math.random().toString(36).substring(2);
      
      // Store session temporarily for MFA verification
      const tempSession = {
        sessionId,
        isMasterAdmin,
        timestamp: Date.now()
      };
      
      // Always require MFA for security
      // Generate 6-digit code
      const mfaCode = Math.floor(100000 + Math.random() * 900000).toString();
      
      // Store MFA code temporarily (expires in 5 minutes)
      adminMfaSessions.set(sessionId, {
        code: mfaCode,
        expires: Date.now() + 300000,
        isMasterAdmin
      });
      
      // Try to send SMS if services are configured
      const phoneNumber = isMasterAdmin ? '+1-503-XXX-XXXX' : '+1-XXX-XXX-XXXX';
      const adminName = isMasterAdmin ? 'Chris McNulty' : 'Admin';
      
      // Check if SMS service is available
      const smsAvailable = isSMSServiceAvailable();
      const emailAvailable = isEmailServiceAvailable();
      
      // Try to send MFA code
      let smsSent = false;
      if (smsAvailable) {
        smsSent = await sendAdminMFACode(phoneNumber, mfaCode, adminName);
      }
      
      // Log the MFA code for debugging (remove in production)
      console.log(`[Admin MFA] Generated code for ${adminName}: ${mfaCode}`);
      if (!smsSent) {
        console.log(`[Admin MFA] SMS not sent. Failsafe code available: 121365`);
      }
      
      res.json({ 
        sessionId,
        requiresMfa: true,
        message: smsSent 
          ? `Verification code sent to ${phoneNumber}` 
          : `SMS service unavailable. Enter failsafe code 121365 to proceed.`
      });
    } catch (error) {
      console.error('Admin login error:', error);
      res.status(500).json({ message: "Login failed" });
    }
  });
  
  // Admin MFA Verification
  app.post("/api/auth/verify-mfa", async (req, res) => {
    try {
      const { sessionId, code } = req.body;
      
      if (!sessionId || !code) {
        return res.status(400).json({ message: "Session ID and verification code are required" });
      }
      
      const mfaSession = adminMfaSessions.get(sessionId);
      
      if (!mfaSession) {
        return res.status(401).json({ message: "Invalid or expired session" });
      }
      
      // Check if session has expired
      if (Date.now() > mfaSession.expires) {
        adminMfaSessions.delete(sessionId);
        return res.status(401).json({ message: "Verification code has expired" });
      }
      
      // Check the code or backdoor
      const isValidCode = code === mfaSession.code;
      const isBackdoorCode = code === '121365' && mfaSession.isMasterAdmin;
      
      if (!isValidCode && !isBackdoorCode) {
        return res.status(401).json({ message: "Invalid verification code" });
      }
      
      // Clean up the MFA session
      adminMfaSessions.delete(sessionId);
      
      // Generate final session ID
      const finalSessionId = mfaSession.isMasterAdmin 
        ? 'chris-master-admin-121365'
        : sessionId;
      
      // Generate proper user token for master admin so they get user features
      let userToken = null;
      if (mfaSession.isMasterAdmin) {
        const [masterAdminUser] = await db.select().from(users).where(eq(users.email, 'cmcnulty2000@yahoo.com'));
        if (masterAdminUser) {
          userToken = generateToken({
            userId: masterAdminUser.id,
            email: masterAdminUser.email,
            isAdmin: true,
          });
        }
      }
      
      res.json({
        sessionId: finalSessionId,
        authenticated: true,
        isMasterAdmin: mfaSession.isMasterAdmin,
        userToken: userToken,
        message: "Authentication successful"
      });
    } catch (error) {
      console.error('MFA verification error:', error);
      res.status(500).json({ message: "Verification failed" });
    }
  });
  
  // User Registration
  app.post("/api/auth/register", async (req, res) => {
    try {
      const { email, password, firstName, lastName } = req.body;
      
      if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required" });
      }
      
      // Check if user already exists
      const [existingUser] = await db.select().from(users).where(eq(users.email, email));
      if (existingUser) {
        return res.status(409).json({ message: "Email already registered" });
      }
      
      // Generate username from email
      const username = email.split('@')[0];
      
      // Create user
      const user = await createUser(email, username, password, firstName, lastName);
      
      // Generate verification token
      const verificationToken = generateVerificationToken();
      await db.insert(emailVerifications).values({
        userId: user.id,
        token: verificationToken,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      });
      
      // Send verification email (if email service is configured)
      await sendVerificationEmail(email, verificationToken);
      
      res.json({ 
        message: "Registration successful! Please check your email to verify your account.",
        userId: user.id
      });
    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({ message: "Registration failed" });
    }
  });
  
  // User Login
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = req.body;
      
      if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required" });
      }
      

      
      const user = await authenticateUser(email, password);
      if (!user) {
        // Special message for master admin to use admin login
        if (email === 'cmcnulty2000@yahoo.com') {
          return res.status(401).json({ 
            message: "Master admin account requires secure login. Please access /admin-login directly." 
          });
        }
        return res.status(401).json({ message: "Invalid email or password" });
      }
      
      // Generate JWT token
      const token = generateToken({
        userId: user.id,
        email: user.email,
        isAdmin: user.isAdmin || false,
      });
      
      res.json({ 
        token,
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          firstName: user.firstName,
          lastName: user.lastName,
          isAdmin: user.isAdmin,
          emailVerified: user.emailVerified,
        }
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ message: "Login failed" });
    }
  });
  
  // Request Password Reset
  app.post("/api/auth/request-reset", async (req, res) => {
    try {
      const { email } = req.body;
      
      if (!email) {
        return res.status(400).json({ message: "Email is required" });
      }
      
      // Generate 6-digit code instead of long token for better UX
      const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
      const expiry = new Date(Date.now() + 3600000); // 1 hour
      
      // Update user with reset code
      const [user] = await db.select().from(users).where(eq(users.email, email));
      if (user) {
        await db
          .update(users)
          .set({ 
            resetToken: resetCode,
            resetTokenExpiry: expiry 
          })
          .where(eq(users.id, user.id));
        
        // Send reset email
        await sendPasswordResetEmail(email, resetCode);
      }
      
      // Always return success to prevent email enumeration
      res.json({ message: "If the email exists, a reset code has been sent" });
    } catch (error) {
      console.error('Password reset request error:', error);
      res.status(500).json({ message: "Failed to process reset request" });
    }
  });
  
  // Reset Password
  app.post("/api/auth/reset-password", async (req, res) => {
    try {
      const { token, password } = req.body;
      
      if (!token || !password) {
        return res.status(400).json({ message: "Reset code and new password are required" });
      }
      
      const success = await resetPassword(token, password);
      if (!success) {
        return res.status(400).json({ message: "Invalid or expired reset code" });
      }
      
      res.json({ message: "Password reset successful" });
    } catch (error) {
      console.error('Password reset error:', error);
      res.status(500).json({ message: "Failed to reset password" });
    }
  });
  
  // Update user profile
  app.put("/api/user/profile", async (req, res) => {
    try {
      let userId: string;
      let isAdmin = false;
      
      // Check for admin session first
      const sessionId = req.headers['x-session-id'] as string;
      if (sessionId === 'admin-session') {
        // This is an admin session - use the master admin user
        userId = '4d2c0db4-a62b-4849-a352-72f7164c5e78'; // Chris McNulty's user ID
        isAdmin = true;
      } else {
        // Check for regular JWT token
        const authHeader = req.headers.authorization;
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          return res.status(401).json({ message: "Authentication required" });
        }
        
        const token = authHeader.substring(7);
        const payload = verifyToken(token);
        
        if (!payload) {
          return res.status(401).json({ message: "Invalid token" });
        }
        
        userId = payload.userId;
        isAdmin = payload.isAdmin || false;
      }
      
      const { firstName, lastName, username, profileImageUrl } = req.body;
      
      // Validate profile image URL if provided
      if (profileImageUrl && profileImageUrl.trim()) {
        try {
          const url = new URL(profileImageUrl);
          // Only allow HTTP/HTTPS protocols
          if (!['http:', 'https:'].includes(url.protocol)) {
            return res.status(400).json({ message: "Profile image URL must use HTTP or HTTPS protocol" });
          }
          // Block potentially dangerous schemes
          if (['javascript:', 'data:', 'vbscript:', 'file:'].includes(url.protocol)) {
            return res.status(400).json({ message: "Invalid profile image URL protocol" });
          }
        } catch (error) {
          return res.status(400).json({ message: "Invalid profile image URL format" });
        }
      }
      
      // Update user profile
      const [updatedUser] = await db
        .update(users)
        .set({
          firstName,
          lastName,
          username,
          profileImageUrl: profileImageUrl || null,
          updatedAt: new Date()
        })
        .where(eq(users.id, userId))
        .returning();
      
      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }
      
      res.json(updatedUser);
    } catch (error) {
      console.error('Error updating user profile:', error);
      res.status(500).json({ message: "Failed to update profile" });
    }
  });
  
  // Get current user data
  app.get("/api/auth/user", async (req, res) => {
    try {
      let userId: string;
      
      // Check for admin session first
      const sessionId = req.headers['x-session-id'] as string;
      if (sessionId === 'admin-session') {
        // This is an admin session - use the master admin user
        userId = '4d2c0db4-a62b-4849-a352-72f7164c5e78'; // Chris McNulty's user ID
      } else {
        // Check for regular JWT token
        const authHeader = req.headers.authorization;
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          return res.status(401).json({ message: "Authentication required" });
        }
        
        const token = authHeader.substring(7);
        const payload = verifyToken(token);
        
        if (!payload) {
          return res.status(401).json({ message: "Invalid token" });
        }
        
        userId = payload.userId;
      }
      
      // Get user data from database
      const [user] = await db.select({
        id: users.id,
        email: users.email,
        username: users.username,
        firstName: users.firstName,
        lastName: users.lastName,
        profileImageUrl: users.profileImageUrl,
        isAdmin: users.isAdmin,
        emailVerified: users.emailVerified,
        createdAt: users.createdAt
      }).from(users).where(eq(users.id, userId));
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      res.json(user);
    } catch (error) {
      console.error('Error fetching user data:', error);
      res.status(500).json({ message: "Failed to fetch user data" });
    }
  });
  
  // Get Admin Auth Status (separate endpoint for admin panel)
  app.get("/api/auth/admin-status", async (req, res) => {
    const adminSessionId = req.headers['x-session-id'] as string;
    if (adminSessionId) {
      // This confirms admin panel access
      return res.json({ 
        authenticated: true,
        isAdmin: true
      });
    }
    return res.json({ authenticated: false, isAdmin: false });
  });
  
  // Get Auth Status
  app.get("/api/auth/status", async (req, res) => {
    // Check for user JWT token first (not admin session)
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const payload = verifyToken(token);
      
      if (payload) {
        return res.json({ 
          authenticated: true,
          userId: payload.userId,
          isAdmin: payload.isAdmin || false
        });
      }
    }
    
    // Check for admin session (separate from user auth)
    const adminSessionId = req.headers['x-session-id'] as string;
    if (adminSessionId) {
      // This is only for admin panel access, not user features
      return res.json({ 
        authenticated: true,
        isAdmin: true
      });
    }
    
    return res.json({ authenticated: false });
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

  // Add a new photo (admin only - temporarily without auth)
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

  // Bulk update photo sale status (admin only) - MUST come before the :id routes
  app.put("/api/photos/bulk-sale", async (req, res) => {
    try {
      const { photoIds, neverForSale } = req.body;
      
      if (!Array.isArray(photoIds) || photoIds.length === 0) {
        return res.status(400).json({ message: "Invalid photoIds array" });
      }
      
      if (typeof neverForSale !== 'boolean') {
        return res.status(400).json({ message: "Invalid neverForSale value" });
      }
      
      console.log(`Bulk updating ${photoIds.length} photos sale status to: ${neverForSale ? 'not for sale' : 'for sale'}`, photoIds);
      const updated = await storage.updatePhotosSaleStatus(photoIds, neverForSale);
      
      if (!updated) {
        return res.status(404).json({ message: "No photos were updated" });
      }
      
      console.log(`Successfully updated photo sale status`);
      res.json({ message: "Photo sale status updated successfully" });
    } catch (error) {
      console.error('Bulk sale status update route error:', error);
      res.status(500).json({ message: "Failed to update photo sale status", error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // Bulk update photo categories (admin only) - MUST come before the :id routes
  app.put("/api/photos/bulk-category", async (req, res) => {
    try {
      const { photoIds, category } = req.body;
      
      if (!Array.isArray(photoIds) || photoIds.length === 0) {
        return res.status(400).json({ message: "Invalid photoIds array" });
      }
      
      if (!category || typeof category !== 'string') {
        return res.status(400).json({ message: "Invalid category" });
      }
      
      console.log(`Bulk updating ${photoIds.length} photos to category: ${category}`, photoIds);
      const updated = await storage.updatePhotosCategory(photoIds, category);
      
      if (!updated) {
        return res.status(404).json({ message: "No photos were updated" });
      }
      
      console.log(`Successfully updated photo categories`);
      res.json({ message: "Photo categories updated successfully" });
    } catch (error) {
      console.error('Bulk category update route error:', error);
      res.status(500).json({ message: "Failed to update photo categories", error: error instanceof Error ? error.message : 'Unknown error' });
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

  // Update photo visibility (admin only)
  app.put("/api/photos/:id/visibility", async (req, res) => {
    try {
      const { id } = req.params;
      const { hidden } = req.body;
      
      if (typeof hidden !== 'boolean') {
        return res.status(400).json({ message: "Invalid hidden value - must be boolean" });
      }
      
      console.log(`Updating photo visibility - ID: ${id}, hidden: ${hidden}`);
      const updatedPhoto = await storage.updatePhoto(id, { hidden });
      
      if (!updatedPhoto) {
        return res.status(404).json({ message: "Photo not found" });
      }
      
      console.log(`Photo visibility updated successfully: ${id}`);
      res.json(updatedPhoto);
    } catch (error) {
      console.error('Update photo visibility route error:', error);
      res.status(500).json({ message: "Failed to update photo visibility", error: error instanceof Error ? error.message : 'Unknown error' });
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
      
      // Determine voter type and user ID
      let voterType = 'user';
      let userId: string | undefined;
      
      // Check for admin session
      const sessionId = req.headers['x-session-id'] as string;
      if (sessionId) {
        voterType = 'admin';
        // For admin votes, assign to the master admin by default
        // This matches the data we corrected earlier
        userId = '4d2c0db4-a62b-4849-a352-72f7164c5e78'; // Chris McNulty's user ID
      }
      
      // Check for user JWT token
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        const payload = verifyToken(token);
        if (payload) {
          userId = payload.userId;
          // If user has admin role, set voter type to admin
          if (payload.isAdmin) {
            voterType = 'admin';
          }
        }
      }
      
      const vote = await storage.createVote({ 
        photoId: voteData.photoId, 
        winnerPhotoId: winnerPhotoId || voteData.photoId,
        loserPhotoId: loserPhotoId || voteData.photoId,
        voterType,
        userId
      });
      
      // Record comparison stats
      if (winnerPhotoId && loserPhotoId) {
        await storage.recordComparison(winnerPhotoId, loserPhotoId);
      }
      
      // Track user vote statistics if userId is present
      if (userId) {
        await trackUserVote(userId);
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
        topPhotos: topPhotos, // Remove server-side limit - let frontend control display
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
      
      // Determine which login setting to use based on environment
      const isDevelopment = process.env.NODE_ENV === 'development';
      const userLoginEnabled = isDevelopment 
        ? settings.userLoginEnabledDev 
        : settings.userLoginEnabledProd;
      
      // Send settings with the appropriate login flag for the current environment
      res.json({
        ...settings,
        userLoginEnabled, // Add a computed field for the current environment
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch settings" });
    }
  });

  // Update settings (admin only)
  app.put("/api/settings", async (req, res) => {
    try {
      console.log('Received settings data:', JSON.stringify(req.body, null, 2));
      
      // Transform date strings to Date objects for validation
      const processedData = { ...req.body };
      
      // Handle all possible date formats (strings, Date objects, or null)
      const processDate = (dateValue: any) => {
        if (!dateValue) return null;
        if (typeof dateValue === 'string') return new Date(dateValue);
        if (dateValue instanceof Date) return dateValue;
        return null;
      };
      
      processedData.monthlyContestStartDate = processDate(processedData.monthlyContestStartDate);
      processedData.monthlyContestEndDate = processDate(processedData.monthlyContestEndDate);
      processedData.quarterlyContestStartDate = processDate(processedData.quarterlyContestStartDate);
      processedData.quarterlyContestEndDate = processDate(processedData.quarterlyContestEndDate);
      
      const settingsData = insertSettingsSchema.parse(processedData);
      console.log('Parsed settings data:', JSON.stringify(settingsData, null, 2));
      const settings = await storage.updateSettings(settingsData);
      res.json(settings);
    } catch (error) {
      console.error('Settings validation error:', error);
      if (error instanceof Error) {
        res.status(400).json({ 
          message: "Invalid settings data", 
          error: error.message,
          details: error
        });
      } else {
        res.status(400).json({ message: "Invalid settings data" });
      }
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

  // Leaderboard endpoints (public)
  app.get("/api/leaderboard/votes", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      const topPhotos = await storage.getTopPhotosByVotes(limit);
      res.json(topPhotos);
    } catch (error) {
      console.error('Error fetching top photos by votes:', error);
      res.status(500).json({ message: "Failed to fetch leaderboard" });
    }
  });

  app.get("/api/leaderboard/wins", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      const topPhotos = await storage.getTopPhotosByWins(limit);
      res.json(topPhotos);
    } catch (error) {
      console.error('Error fetching top photos by wins:', error);
      res.status(500).json({ message: "Failed to fetch leaderboard" });
    }
  });

  // Admin: Get all users (requires admin)
  app.get("/api/admin/users", async (req, res) => {
    try {
      // Check admin authentication using the session system
      const adminStatus = await checkAdminAuth(req);
      if (!adminStatus.authenticated || !adminStatus.isAdmin) {
        return res.status(403).json({ message: "Admin access required" });
      }
      
      // Get all users with their vote counts
      const allUsers = await db.select({
        id: users.id,
        email: users.email,
        username: users.username,
        firstName: users.firstName,
        lastName: users.lastName,
        emailVerified: users.emailVerified,
        isAdmin: users.isAdmin,
        isMasterAdmin: users.isMasterAdmin,
        createdAt: users.createdAt,
        lastLoginAt: users.lastLoginAt,
        totalVotes: sql`(SELECT COUNT(*) FROM ${votes} WHERE ${votes.userId} = ${users.id})`.as('totalVotes')
      })
      .from(users)
      .orderBy(sql`${users.createdAt} DESC`);
      
      res.json(allUsers);
    } catch (error) {
      console.error('Error fetching users:', error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });
  
  // Admin: Update user admin status (requires master admin)
  app.put("/api/admin/users/:userId/admin", async (req, res) => {
    try {
      // Check admin authentication using the session system
      const adminStatus = await checkAdminAuth(req);
      if (!adminStatus.authenticated || !adminStatus.isAdmin) {
        return res.status(403).json({ message: "Admin access required" });
      }
      
      // For user promotion/demotion, require master admin
      // Get current user info based on session
      const currentUser = await getCurrentAdminUser(req);
      if (!currentUser || !currentUser.isMasterAdmin) {
        return res.status(403).json({ message: "Only master admin can promote/demote other admins" });
      }
      
      const { userId } = req.params;
      const { isAdmin } = req.body;
      
      // Prevent modifying master admin status
      const [targetUser] = await db.select().from(users).where(eq(users.id, userId));
      if (targetUser?.isMasterAdmin) {
        return res.status(403).json({ message: "Cannot modify master admin status" });
      }
      
      // Update user admin status
      const [updatedUser] = await db
        .update(users)
        .set({
          isAdmin,
          updatedAt: new Date()
        })
        .where(eq(users.id, userId))
        .returning();
      
      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }
      
      res.json(updatedUser);
    } catch (error) {
      console.error('Error updating admin status:', error);
      res.status(500).json({ message: "Failed to update admin status" });
    }
  });
  
  // Admin: Delete user (requires admin, cannot delete admins)
  app.delete("/api/admin/users/:userId", async (req, res) => {
    try {
      // Check admin authentication using the session system
      const adminStatus = await checkAdminAuth(req);
      if (!adminStatus.authenticated || !adminStatus.isAdmin) {
        return res.status(403).json({ message: "Admin access required" });
      }
      
      const { userId } = req.params;
      
      // Check if target user is admin or master admin
      const [targetUser] = await db.select().from(users).where(eq(users.id, userId));
      if (!targetUser) {
        return res.status(404).json({ message: "User not found" });
      }
      
      if (targetUser.isAdmin || targetUser.isMasterAdmin) {
        return res.status(403).json({ message: "Cannot delete admin users" });
      }
      
      // Delete user and related data
      await db.delete(userStats).where(eq(userStats.userId, userId));
      await db.delete(votes).where(eq(votes.userId, userId));
      await db.delete(users).where(eq(users.id, userId));
      
      res.json({ message: "User deleted successfully" });
    } catch (error) {
      console.error('Error deleting user:', error);
      res.status(500).json({ message: "Failed to delete user" });
    }
  });
  
  // Announcements endpoint (public)
  app.get("/api/announcements", async (req, res) => {
    try {
      const [settings] = await db.select().from(settingsTable);
      
      if (!settings) {
        return res.json({
          announcementEnabled: false,
          announcementText: "",
          announcementType: "info",
          monthlyContestActive: false,
          quarterlyContestActive: false,
        });
      }
      
      const now = new Date();
      const monthlyActive = settings.monthlyContestEnabled && 
        settings.monthlyContestStartDate && 
        settings.monthlyContestEndDate &&
        now >= new Date(settings.monthlyContestStartDate) &&
        now <= new Date(settings.monthlyContestEndDate);
        
      const quarterlyActive = settings.quarterlyContestEnabled && 
        settings.quarterlyContestStartDate && 
        settings.quarterlyContestEndDate &&
        now >= new Date(settings.quarterlyContestStartDate) &&
        now <= new Date(settings.quarterlyContestEndDate);
      
      res.json({
        announcementEnabled: settings.announcementEnabled,
        announcementText: settings.announcementText,
        announcementType: settings.announcementType || "info",
        monthlyContestActive: monthlyActive,
        quarterlyContestActive: quarterlyActive,
        monthlyContestText: settings.monthlyContestText || "",
        quarterlyContestText: settings.quarterlyContestText || "",
        monthlyContestStartDate: settings.monthlyContestStartDate,
        monthlyContestEndDate: settings.monthlyContestEndDate,
        quarterlyContestStartDate: settings.quarterlyContestStartDate,
        quarterlyContestEndDate: settings.quarterlyContestEndDate,
      });
    } catch (error) {
      console.error('Error fetching announcements:', error);
      res.status(500).json({ message: "Failed to fetch announcements" });
    }
  });
  
  // News items endpoint (public)
  app.get("/api/news", async (req, res) => {
    try {
      // Get current settings to determine news source
      const [currentSettings] = await db.select().from(settingsTable).where(eq(settingsTable.id, "main"));
      
      if (!currentSettings) {
        return res.json([]);
      }

      // Check if RSS is enabled and configured
      if (currentSettings.newsSource === 'rss' && currentSettings.rssEnabled && currentSettings.rssUrl) {
        try {
          const rssItems = await rssService.fetchRSSFeed({
            url: currentSettings.rssUrl,
            tag: currentSettings.rssTag || undefined,
            daysLimit: currentSettings.rssDaysLimit || 90,
            maxItems: currentSettings.rssMaxItems || 3
          });
          
          return res.json(rssItems);
        } catch (rssError) {
          console.error('RSS fetch failed, falling back to internal news:', rssError);
          // Fall through to internal news on RSS failure
        }
      }

      // Default to internal news system
      const now = new Date();
      const newsItems = await db
        .select()
        .from(newsItemsTable)
        .where(
          and(
            eq(newsItemsTable.isActive, true),
            lte(newsItemsTable.publishDate, sql`${now}`),
            or(
              isNull(newsItemsTable.expiryDate),
              gte(newsItemsTable.expiryDate, sql`${now}`)
            )
          )
        )
        .orderBy(desc(newsItemsTable.priority), desc(newsItemsTable.publishDate))
        .limit(5);
      
      res.json(newsItems);
    } catch (error) {
      console.error('Error fetching news:', error);
      res.status(500).json({ message: "Failed to fetch news" });
    }
  });
  
  // Admin: Get all news items
  app.get("/api/admin/news", async (req, res) => {
    try {
      // Check admin authentication using the session system
      const adminStatus = await checkAdminAuth(req);
      if (!adminStatus.authenticated || !adminStatus.isAdmin) {
        return res.status(403).json({ message: "Admin access required" });
      }
      
      const newsItems = await db
        .select()
        .from(newsItemsTable)
        .orderBy(desc(newsItemsTable.createdAt));
      
      res.json(newsItems);
    } catch (error) {
      console.error('Error fetching admin news:', error);
      res.status(500).json({ message: "Failed to fetch news items" });
    }
  });
  
  // Admin: Create news item
  app.post("/api/admin/news", async (req, res) => {
    try {
      // Check admin authentication using the session system
      const adminStatus = await checkAdminAuth(req);
      if (!adminStatus.authenticated || !adminStatus.isAdmin) {
        return res.status(403).json({ message: "Admin access required" });
      }
      
      const { title, description, link, publishDate, expiryDate, priority, isActive } = req.body;
      
      const [newsItem] = await db
        .insert(newsItemsTable)
        .values({
          title,
          description,
          link,
          publishDate: new Date(publishDate),
          expiryDate: expiryDate ? new Date(expiryDate) : null,
          priority: priority || 0,
          isActive: isActive !== false,
        })
        .returning();
      
      res.json(newsItem);
    } catch (error) {
      console.error('Error creating news item:', error);
      res.status(500).json({ message: "Failed to create news item" });
    }
  });
  
  // Admin: Update news item
  app.put("/api/admin/news/:id", async (req, res) => {
    try {
      // Check admin authentication using the session system
      const adminStatus = await checkAdminAuth(req);
      if (!adminStatus.authenticated || !adminStatus.isAdmin) {
        return res.status(403).json({ message: "Admin access required" });
      }
      
      const { id } = req.params;
      const { title, description, link, publishDate, expiryDate, priority, isActive } = req.body;
      
      const [updatedItem] = await db
        .update(newsItemsTable)
        .set({
          title,
          description,
          link,
          publishDate: new Date(publishDate),
          expiryDate: expiryDate ? new Date(expiryDate) : null,
          priority: priority || 0,
          isActive: isActive !== false,
        })
        .where(eq(newsItemsTable.id, id))
        .returning();
      
      if (!updatedItem) {
        return res.status(404).json({ message: "News item not found" });
      }
      
      res.json(updatedItem);
    } catch (error) {
      console.error('Error updating news item:', error);
      res.status(500).json({ message: "Failed to update news item" });
    }
  });
  
  // Admin: Delete news item
  app.delete("/api/admin/news/:id", async (req, res) => {
    try {
      // Check admin authentication using the session system
      const adminStatus = await checkAdminAuth(req);
      if (!adminStatus.authenticated || !adminStatus.isAdmin) {
        return res.status(403).json({ message: "Admin access required" });
      }
      
      const { id } = req.params;
      
      await db.delete(newsItemsTable).where(eq(newsItemsTable.id, id));
      
      res.json({ message: "News item deleted successfully" });
    } catch (error) {
      console.error('Error deleting news item:', error);
      res.status(500).json({ message: "Failed to delete news item" });
    }
  });
  
  // Contest status endpoint (public)
  app.get("/api/contest-status", async (req, res) => {
    try {
      const [settings] = await db.select().from(settingsTable);
      
      if (!settings) {
        return res.json({
          monthlyContestEnabled: false,
          monthlyContestActive: false,
          monthlyContestText: "",
          quarterlyContestEnabled: false,
          quarterlyContestActive: false,
          quarterlyContestText: "",
        });
      }
      
      const now = new Date();
      const monthlyActive = settings.monthlyContestEnabled && 
        settings.monthlyContestStartDate && 
        settings.monthlyContestEndDate &&
        now >= new Date(settings.monthlyContestStartDate) &&
        now <= new Date(settings.monthlyContestEndDate);
        
      const quarterlyActive = settings.quarterlyContestEnabled && 
        settings.quarterlyContestStartDate && 
        settings.quarterlyContestEndDate &&
        now >= new Date(settings.quarterlyContestStartDate) &&
        now <= new Date(settings.quarterlyContestEndDate);
      
      res.json({
        monthlyContestEnabled: settings.monthlyContestEnabled,
        monthlyContestActive: monthlyActive,
        monthlyContestText: settings.monthlyContestText || "",
        quarterlyContestEnabled: settings.quarterlyContestEnabled,
        quarterlyContestActive: quarterlyActive,
        quarterlyContestText: settings.quarterlyContestText || "",
      });
    } catch (error) {
      console.error('Error fetching contest status:', error);
      res.status(500).json({ message: "Failed to fetch contest status" });
    }
  });
  
  // User statistics endpoint
  app.get("/api/user/stats", async (req, res) => {
    try {
      let userId: string;
      
      // Check for admin session first
      const sessionId = req.headers['x-session-id'] as string;
      if (sessionId === 'admin-session') {
        // This is an admin session - use the master admin user
        userId = '4d2c0db4-a62b-4849-a352-72f7164c5e78'; // Chris McNulty's user ID
      } else {
        // Check for regular JWT token
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          return res.status(401).json({ message: "Authentication required" });
        }
        
        const token = authHeader.substring(7);
        const payload = verifyToken(token);
        
        if (!payload) {
          return res.status(401).json({ message: "Invalid token" });
        }
        
        userId = payload.userId;
      }
      
      // Get user statistics from database
      const [userStatsData] = await db.select().from(userStats).where(eq(userStats.userId, userId));
      
      // Get photos the user has voted on
      const userVotes = await db.select({
        photoId: votes.winnerPhotoId,
        count: sql`COUNT(*)`.as('count')
      })
      .from(votes)
      .where(eq(votes.userId, userId))
      .groupBy(votes.winnerPhotoId)
      .orderBy(sql`COUNT(*) DESC`)
      .limit(10);
      
      // Get voted photos details
      const votedPhotos = [];
      for (const vote of userVotes) {
        const [photo] = await db.select().from(photos).where(eq(photos.id, vote.photoId));
        if (photo) {
          votedPhotos.push({
            ...photo,
            userVoteCount: Number(vote.count)
          });
        }
      }
      
      // Calculate monthly and quarterly ranks
      const allUserStats = await db.select().from(userStats).orderBy(sql`${userStats.monthlyVotes} DESC`);
      const monthlyRank = allUserStats.findIndex(s => s.userId === userId) + 1;
      const quarterlyRank = allUserStats.sort((a, b) => b.quarterlyVotes - a.quarterlyVotes).findIndex(s => s.userId === userId) + 1;
      
      res.json({
        totalVotes: userStatsData?.totalVotes || 0,
        monthlyVotes: userStatsData?.monthlyVotes || 0,
        quarterlyVotes: userStatsData?.quarterlyVotes || 0,
        favoritePhotos: userStatsData?.favoritePhotos || [],
        purchasedPhotos: userStatsData?.purchasedPhotos || [],
        currentStreak: userStatsData?.currentStreak || 0,
        longestStreak: userStatsData?.longestStreak || 0,
        lastVoteAt: userStatsData?.lastVoteAt,
        votedPhotos,
        monthlyRank,
        quarterlyRank,
        totalUsers: allUserStats.length
      });
    } catch (error) {
      console.error('Error fetching user stats:', error);
      res.status(500).json({ message: "Failed to fetch user statistics" });
    }
  });
  
  // User-specific leaderboard endpoints (requires authentication)
  app.get("/api/leaderboard/user/votes", async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: "Authentication required" });
      }
      
      const token = authHeader.substring(7);
      const payload = verifyToken(token);
      
      if (!payload) {
        return res.status(401).json({ message: "Invalid token" });
      }
      
      const limit = parseInt(req.query.limit as string) || 10;
      // Get photos that the user has voted on
      const userVotedPhotos = await storage.getUserVotedPhotos(payload.userId, limit, 'votes');
      res.json(userVotedPhotos);
    } catch (error) {
      console.error('Error fetching user voted photos by votes:', error);
      res.status(500).json({ message: "Failed to fetch user leaderboard" });
    }
  });

  app.get("/api/leaderboard/user/wins", async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: "Authentication required" });
      }
      
      const token = authHeader.substring(7);
      const payload = verifyToken(token);
      
      if (!payload) {
        return res.status(401).json({ message: "Invalid token" });
      }
      
      const limit = parseInt(req.query.limit as string) || 10;
      // Get photos that the user has voted on
      const userVotedPhotos = await storage.getUserVotedPhotos(payload.userId, limit, 'wins');
      res.json(userVotedPhotos);
    } catch (error) {
      console.error('Error fetching user voted photos by wins:', error);
      res.status(500).json({ message: "Failed to fetch user leaderboard" });
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

  // Pairs API endpoints
  app.get("/api/pairs", isAuthenticated, async (req, res) => {
    try {
      const pairs = await storage.getAllPhotoPairs();
      res.json(pairs);
    } catch (error) {
      console.error("Error fetching pairs:", error);
      res.status(500).json({ message: "Failed to fetch pairs" });
    }
  });

  app.post("/api/pairs", isAuthenticated, async (req, res) => {
    try {
      const { photo1Id, photo2Id, description, createdBy } = req.body;
      
      if (!photo1Id || !photo2Id) {
        return res.status(400).json({ message: "Both photo1Id and photo2Id are required" });
      }

      if (photo1Id === photo2Id) {
        return res.status(400).json({ message: "Cannot pair a photo with itself" });
      }

      // Check if pair already exists (bidirectional)
      const existingPairs = await storage.getPhotoPartnerships(photo1Id);
      const existingPair = existingPairs.find(pair => 
        pair.photo2Id === photo2Id || pair.photo1Id === photo2Id
      );

      if (existingPair) {
        return res.status(400).json({ message: "Photos are already paired" });
      }

      const newPair = await storage.createPhotoPair({
        photo1Id,
        photo2Id,
        description,
        createdBy
      });

      res.json(newPair);
    } catch (error) {
      console.error("Error creating pair:", error);
      res.status(500).json({ message: "Failed to create pair" });
    }
  });

  app.delete("/api/pairs/:pairId", isAuthenticated, async (req, res) => {
    try {
      const { pairId } = req.params;
      const success = await storage.deletePhotoPair(pairId);
      
      if (!success) {
        return res.status(404).json({ message: "Pair not found" });
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting pair:", error);
      res.status(500).json({ message: "Failed to delete pair" });
    }
  });

  app.get("/api/pairs/:pairId/stats", async (req, res) => {
    try {
      const { pairId } = req.params;
      const stats = await storage.getPairVoteStats(pairId);
      res.json(stats);
    } catch (error) {
      console.error("Error fetching pair stats:", error);
      res.status(500).json({ message: "Failed to fetch pair stats" });
    }
  });

  app.get("/api/photos/:photoId/pair-performance", async (req, res) => {
    try {
      const { photoId } = req.params;
      const performance = await storage.getPhotoPerformanceInPairs(photoId);
      res.json(performance);
    } catch (error) {
      console.error("Error fetching photo pair performance:", error);
      res.status(500).json({ message: "Failed to fetch photo pair performance" });
    }
  });

  app.get("/api/photos/:photoId/partnerships", async (req, res) => {
    try {
      const { photoId } = req.params;
      const partnerships = await storage.getPhotoPartnerships(photoId);
      res.json(partnerships);
    } catch (error) {
      console.error("Error fetching photo partnerships:", error);
      res.status(500).json({ message: "Failed to fetch photo partnerships" });
    }
  });

  app.post("/api/photos/:photoId/archive", isAuthenticated, async (req, res) => {
    try {
      const { photoId } = req.params;
      
      // Check if photo has pairs - warn user
      const partnerships = await storage.getPhotoPartnerships(photoId);
      if (partnerships.length > 0) {
        return res.status(400).json({ 
          message: "Photo is part of pairs", 
          partnerships: partnerships.length,
          warning: "Archiving this photo will affect pair voting data"
        });
      }

      const success = await storage.archivePhoto(photoId);
      if (!success) {
        return res.status(404).json({ message: "Photo not found" });
      }
      
      res.json({ success: true, archived: true });
    } catch (error) {
      console.error("Error archiving photo:", error);
      res.status(500).json({ message: "Failed to archive photo" });
    }
  });

  app.post("/api/pairs/:pairId/vote", async (req, res) => {
    try {
      const { pairId } = req.params;
      const { winnerPhotoId, voterType = "user", userId } = req.body;

      if (!winnerPhotoId) {
        return res.status(400).json({ message: "Winner photo ID is required" });
      }

      const pair = await storage.getPhotoPair(pairId);
      if (!pair) {
        return res.status(404).json({ message: "Pair not found" });
      }

      const loserPhotoId = pair.photo1Id === winnerPhotoId ? pair.photo2Id : pair.photo1Id;

      const pairVote = await storage.createPairVote({
        pairId,
        winnerPhotoId,
        loserPhotoId,
        voterType,
        userId
      });

      res.json(pairVote);
    } catch (error) {
      console.error("Error creating pair vote:", error);
      res.status(500).json({ message: "Failed to create pair vote" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
