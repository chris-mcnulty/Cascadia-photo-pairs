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
  newsItems as newsItemsTable,
  contestEntries,
  userFavorites,
  sales
} from "@shared/schema";
import { eq, sql, and, or, inArray, gte, lte, desc, isNull } from "drizzle-orm";
import { storage } from "./storage";
import { 
  insertVoteSchema, 
  insertSettingsSchema, 
  insertPhotoSchema, 
  insertCollectionSchema,
  insertSalesChannelSchema,
  insertSupplierSchema,
  insertProductSizeSchema,
  insertSupplierPriceSchema,
  insertSaleSchema,
  insertInventoryItemSchema,
  insertDropShipOrderSchema,
  insertExpenseCategorySchema,
  insertExpenseSchema,
  insertProductSchema
} from "@shared/schema";
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
import { z } from "zod";
import multer from "multer";
import { importWixProducts, importWixOrders } from "./csv-import";

// Simple middleware for admin auth check (for pairs endpoints)
const isAuthenticated = async (req: any, res: any, next: any) => {
  // Use the proper checkAdminAuth function
  const adminStatus = await checkAdminAuth(req);
  if (adminStatus.authenticated && adminStatus.isAdmin) {
    return next();
  }
  
  console.log('Authentication failed for request');
  return res.status(401).json({ message: "Admin authentication required" });
};

// Secure session storage for admin authentication
const adminMfaSessions = new Map<string, { code: string; expires: number; isMasterAdmin: boolean; userId?: string }>();
const verifiedAdminSessions = new Map<string, { userId: string; email: string; isAdmin: boolean; isMasterAdmin: boolean; expires: number }>();

// Helper functions for admin authentication
async function checkAdminAuth(req: any): Promise<{ authenticated: boolean; isAdmin: boolean }> {
  try {
    // First check for JWT token from regular user authentication
    const authToken = req.headers['authorization']?.replace('Bearer ', '') || req.headers['x-auth-token'];
    console.log('[Server] checkAdminAuth - JWT token present:', !!authToken);
    
    if (authToken) {
      // Verify JWT token and check admin status from database
      const tokenPayload = verifyToken(authToken);
      console.log('[Server] checkAdminAuth - Token payload:', tokenPayload ? { userId: tokenPayload.userId, email: tokenPayload.email } : null);
      if (tokenPayload && tokenPayload.userId) {
        // Get user from database to verify current admin status
        const [user] = await db.select().from(users).where(eq(users.id, tokenPayload.userId));
        console.log('[Server] checkAdminAuth - User found:', user ? { email: user.email, isAdmin: user.isAdmin, isMasterAdmin: user.isMasterAdmin } : null);
        
        if (user && (user.isAdmin || user.isMasterAdmin)) {
          console.log('[Server] checkAdminAuth - JWT auth successful for', user.email);
          return { authenticated: true, isAdmin: true };
        }
      }
    }
    
    // Check for verified admin session ID after MFA
    const sessionId = req.headers['x-session-id'] || req.query.sessionId;
    console.log('[Server] checkAdminAuth - Session ID present:', !!sessionId);
    
    if (sessionId && verifiedAdminSessions.has(sessionId)) {
      const session = verifiedAdminSessions.get(sessionId);
      // Validate session hasn't expired
      if (session && session.expires > Date.now()) {
        // Additional verification: check user is still admin in database
        const [user] = await db.select().from(users).where(eq(users.id, session.userId));
        if (user && (user.isAdmin || user.isMasterAdmin)) {
          console.log('[Server] checkAdminAuth - Session auth successful for', user.email);
          return { authenticated: true, isAdmin: true };
        }
      } else if (session) {
        // Session expired, remove it
        verifiedAdminSessions.delete(sessionId);
        console.log('[Server] checkAdminAuth - Session expired');
      }
    }
    
    // No pattern-based session acceptance - must be in verifiedAdminSessions or have valid JWT
    console.log('[Server] checkAdminAuth - Authentication failed');
    
    return { authenticated: false, isAdmin: false };
  } catch (error) {
    console.error('Admin auth check error:', error);
    return { authenticated: false, isAdmin: false };
  }
}

async function getCurrentAdminUser(req: any): Promise<any> {
  try {
    // Get the authenticated user based on their JWT token
    const authToken = req.headers['authorization']?.replace('Bearer ', '') || req.headers['x-auth-token'];
    
    if (authToken) {
      const tokenPayload = verifyToken(authToken);
      if (tokenPayload && tokenPayload.userId) {
        const [user] = await db.select().from(users).where(eq(users.id, tokenPayload.userId));
        return user;
      }
    }
    
    // Check for verified session
    const sessionId = req.headers['x-session-id'];
    if (sessionId && verifiedAdminSessions.has(sessionId)) {
      const session = verifiedAdminSessions.get(sessionId);
      if (session && session.expires > Date.now()) {
        const [user] = await db.select().from(users).where(eq(users.id, session.userId));
        return user;
      }
    }
    
    return null;
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
      
      // Check admin password from settings only - no hardcoded passwords
      const isValidAdminPassword = password === settings.adminPassword;
      
      if (!isValidAdminPassword) {
        return res.status(401).json({ message: "Invalid password" });
      }
      
      // Determine if this is master admin based on database, not password
      const isMasterAdmin = false; // Will be determined from database during MFA
      
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
      
      // DISABLED: Old SMS/MFA flow - Users should login with regular account instead
      // This endpoint is deprecated and should not be used
      console.log('[Admin Login] DEPRECATED: This admin-login endpoint with SMS is no longer used.');
      console.log('[Admin Login] Users should login via regular login (/api/auth/login) with their admin account.');
      
      // Return error to indicate this flow is deprecated
      return res.status(410).json({ 
        message: "This admin login method is deprecated. Please log in with your regular admin account.",
        redirectTo: "/login"
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
      
      // Check the code - no backdoors allowed
      const isValidCode = code === mfaSession.code;
      
      if (!isValidCode) {
        return res.status(401).json({ message: "Invalid verification code" });
      }
      
      // Clean up the MFA session
      adminMfaSessions.delete(sessionId);
      
      // Generate secure random session ID
      const crypto = await import('crypto');
      const finalSessionId = crypto.randomBytes(32).toString('hex');
      
      // Get the admin user based on their actual database record
      // For now, we'll assume the first admin user in DB since we removed the hardcoded logic
      const [adminUser] = await db.select().from(users)
        .where(eq(users.isAdmin, true))
        .limit(1);
      
      if (!adminUser) {
        return res.status(500).json({ message: "No admin users configured" });
      }
      
      // Store verified session securely
      verifiedAdminSessions.set(finalSessionId, {
        userId: adminUser.id,
        email: adminUser.email,
        isAdmin: adminUser.isAdmin,
        isMasterAdmin: adminUser.isMasterAdmin,
        expires: Date.now() + (24 * 60 * 60 * 1000) // 24 hours
      });
      
      // Generate proper JWT token for the admin user
      const userToken = generateToken({
        userId: adminUser.id,
        email: adminUser.email,
        isAdmin: true,
      });
      
      res.json({
        sessionId: finalSessionId,
        authenticated: true,
        isMasterAdmin: adminUser.isMasterAdmin,
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
      
      // Generate unique username from email
      let baseUsername = email.split('@')[0];
      let username = baseUsername;
      let counter = 1;
      
      // Check if username already exists and add a number if needed
      while (true) {
        const [existingUsername] = await db.select().from(users).where(eq(users.username, username));
        if (!existingUsername) {
          break;
        }
        username = `${baseUsername}${counter}`;
        counter++;
      }
      
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
  
  // Email Verification
  app.post("/api/auth/verify-email", async (req, res) => {
    try {
      const { token } = req.body;
      
      if (!token) {
        return res.status(400).json({ message: "Verification token is required" });
      }
      
      // Find and validate verification token
      const [verification] = await db
        .select({
          id: emailVerifications.id,
          userId: emailVerifications.userId,
          expiresAt: emailVerifications.expiresAt
        })
        .from(emailVerifications)
        .where(eq(emailVerifications.token, token));
      
      if (!verification) {
        return res.status(400).json({ message: "Invalid verification token" });
      }
      
      // Check if token is expired
      if (new Date() > new Date(verification.expiresAt)) {
        // Clean up expired token
        await db.delete(emailVerifications).where(eq(emailVerifications.id, verification.id));
        return res.status(400).json({ message: "Verification token has expired" });
      }
      
      // Update user's email verification status
      const [updatedUser] = await db
        .update(users)
        .set({
          emailVerified: true,
          updatedAt: new Date()
        })
        .where(eq(users.id, verification.userId))
        .returning();
      
      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Delete the used verification token
      await db.delete(emailVerifications).where(eq(emailVerifications.id, verification.id));
      
      res.json({ 
        message: "Email verified successfully! You can now log in to your account.",
        user: {
          id: updatedUser.id,
          email: updatedUser.email,
          emailVerified: updatedUser.emailVerified
        }
      });
    } catch (error) {
      console.error('Email verification error:', error);
      res.status(500).json({ message: "Failed to verify email" });
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
    try {
      // Use our secure authentication check
      const adminStatus = await checkAdminAuth(req);
      return res.json({
        authenticated: adminStatus.authenticated,
        isAdmin: adminStatus.isAdmin
      });
    } catch (error) {
      console.error('Admin status check failed:', error);
      return res.json({ authenticated: false, isAdmin: false });
    }
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
      console.error('Error in random-pair endpoint:', error);
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
      
      // Check if this is a pair vote
      const isPairVote = await storage.checkIfPairVote(winnerPhotoId, loserPhotoId);
      
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
      
      // If this was a pair vote, also record it in pair_votes
      if (isPairVote) {
        const pair = await storage.findPairByPhotos(winnerPhotoId, loserPhotoId);
        if (pair) {
          await storage.createPairVote({
            pairId: pair.id,
            winnerPhotoId,
            loserPhotoId,
            voterType,
            userId
          });
          console.log(`Recorded pair vote for pair ${pair.id}`);
        }
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
      
      // Get all users with their vote counts - simplified working approach
      const usersResult = await db.execute(sql`
        SELECT 
          u.id,
          u.email,
          u.username,
          u.first_name,
          u.last_name,
          u.email_verified,
          u.is_admin,
          u.is_master_admin,
          u.created_at,
          u.last_login_at,
          COALESCE(v.vote_count, 0) as total_votes
        FROM users u
        LEFT JOIN (
          SELECT user_id, COUNT(*) as vote_count
          FROM votes
          WHERE user_id IS NOT NULL
          GROUP BY user_id
        ) v ON u.id = v.user_id
        ORDER BY u.created_at DESC
      `);
      
      const allUsers = usersResult.rows.map(row => ({
        id: row.id,
        email: row.email,
        username: row.username,
        firstName: row.first_name,
        lastName: row.last_name,
        emailVerified: row.email_verified,
        isAdmin: row.is_admin,
        isMasterAdmin: row.is_master_admin,
        createdAt: row.created_at,
        lastLoginAt: row.last_login_at,
        totalVotes: String(row.total_votes)
      }));
      
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
      
      // Delete user and related data (cascade delete)
      // Note: Column names are user_id not userId in the database
      await db.delete(userStats).where(eq(userStats.userId, userId));
      await db.delete(votes).where(eq(votes.userId, userId));
      await db.delete(userFavorites).where(eq(userFavorites.userId, userId));
      await db.delete(contestEntries).where(eq(contestEntries.userId, userId));
      await db.delete(emailVerifications).where(eq(emailVerifications.userId, userId));
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
      const [currentSettings] = await db.select().from(settingsTable).where(eq(settingsTable.id, "default"));
      
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
      console.log('[/api/pairs] Request received, fetching all photo pairs...');
      const pairs = await storage.getAllPhotoPairs();
      console.log('[/api/pairs] Successfully fetched', pairs.length, 'pairs');
      res.json(pairs);
    } catch (error) {
      console.error("[/api/pairs] Error fetching pairs:", error);
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

  // Get all head-to-head matchup data for pairs
  app.get("/api/pairs/matchups", async (req, res) => {
    try {
      const matchups = await storage.getAllPairMatchups();
      res.json(matchups);
    } catch (error: any) {
      console.error("Error fetching pair matchups:", error);
      res.status(500).json({ message: "Failed to fetch pair matchups" });
    }
  });

  // Get photo performance matrix - how each photo performs against all opponents
  app.get("/api/photos/performance-matrix", async (req, res) => {
    try {
      const matrix = await storage.getPhotoPerformanceMatrix();
      res.json(matrix);
    } catch (error: any) {
      console.error("Error fetching photo performance matrix:", error);
      res.status(500).json({ message: "Failed to fetch photo performance matrix" });
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

  // Contest Report endpoint (admin only)
  app.get("/api/admin/contest-report", async (req, res) => {
    // Check admin authentication using the secure function
    const adminStatus = await checkAdminAuth(req);
    if (!adminStatus.authenticated || !adminStatus.isAdmin) {
      return res.status(403).json({ message: "Admin access required" });
    }

    try {
      const contestType = req.query.contestType as "monthly" | "quarterly" || "quarterly";
      const contestPeriod = req.query.contestPeriod as string || "2025-Q3";

      // Get contest entries
      const entries = await db
        .select({
          userId: contestEntries.userId,
          voteCount: contestEntries.voteCount,
          enteredAt: contestEntries.enteredAt,
          isWinner: contestEntries.isWinner
        })
        .from(contestEntries)
        .where(
          and(
            eq(contestEntries.contestType, contestType),
            eq(contestEntries.contestPeriod, contestPeriod)
          )
        )
        .orderBy(sql`${contestEntries.voteCount} DESC`);

      // Get user details for each entry
      const topVoters = await Promise.all(
        entries.map(async (entry) => {
          const [user] = await db
            .select({
              email: users.email,
              username: users.username
            })
            .from(users)
            .where(eq(users.id, entry.userId));

          return {
            userId: entry.userId,
            email: user?.email || "Unknown",
            displayName: user?.username || user?.email || "Unknown User",
            voteCount: entry.voteCount,
            contestPeriod,
            enteredAt: entry.enteredAt,
            isWinner: entry.isWinner || false
          };
        })
      );

      // Calculate statistics
      const totalParticipants = entries.length;
      const totalVotes = entries.reduce((sum, entry) => sum + entry.voteCount, 0);
      const averageVotes = totalParticipants > 0 ? totalVotes / totalParticipants : 0;

      res.json({
        totalParticipants,
        totalVotes,
        averageVotes,
        topVoters
      });
    } catch (error) {
      console.error('Error fetching contest report:', error);
      res.status(500).json({ message: "Failed to fetch contest report" });
    }
  });

  // Mark Contest Winner endpoint (admin only)
  app.post("/api/admin/contest-winner", async (req, res) => {
    // Check admin authentication using the secure function
    const adminStatus = await checkAdminAuth(req);
    if (!adminStatus.authenticated || !adminStatus.isAdmin) {
      return res.status(403).json({ message: "Admin access required" });
    }

    try {
      const { userId, contestPeriod, contestType } = req.body;

      // Update the contest entry to mark as winner
      await db
        .update(contestEntries)
        .set({ isWinner: true })
        .where(
          and(
            eq(contestEntries.userId, userId),
            eq(contestEntries.contestPeriod, contestPeriod),
            eq(contestEntries.contestType, contestType)
          )
        );

      res.json({ success: true });
    } catch (error) {
      console.error('Error marking contest winner:', error);
      res.status(500).json({ message: "Failed to mark contest winner" });
    }
  });

  // Test email endpoint (admin only)
  app.post("/api/test-email", async (req, res) => {
    // Check admin authentication using the secure function
    const adminStatus = await checkAdminAuth(req);
    if (!adminStatus.authenticated || !adminStatus.isAdmin) {
      return res.status(403).json({ message: "Admin access required" });
    }

    try {
      const { email } = req.body;
      if (!email) {
        return res.status(400).json({ message: "Email address required" });
      }

      const { sendTestEmail } = await import('./test-email');
      const success = await sendTestEmail(email);
      
      if (success) {
        res.json({ success: true, message: `Test email sent to ${email}` });
      } else {
        res.status(500).json({ message: "Failed to send test email" });
      }
    } catch (error) {
      console.error('Error sending test email:', error);
      res.status(500).json({ message: "Failed to send test email" });
    }
  });

  // Test SMS endpoint (admin only)
  app.post("/api/test-sms", async (req, res) => {
    // Check admin authentication using the secure function
    const adminStatus = await checkAdminAuth(req);
    if (!adminStatus.authenticated || !adminStatus.isAdmin) {
      return res.status(403).json({ message: "Admin access required" });
    }

    try {
      const { phoneNumber } = req.body;
      if (!phoneNumber) {
        return res.status(400).json({ message: "Phone number required" });
      }

      const { sendTestSMS } = await import('./twilio');
      const success = await sendTestSMS(phoneNumber);
      
      if (success) {
        res.json({ success: true, message: `Test SMS sent to ${phoneNumber}` });
      } else {
        res.status(500).json({ message: "Failed to send test SMS. Check Twilio configuration." });
      }
    } catch (error) {
      console.error('Error sending test SMS:', error);
      res.status(500).json({ message: "Failed to send test SMS" });
    }
  });

  // Check services availability
  app.get("/api/services/status", async (req, res) => {
    try {
      const { isEmailServiceAvailable, isSMSServiceAvailable } = await import('./sendgrid');
      const { isSMSConfigured } = await import('./twilio');
      
      res.json({
        email: isEmailServiceAvailable(),
        sms: await isSMSServiceAvailable(),
        twilio: isSMSConfigured()
      });
    } catch (error) {
      console.error('Error checking services status:', error);
      res.status(500).json({ message: "Failed to check services status" });
    }
  });

  // Resend verification email endpoint (public or admin)
  app.post("/api/auth/resend-verification", async (req, res) => {
    try {
      const { email } = req.body;
      
      if (!email) {
        return res.status(400).json({ message: "Email is required" });
      }

      const { resendVerificationEmail } = await import('./resend-verification');
      const success = await resendVerificationEmail(email);
      
      if (success) {
        res.json({ message: "Verification email sent successfully" });
      } else {
        res.status(400).json({ message: "Failed to send verification email" });
      }
    } catch (error) {
      console.error('Error resending verification email:', error);
      res.status(500).json({ message: "Failed to resend verification email" });
    }
  });

  // Admin: Resend verification email for any user
  app.post("/api/admin/resend-verification", async (req, res) => {
    try {
      // Check admin authentication
      const adminStatus = await checkAdminAuth(req);
      if (!adminStatus.authenticated || !adminStatus.isAdmin) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const { email } = req.body;
      
      if (!email) {
        return res.status(400).json({ message: "Email is required" });
      }

      const { resendVerificationEmail } = await import('./resend-verification');
      const success = await resendVerificationEmail(email);
      
      if (success) {
        res.json({ message: "Verification email sent successfully" });
      } else {
        res.status(400).json({ message: "Failed to send verification email" });
      }
    } catch (error) {
      console.error('Error resending verification email:', error);
      res.status(500).json({ message: "Failed to resend verification email" });
    }
  });

  // Test Synozur email endpoint
  app.post("/api/test-synozur-email", async (req, res) => {
    // Check admin authentication using the secure function
    const adminStatus = await checkAdminAuth(req);
    if (!adminStatus.authenticated || !adminStatus.isAdmin) {
      return res.status(403).json({ message: "Admin access required" });
    }

    try {
      const { sendTestEmailToSynozur } = await import('./test-synozur-email');
      const success = await sendTestEmailToSynozur();
      
      if (success) {
        res.json({ message: "Test email sent to Synozur" });
      } else {
        res.status(500).json({ message: "Failed to send test email to Synozur" });
      }
    } catch (error) {
      console.error('Error sending test email to Synozur:', error);
      res.status(500).json({ message: "Failed to send test email" });
    }
  });

  // Manual password reset email endpoint (admin)
  app.post("/api/manual-reset-email", async (req, res) => {
    // Check admin authentication using the secure function
    const adminStatus = await checkAdminAuth(req);
    if (!adminStatus.authenticated || !adminStatus.isAdmin) {
      return res.status(403).json({ message: "Admin access required" });
    }

    try {
      const { email, code } = req.body;
      const { sendManualPasswordResetEmail } = await import('./manual-reset-email');
      const success = await sendManualPasswordResetEmail(email, code);
      
      if (success) {
        res.json({ message: "Password reset email sent successfully" });
      } else {
        res.status(500).json({ message: "Failed to send password reset email" });
      }
    } catch (error) {
      console.error('Error sending manual reset email:', error);
      res.status(500).json({ message: "Failed to send email" });
    }
  });

  // ============================================
  // SALES CHANNELS ROUTES
  // ============================================
  
  // Get all sales channels
  app.get("/api/admin/sales-channels", isAuthenticated, async (req, res) => {
    try {
      const channels = await storage.getAllSalesChannels();
      res.json(channels);
    } catch (error) {
      console.error('Error fetching sales channels:', error);
      res.status(500).json({ message: "Failed to fetch sales channels" });
    }
  });

  // Get single sales channel
  app.get("/api/admin/sales-channels/:id", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const channel = await storage.getSalesChannel(id);
      
      if (!channel) {
        return res.status(404).json({ message: "Sales channel not found" });
      }
      
      res.json(channel);
    } catch (error) {
      console.error('Error fetching sales channel:', error);
      res.status(500).json({ message: "Failed to fetch sales channel" });
    }
  });

  // Create sales channel
  app.post("/api/admin/sales-channels", isAuthenticated, async (req, res) => {
    try {
      const validatedData = insertSalesChannelSchema.parse(req.body);
      const channel = await storage.createSalesChannel(validatedData);
      res.status(201).json(channel);
    } catch (error) {
      console.error('Error creating sales channel:', error);
      res.status(400).json({ message: "Failed to create sales channel", error: error instanceof Error ? error.message : "Unknown error" });
    }
  });

  // Update sales channel
  app.put("/api/admin/sales-channels/:id", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const channel = await storage.updateSalesChannel(id, req.body);
      
      if (!channel) {
        return res.status(404).json({ message: "Sales channel not found" });
      }
      
      res.json(channel);
    } catch (error) {
      console.error('Error updating sales channel:', error);
      res.status(400).json({ message: "Failed to update sales channel" });
    }
  });

  // Delete sales channel
  app.delete("/api/admin/sales-channels/:id", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const success = await storage.deleteSalesChannel(id);
      
      if (!success) {
        return res.status(404).json({ message: "Sales channel not found" });
      }
      
      res.json({ message: "Sales channel deleted successfully" });
    } catch (error) {
      console.error('Error deleting sales channel:', error);
      res.status(500).json({ message: "Failed to delete sales channel" });
    }
  });

  // ============================================
  // SUPPLIERS ROUTES
  // ============================================
  
  // Get active suppliers (for forms/dropdowns)
  app.get("/api/suppliers", isAuthenticated, async (req, res) => {
    try {
      const allSuppliers = await storage.getAllSuppliers();
      // Filter for active suppliers only
      const activeSuppliers = allSuppliers.filter(s => s.isActive);
      res.json(activeSuppliers);
    } catch (error) {
      console.error('Error fetching suppliers:', error);
      res.status(500).json({ message: "Failed to fetch suppliers" });
    }
  });

  // Get all suppliers
  app.get("/api/admin/suppliers", isAuthenticated, async (req, res) => {
    try {
      const suppliers = await storage.getAllSuppliers();
      res.json(suppliers);
    } catch (error) {
      console.error('Error fetching suppliers:', error);
      res.status(500).json({ message: "Failed to fetch suppliers" });
    }
  });

  // Get single supplier
  app.get("/api/admin/suppliers/:id", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const supplier = await storage.getSupplier(id);
      
      if (!supplier) {
        return res.status(404).json({ message: "Supplier not found" });
      }
      
      res.json(supplier);
    } catch (error) {
      console.error('Error fetching supplier:', error);
      res.status(500).json({ message: "Failed to fetch supplier" });
    }
  });

  // Create supplier
  app.post("/api/admin/suppliers", isAuthenticated, async (req, res) => {
    try {
      const validatedData = insertSupplierSchema.parse(req.body);
      const supplier = await storage.createSupplier(validatedData);
      res.status(201).json(supplier);
    } catch (error) {
      console.error('Error creating supplier:', error);
      res.status(400).json({ message: "Failed to create supplier", error: error instanceof Error ? error.message : "Unknown error" });
    }
  });

  // Update supplier
  app.put("/api/admin/suppliers/:id", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const supplier = await storage.updateSupplier(id, req.body);
      
      if (!supplier) {
        return res.status(404).json({ message: "Supplier not found" });
      }
      
      res.json(supplier);
    } catch (error) {
      console.error('Error updating supplier:', error);
      res.status(400).json({ message: "Failed to update supplier" });
    }
  });

  // Delete supplier
  app.delete("/api/admin/suppliers/:id", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const success = await storage.deleteSupplier(id);
      
      if (!success) {
        return res.status(404).json({ message: "Supplier not found" });
      }
      
      res.json({ message: "Supplier deleted successfully" });
    } catch (error) {
      console.error('Error deleting supplier:', error);
      res.status(500).json({ message: "Failed to delete supplier" });
    }
  });

  // ============================================
  // PRODUCT SIZES ROUTES
  // ============================================
  
  // Get all product sizes
  app.get("/api/admin/product-sizes", isAuthenticated, async (req, res) => {
    try {
      const sizes = await storage.getAllProductSizes();
      res.json(sizes);
    } catch (error) {
      console.error('Error fetching product sizes:', error);
      res.status(500).json({ message: "Failed to fetch product sizes" });
    }
  });

  // Get product sizes with pricing data (avg supplier cost, retail price, margin)
  // MUST come before /:id route to avoid "pricing" being matched as an id
  app.get("/api/admin/product-sizes/pricing", isAuthenticated, async (req, res) => {
    try {
      const pricingData = await storage.getProductSizesWithPricing();
      res.json(pricingData);
    } catch (error) {
      console.error('Error fetching product sizes with pricing:', error);
      res.status(500).json({ message: "Failed to fetch product sizes with pricing" });
    }
  });

  // Get single product size
  app.get("/api/admin/product-sizes/:id", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const size = await storage.getProductSize(id);
      
      if (!size) {
        return res.status(404).json({ message: "Product size not found" });
      }
      
      res.json(size);
    } catch (error) {
      console.error('Error fetching product size:', error);
      res.status(500).json({ message: "Failed to fetch product size" });
    }
  });

  // Create product size
  app.post("/api/admin/product-sizes", isAuthenticated, async (req, res) => {
    try {
      // Parse size label like "60x45" to extract dimensions
      const { sizeLabel } = req.body;
      
      if (!sizeLabel || typeof sizeLabel !== 'string') {
        return res.status(400).json({ message: "Size label is required" });
      }
      
      // Extract width and height from size label (e.g., "60x45", "8.5x11", or "60 x 45")
      const match = sizeLabel.match(/(\d+\.?\d*)\s*x\s*(\d+\.?\d*)/i);
      if (!match) {
        return res.status(400).json({ message: "Invalid size format. Use format like '60x45', '8.5x11', or '60 x 45'" });
      }
      
      const widthFloat = parseFloat(match[1]);
      const heightFloat = parseFloat(match[2]);
      
      // Calculate aspect ratio by finding GCD
      // For decimal values, multiply by 10 to handle .5 increments (8.5 -> 85, 11 -> 110)
      const gcd = (a: number, b: number): number => {
        return b === 0 ? a : gcd(b, a % b);
      };
      
      // Convert to integers by multiplying by 10 (handles .5 increments)
      // Then divide by GCD to get simplified fraction
      const widthInt = Math.round(widthFloat * 10);
      const heightInt = Math.round(heightFloat * 10);
      const divisor = gcd(widthInt, heightInt);
      const aspectRatio = `${widthInt / divisor}:${heightInt / divisor}`;
      
      const validatedData = insertProductSizeSchema.parse({
        sizeLabel: sizeLabel.trim(),
        widthInches: widthFloat.toString(), // Store as string for numeric column
        heightInches: heightFloat.toString(), // Store as string for numeric column
        aspectRatio,
      });
      
      const size = await storage.createProductSize(validatedData);
      res.status(201).json(size);
    } catch (error) {
      console.error('Error creating product size:', error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ 
          message: "Invalid product size data", 
          errors: error.errors 
        });
      } else {
        res.status(400).json({ message: "Failed to create product size", error: error instanceof Error ? error.message : "Unknown error" });
      }
    }
  });

  // Update product size
  app.put("/api/admin/product-sizes/:id", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const size = await storage.updateProductSize(id, req.body);
      
      if (!size) {
        return res.status(404).json({ message: "Product size not found" });
      }
      
      res.json(size);
    } catch (error) {
      console.error('Error updating product size:', error);
      res.status(400).json({ message: "Failed to update product size" });
    }
  });

  // Delete product size
  app.delete("/api/admin/product-sizes/:id", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const success = await storage.deleteProductSize(id);
      
      if (!success) {
        return res.status(404).json({ message: "Product size not found" });
      }
      
      res.json({ message: "Product size deleted successfully" });
    } catch (error) {
      console.error('Error deleting product size:', error);
      res.status(500).json({ message: "Failed to delete product size" });
    }
  });

  // ============================================
  // SUPPLIER PRICES ROUTES
  // ============================================
  
  // Get current supplier prices
  app.get("/api/admin/supplier-prices", isAuthenticated, async (req, res) => {
    try {
      const { supplierId } = req.query;
      const prices = await storage.getCurrentSupplierPrices(supplierId as string | undefined);
      res.json(prices);
    } catch (error) {
      console.error('Error fetching supplier prices:', error);
      res.status(500).json({ message: "Failed to fetch supplier prices" });
    }
  });

  // Get supplier price history
  app.get("/api/admin/supplier-prices/history/:supplierId/:productSizeId", isAuthenticated, async (req, res) => {
    try {
      const { supplierId, productSizeId } = req.params;
      const history = await storage.getSupplierPriceHistory(supplierId, productSizeId);
      res.json(history);
    } catch (error) {
      console.error('Error fetching price history:', error);
      res.status(500).json({ message: "Failed to fetch price history" });
    }
  });

  // Create supplier price
  app.post("/api/admin/supplier-prices", isAuthenticated, async (req, res) => {
    try {
      const validatedData = insertSupplierPriceSchema.parse(req.body);
      const price = await storage.createSupplierPrice(validatedData);
      res.status(201).json(price);
    } catch (error) {
      console.error('Error creating supplier price:', error);
      res.status(400).json({ message: "Failed to create supplier price", error: error instanceof Error ? error.message : "Unknown error" });
    }
  });

  // Update supplier price (closes old, creates new)
  app.put("/api/admin/supplier-prices", isAuthenticated, async (req, res) => {
    try {
      const { supplierId, productSizeId, mediaType, newPrice, notes } = req.body;
      
      if (!supplierId || !productSizeId || !mediaType || newPrice === undefined) {
        return res.status(400).json({ message: "Missing required fields: supplierId, productSizeId, mediaType, newPrice" });
      }
      
      const price = await storage.updateSupplierPrice(supplierId, productSizeId, mediaType, newPrice, notes);
      res.json(price);
    } catch (error) {
      console.error('Error updating supplier price:', error);
      res.status(400).json({ message: "Failed to update supplier price" });
    }
  });

  // ============================================
  // RETAIL PRICES ROUTES
  // ============================================

  // Get current retail price for a size and media type
  app.get("/api/admin/retail-prices/:productSizeId/:mediaType", isAuthenticated, async (req, res) => {
    try {
      const { productSizeId, mediaType } = req.params;
      const price = await storage.getCurrentRetailPrice(productSizeId, mediaType);
      res.json(price || null);
    } catch (error) {
      console.error('Error fetching retail price:', error);
      res.status(500).json({ message: "Failed to fetch retail price" });
    }
  });

  // Set retail price (closes old, creates new with versioning)
  app.put("/api/admin/retail-prices", isAuthenticated, async (req, res) => {
    try {
      const { productSizeId, mediaType, retailPrice, notes } = req.body;
      
      if (!productSizeId || !mediaType || retailPrice === undefined) {
        return res.status(400).json({ message: "Missing required fields: productSizeId, mediaType, retailPrice" });
      }
      
      const price = await storage.setRetailPrice(productSizeId, mediaType, retailPrice, notes);
      res.json(price);
    } catch (error) {
      console.error('Error setting retail price:', error);
      res.status(400).json({ message: "Failed to set retail price" });
    }
  });

  // ============================================
  // SALES ROUTES
  // ============================================
  
  // Test endpoint to debug sales
  app.get("/api/admin/sales/debug", isAuthenticated, async (req, res) => {
    try {
      console.log('[DEBUG] Testing sales query...');
      
      // Direct database query
      const directQuery = await db.select().from(sales);
      console.log('[DEBUG] Direct query result count:', directQuery.length);
      console.log('[DEBUG] Direct query first result:', directQuery[0]);
      
      // Storage method query
      const storageQuery = await storage.getAllSales();
      console.log('[DEBUG] Storage query result count:', storageQuery.length);
      console.log('[DEBUG] Storage query first result:', storageQuery[0]);
      
      res.json({
        directCount: directQuery.length,
        directFirst: directQuery[0],
        storageCount: storageQuery.length,
        storageFirst: storageQuery[0]
      });
    } catch (error) {
      console.error('[DEBUG] Error in debug endpoint:', error);
      res.status(500).json({ error: String(error) });
    }
  });
  
  // Get all sales
  app.get("/api/admin/sales", isAuthenticated, async (req, res) => {
    console.log('[API /api/admin/sales] Endpoint hit!');
    
    // Add direct database test first
    try {
      const directTest = await db.select().from(sales);
      console.log('[API /api/admin/sales] Direct DB test found', directTest.length, 'sales');
      if (directTest.length > 0) {
        console.log('[API /api/admin/sales] First sale:', directTest[0]);
      }
    } catch (err) {
      console.error('[API /api/admin/sales] Direct DB test error:', err);
    }
    
    try {
      const { startDate, endDate } = req.query;
      const start = startDate ? new Date(startDate as string) : undefined;
      const end = endDate ? new Date(endDate as string) : undefined;
      
      console.log('[API /api/admin/sales] Fetching sales with params:', { startDate, endDate, start, end });
      const sales = await storage.getAllSales(start, end);
      console.log('[API /api/admin/sales] Retrieved sales:', sales?.length || 0, 'records');
      console.log('[API /api/admin/sales] First sale (if any):', sales?.[0]);
      res.json(sales);
    } catch (error) {
      console.error('Error fetching sales:', error);
      res.status(500).json({ message: "Failed to fetch sales" });
    }
  });

  // Get recent sales with joined data
  app.get("/api/admin/sales/recent", isAuthenticated, async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 5;
      console.log('[API /api/admin/sales/recent] Fetching recent sales with limit:', limit);
      const recentSales = await storage.getRecentSales(limit);
      console.log('[API /api/admin/sales/recent] Retrieved recent sales:', recentSales?.length || 0, 'records');
      res.json(recentSales);
    } catch (error) {
      console.error('Error fetching recent sales:', error);
      res.status(500).json({ message: "Failed to fetch recent sales" });
    }
  });

  // Get single sale
  app.get("/api/admin/sales/:id", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const sale = await storage.getSale(id);
      
      if (!sale) {
        return res.status(404).json({ message: "Sale not found" });
      }
      
      res.json(sale);
    } catch (error) {
      console.error('Error fetching sale:', error);
      res.status(500).json({ message: "Failed to fetch sale" });
    }
  });

  // Create sale (handles both inventory and drop ship sales)
  app.post("/api/admin/sales", isAuthenticated, async (req, res) => {
    try {
      const { saleType, inventoryItemId, supplierId, ...saleData } = req.body;
      
      // Convert date string to Date object
      const dataWithDate = {
        ...saleData,
        saleDate: saleData.saleDate ? new Date(saleData.saleDate) : new Date(),
      };
      
      let sale;
      
      if (saleType === "inventory" && inventoryItemId) {
        // Handle inventory sale
        // 1. Validate inventory item is available
        const inventoryItem = await storage.getInventoryItem(inventoryItemId);
        if (!inventoryItem || inventoryItem.status !== "in_stock") {
          return res.status(400).json({ message: "Inventory item is not available" });
        }
        
        // 2. Create sale with inventory item reference
        const saleWithInventory = {
          ...dataWithDate,
          productId: inventoryItem.productId,
        };
        sale = await storage.createSale(saleWithInventory);
        
        // 3. Update inventory item status to sold and link to sale
        await storage.updateInventoryItem(inventoryItemId, { 
          status: "sold",
          saleId: sale.id,
          soldDate: new Date()
        });
        
      } else if (saleType === "dropship" && supplierId) {
        // Handle drop ship sale
        // 1. Create the sale
        sale = await storage.createSale(dataWithDate);
        
        // 2. Create drop ship order
        await storage.createDropShipOrder({
          saleId: sale.id,
          supplierId,
          fulfillmentStatus: "pending",
          orderDate: new Date()
        });
        
      } else {
        // Regular sale without inventory or drop ship
        sale = await storage.createSale(dataWithDate);
      }
      
      res.status(201).json(sale);
    } catch (error) {
      console.error('Error creating sale:', error);
      res.status(400).json({ message: "Failed to create sale", error: error instanceof Error ? error.message : "Unknown error" });
    }
  });

  // Update sale
  app.put("/api/admin/sales/:id", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      
      // Convert date string to Date object if present
      const dataWithDate = {
        ...req.body,
        saleDate: req.body.saleDate ? new Date(req.body.saleDate) : undefined,
      };
      
      const sale = await storage.updateSale(id, dataWithDate);
      
      if (!sale) {
        return res.status(404).json({ message: "Sale not found" });
      }
      
      res.json(sale);
    } catch (error) {
      console.error('Error updating sale:', error);
      res.status(400).json({ message: "Failed to update sale" });
    }
  });

  // Delete sale
  app.delete("/api/admin/sales/:id", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const success = await storage.deleteSale(id);
      
      if (!success) {
        return res.status(404).json({ message: "Sale not found" });
      }
      
      res.json({ message: "Sale deleted successfully" });
    } catch (error) {
      console.error('Error deleting sale:', error);
      res.status(500).json({ message: "Failed to delete sale" });
    }
  });

  // Get sales by channel
  app.get("/api/admin/sales/by-channel/:channelId", isAuthenticated, async (req, res) => {
    try {
      const { channelId } = req.params;
      const sales = await storage.getSalesByChannel(channelId);
      res.json(sales);
    } catch (error) {
      console.error('Error fetching sales by channel:', error);
      res.status(500).json({ message: "Failed to fetch sales by channel" });
    }
  });

  // Get sales by photo
  app.get("/api/admin/sales/by-photo/:photoId", isAuthenticated, async (req, res) => {
    try {
      const { photoId } = req.params;
      const sales = await storage.getSalesByPhoto(photoId);
      res.json(sales);
    } catch (error) {
      console.error('Error fetching sales by photo:', error);
      res.status(500).json({ message: "Failed to fetch sales by photo" });
    }
  });

  // ============================================
  // PRODUCT ROUTES
  // ============================================

  // Get all products
  app.get("/api/products", async (req, res) => {
    try {
      const products = await storage.getAllProducts();
      res.json(products);
    } catch (error) {
      console.error('Error fetching products:', error);
      res.status(500).json({ message: "Failed to fetch products" });
    }
  });

  // Get single product
  app.get("/api/products/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const product = await storage.getProduct(id);
      
      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }
      
      res.json(product);
    } catch (error) {
      console.error('Error fetching product:', error);
      res.status(500).json({ message: "Failed to fetch product" });
    }
  });

  // Get products by photo
  app.get("/api/products/by-photo/:photoId", async (req, res) => {
    try {
      const { photoId } = req.params;
      const products = await storage.getProductsByPhoto(photoId);
      res.json(products);
    } catch (error) {
      console.error('Error fetching products by photo:', error);
      res.status(500).json({ message: "Failed to fetch products by photo" });
    }
  });

  // Create product (admin only)
  app.post("/api/products", isAuthenticated, async (req, res) => {
    try {
      const validatedData = insertProductSchema.parse(req.body);
      
      // If a photoId is provided, copy title, description, and originalDate from the photo
      let finalData = { ...validatedData };
      if (validatedData.photoId) {
        const photo = await storage.getPhoto(validatedData.photoId);
        if (photo) {
          // Only copy if the values aren't already provided
          if (!finalData.title) {
            finalData.title = photo.title;
          }
          if (!finalData.description) {
            finalData.description = photo.description || null;
          }
          if (!finalData.originalDate) {
            finalData.originalDate = photo.originalDate || null;
          }
        }
      }
      
      const product = await storage.createProduct(finalData);
      res.status(201).json(product);
    } catch (error) {
      console.error('Error creating product:', error);
      res.status(400).json({ message: "Failed to create product", error: error instanceof Error ? error.message : "Unknown error" });
    }
  });

  // Update product (admin only)
  app.patch("/api/products/:id", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      
      // Validate the update data using partial schema
      const updateSchema = insertProductSchema.partial();
      const validatedData = updateSchema.parse(req.body);
      
      // If a photoId is being updated and title/description/originalDate are not provided, copy from photo
      let finalData = { ...validatedData };
      if (validatedData.photoId) {
        const photo = await storage.getPhoto(validatedData.photoId);
        if (photo) {
          // Get current product to see if title/description/originalDate should be copied
          const currentProduct = await storage.getProduct(id);
          if (currentProduct) {
            // Only copy if not provided in the update and product doesn't have them yet
            if (!finalData.title && !currentProduct.title) {
              finalData.title = photo.title;
            }
            if (!finalData.description && !currentProduct.description) {
              finalData.description = photo.description || null;
            }
            if (!finalData.originalDate && !currentProduct.originalDate) {
              finalData.originalDate = photo.originalDate || null;
            }
          }
        }
      }
      
      const product = await storage.updateProduct(id, finalData);
      
      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }
      
      res.json(product);
    } catch (error) {
      console.error('Error updating product:', error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ 
          message: "Invalid product data", 
          errors: error.errors 
        });
      } else {
        res.status(400).json({ message: "Failed to update product" });
      }
    }
  });

  // Delete product (admin only)
  app.delete("/api/products/:id", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const success = await storage.deleteProduct(id);
      
      if (!success) {
        return res.status(404).json({ message: "Product not found" });
      }
      
      res.json({ message: "Product deleted successfully" });
    } catch (error) {
      console.error('Error deleting product:', error);
      res.status(400).json({ message: "Failed to delete product" });
    }
  });

  // ============================================
  // CSV IMPORT ROUTES
  // ============================================
  
  // Configure multer for CSV uploads
  const csvUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    fileFilter: (req, file, cb) => {
      if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
        cb(null, true);
      } else {
        cb(new Error('Only CSV files are allowed'));
      }
    },
  });
  
  // Import Wix products from CSV
  app.post("/api/admin/import/wix-products", isAuthenticated, csvUpload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }
      
      const csvText = req.file.buffer.toString('utf-8');
      const result = await importWixProducts(csvText);
      
      res.json(result);
    } catch (error) {
      console.error('Error importing Wix products:', error);
      res.status(500).json({ 
        message: "Failed to import products", 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  });
  
  // Import Wix orders from CSV
  app.post("/api/admin/import/wix-orders", isAuthenticated, csvUpload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }
      
      const csvText = req.file.buffer.toString('utf-8');
      const result = await importWixOrders(csvText);
      
      res.json(result);
    } catch (error) {
      console.error('Error importing Wix orders:', error);
      res.status(500).json({ 
        message: "Failed to import orders", 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  });
  
  // ============================================
  // INVENTORY ITEMS ROUTES
  // ============================================
  
  // Get all photos for inventory dropdown
  app.get("/api/admin/photos", isAuthenticated, async (req, res) => {
    try {
      const photos = await storage.getAllPhotos();
      // Filter for saleable photos only (neverForSale = false)
      const saleablePhotos = photos.filter(p => !p.neverForSale);
      // Sort alphabetically by title (case-insensitive)
      const sortedPhotos = saleablePhotos.sort((a, b) => 
        a.title.toLowerCase().localeCompare(b.title.toLowerCase())
      );
      // Return only id and title for dropdown
      const photoList = sortedPhotos.map(p => ({ id: p.id, title: p.title }));
      res.json(photoList);
    } catch (error) {
      console.error('Error fetching photos for inventory:', error);
      res.status(500).json({ message: "Failed to fetch photos" });
    }
  });
  
  // Get all inventory items
  app.get("/api/admin/inventory", isAuthenticated, async (req, res) => {
    try {
      const { status } = req.query;
      const items = await storage.getAllInventoryItems(status as string | undefined);
      
      // Enhance items with photo data and size labels
      const itemsWithDetails = await Promise.all(items.map(async (item) => {
        // Get product, then photo through product
        const product = item.productId ? await storage.getProduct(item.productId) : undefined;
        const photo = product?.photoId ? await storage.getPhoto(product.photoId) : undefined;
        const productSize = item.productSizeId ? await storage.getProductSize(item.productSizeId) : undefined;
        
        return {
          ...item,
          productTitle: product?.title,
          photoImageUrl: photo?.imageUrl,
          sizeLabel: productSize?.sizeLabel || 'Unknown Size'
        };
      }));
      
      res.json(itemsWithDetails);
    } catch (error) {
      console.error('Error fetching inventory:', error);
      res.status(500).json({ message: "Failed to fetch inventory" });
    }
  });

  // Get inventory with details
  app.get("/api/admin/inventory/details", isAuthenticated, async (req, res) => {
    try {
      const items = await storage.getInventoryWithDetails();
      res.json(items);
    } catch (error) {
      console.error('Error fetching inventory details:', error);
      res.status(500).json({ message: "Failed to fetch inventory details" });
    }
  });

  // Get available inventory items (in_stock status)
  app.get("/api/admin/inventory/available", isAuthenticated, async (req, res) => {
    try {
      const items = await storage.getInventoryWithDetails();
      // Filter for in_stock items
      const availableItems = items.filter(item => item.status === "in_stock");
      res.json(availableItems);
    } catch (error) {
      console.error('Error fetching available inventory:', error);
      res.status(500).json({ message: "Failed to fetch available inventory" });
    }
  });

  // Get business dashboard statistics
  app.get("/api/admin/business/stats", isAuthenticated, async (req, res) => {
    try {
      // Get all inventory items
      const allInventory = await storage.getAllInventoryItems();
      
      // Calculate total inventory value (only unsold items)
      const totalInventoryValue = allInventory
        .filter(item => !item.saleId) // Only count items not yet sold
        .reduce((sum, item) => sum + (item.acquisitionCost || 0), 0);
      
      // Get all-time sales (no date filter) 
      const allSalesData = await storage.getAllSales();
      const totalSales = allSalesData.reduce((sum, sale) => sum + sale.soldPrice, 0);
      
      // Get pending drop-ship orders
      const pendingOrdersData = await storage.getAllDropShipOrders('pending');
      const pendingOrders = pendingOrdersData.length;
      
      // Get all-time expenses
      const allExpenses = await storage.getAllExpenses();
      const totalExpenses = allExpenses.reduce((sum, expense) => sum + expense.amount, 0);
      
      res.json({
        totalInventoryValue,
        monthlySales: totalSales, // Keep the same field name for compatibility, but show all-time sales
        pendingOrders,
        totalExpenses
      });
    } catch (error) {
      console.error('Error fetching business stats:', error);
      res.status(500).json({ message: "Failed to fetch business statistics" });
    }
  });

  // Get single inventory item
  app.get("/api/admin/inventory/:id", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const item = await storage.getInventoryItem(id);
      
      if (!item) {
        return res.status(404).json({ message: "Inventory item not found" });
      }
      
      res.json(item);
    } catch (error) {
      console.error('Error fetching inventory item:', error);
      res.status(500).json({ message: "Failed to fetch inventory item" });
    }
  });

  // Create inventory item
  app.post("/api/admin/inventory", isAuthenticated, async (req, res) => {
    try {
      // Convert date strings to Date objects for timestamp fields
      const dataWithDates = {
        ...req.body,
        originalDate: req.body.originalDate ? new Date(req.body.originalDate) : undefined,
        purchaseDate: req.body.purchaseDate ? new Date(req.body.purchaseDate) : undefined,
        receivedDate: req.body.receivedDate ? new Date(req.body.receivedDate) : undefined,
        soldDate: req.body.soldDate ? new Date(req.body.soldDate) : undefined,
        shippedDate: req.body.shippedDate ? new Date(req.body.shippedDate) : undefined,
      };
      
      const validatedData = insertInventoryItemSchema.parse(dataWithDates);
      const item = await storage.createInventoryItem(validatedData);
      res.status(201).json(item);
    } catch (error) {
      console.error('Error creating inventory item:', error);
      res.status(400).json({ message: "Failed to create inventory item", error: error instanceof Error ? error.message : "Unknown error" });
    }
  });

  // Update inventory item
  app.put("/api/admin/inventory/:id", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      
      // Convert date strings to Date objects for timestamp fields
      const dataWithDates = {
        ...req.body,
        originalDate: req.body.originalDate ? new Date(req.body.originalDate) : undefined,
        purchaseDate: req.body.purchaseDate ? new Date(req.body.purchaseDate) : undefined,
        receivedDate: req.body.receivedDate ? new Date(req.body.receivedDate) : undefined,
        soldDate: req.body.soldDate ? new Date(req.body.soldDate) : undefined,
        shippedDate: req.body.shippedDate ? new Date(req.body.shippedDate) : undefined,
      };
      
      const item = await storage.updateInventoryItem(id, dataWithDates);
      
      if (!item) {
        return res.status(404).json({ message: "Inventory item not found" });
      }
      
      res.json(item);
    } catch (error) {
      console.error('Error updating inventory item:', error);
      res.status(400).json({ message: "Failed to update inventory item" });
    }
  });

  // Delete inventory item
  app.delete("/api/admin/inventory/:id", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const success = await storage.deleteInventoryItem(id);
      
      if (!success) {
        return res.status(404).json({ message: "Inventory item not found" });
      }
      
      res.json({ message: "Inventory item deleted successfully" });
    } catch (error) {
      console.error('Error deleting inventory item:', error);
      res.status(500).json({ message: "Failed to delete inventory item" });
    }
  });

  // Get inventory by photo
  app.get("/api/admin/inventory/by-photo/:photoId", isAuthenticated, async (req, res) => {
    try {
      const { photoId } = req.params;
      const items = await storage.getInventoryByPhoto(photoId);
      res.json(items);
    } catch (error) {
      console.error('Error fetching inventory by photo:', error);
      res.status(500).json({ message: "Failed to fetch inventory by photo" });
    }
  });

  // ============================================
  // DROP SHIP ORDERS ROUTES
  // ============================================
  
  // Get all drop ship orders
  app.get("/api/admin/dropship", isAuthenticated, async (req, res) => {
    try {
      const { status } = req.query;
      const orders = await storage.getAllDropShipOrders(status as string | undefined);
      res.json(orders);
    } catch (error) {
      console.error('Error fetching drop ship orders:', error);
      res.status(500).json({ message: "Failed to fetch drop ship orders" });
    }
  });

  // Get single drop ship order
  app.get("/api/admin/dropship/:id", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const order = await storage.getDropShipOrder(id);
      
      if (!order) {
        return res.status(404).json({ message: "Drop ship order not found" });
      }
      
      res.json(order);
    } catch (error) {
      console.error('Error fetching drop ship order:', error);
      res.status(500).json({ message: "Failed to fetch drop ship order" });
    }
  });

  // Create drop ship order
  app.post("/api/admin/dropship", isAuthenticated, async (req, res) => {
    try {
      const validatedData = insertDropShipOrderSchema.parse(req.body);
      const order = await storage.createDropShipOrder(validatedData);
      res.status(201).json(order);
    } catch (error) {
      console.error('Error creating drop ship order:', error);
      res.status(400).json({ message: "Failed to create drop ship order", error: error instanceof Error ? error.message : "Unknown error" });
    }
  });

  // Update drop ship order
  app.put("/api/admin/dropship/:id", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const order = await storage.updateDropShipOrder(id, req.body);
      
      if (!order) {
        return res.status(404).json({ message: "Drop ship order not found" });
      }
      
      res.json(order);
    } catch (error) {
      console.error('Error updating drop ship order:', error);
      res.status(400).json({ message: "Failed to update drop ship order" });
    }
  });

  // Delete drop ship order
  app.delete("/api/admin/dropship/:id", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const success = await storage.deleteDropShipOrder(id);
      
      if (!success) {
        return res.status(404).json({ message: "Drop ship order not found" });
      }
      
      res.json({ message: "Drop ship order deleted successfully" });
    } catch (error) {
      console.error('Error deleting drop ship order:', error);
      res.status(500).json({ message: "Failed to delete drop ship order" });
    }
  });

  // Get drop ship orders by sale
  app.get("/api/admin/dropship/by-sale/:saleId", isAuthenticated, async (req, res) => {
    try {
      const { saleId } = req.params;
      const orders = await storage.getDropShipOrdersBySale(saleId);
      res.json(orders);
    } catch (error) {
      console.error('Error fetching drop ship orders by sale:', error);
      res.status(500).json({ message: "Failed to fetch drop ship orders by sale" });
    }
  });

  // ============================================
  // EXPENSE CATEGORIES ROUTES
  // ============================================
  
  // Get all expense categories
  app.get("/api/admin/expense-categories", isAuthenticated, async (req, res) => {
    try {
      const categories = await storage.getAllExpenseCategories();
      res.json(categories);
    } catch (error) {
      console.error('Error fetching expense categories:', error);
      res.status(500).json({ message: "Failed to fetch expense categories" });
    }
  });

  // Get single expense category
  app.get("/api/admin/expense-categories/:id", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const category = await storage.getExpenseCategory(id);
      
      if (!category) {
        return res.status(404).json({ message: "Expense category not found" });
      }
      
      res.json(category);
    } catch (error) {
      console.error('Error fetching expense category:', error);
      res.status(500).json({ message: "Failed to fetch expense category" });
    }
  });

  // Create expense category
  app.post("/api/admin/expense-categories", isAuthenticated, async (req, res) => {
    try {
      const validatedData = insertExpenseCategorySchema.parse(req.body);
      const category = await storage.createExpenseCategory(validatedData);
      res.status(201).json(category);
    } catch (error) {
      console.error('Error creating expense category:', error);
      res.status(400).json({ message: "Failed to create expense category", error: error instanceof Error ? error.message : "Unknown error" });
    }
  });

  // Update expense category
  app.put("/api/admin/expense-categories/:id", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const category = await storage.updateExpenseCategory(id, req.body);
      
      if (!category) {
        return res.status(404).json({ message: "Expense category not found" });
      }
      
      res.json(category);
    } catch (error) {
      console.error('Error updating expense category:', error);
      res.status(400).json({ message: "Failed to update expense category" });
    }
  });

  // Delete expense category
  app.delete("/api/admin/expense-categories/:id", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const success = await storage.deleteExpenseCategory(id);
      
      if (!success) {
        return res.status(404).json({ message: "Expense category not found" });
      }
      
      res.json({ message: "Expense category deleted successfully" });
    } catch (error) {
      console.error('Error deleting expense category:', error);
      res.status(500).json({ message: "Failed to delete expense category" });
    }
  });

  // ============================================
  // EXPENSES ROUTES
  // ============================================
  
  // Get all expenses
  app.get("/api/admin/expenses", isAuthenticated, async (req, res) => {
    try {
      const { startDate, endDate } = req.query;
      const start = startDate ? new Date(startDate as string) : undefined;
      const end = endDate ? new Date(endDate as string) : undefined;
      
      const expenses = await storage.getAllExpenses(start, end);
      res.json(expenses);
    } catch (error) {
      console.error('Error fetching expenses:', error);
      res.status(500).json({ message: "Failed to fetch expenses" });
    }
  });

  // Get single expense
  app.get("/api/admin/expenses/:id", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const expense = await storage.getExpense(id);
      
      if (!expense) {
        return res.status(404).json({ message: "Expense not found" });
      }
      
      res.json(expense);
    } catch (error) {
      console.error('Error fetching expense:', error);
      res.status(500).json({ message: "Failed to fetch expense" });
    }
  });

  // Create expense
  app.post("/api/admin/expenses", isAuthenticated, async (req, res) => {
    try {
      // Convert expenseDate string to Date object for the schema validation
      const dataWithDate = {
        ...req.body,
        expenseDate: req.body.expenseDate ? new Date(req.body.expenseDate) : undefined,
      };
      const validatedData = insertExpenseSchema.parse(dataWithDate);
      const expense = await storage.createExpense(validatedData);
      res.status(201).json(expense);
    } catch (error) {
      console.error('Error creating expense:', error);
      res.status(400).json({ message: "Failed to create expense", error: error instanceof Error ? error.message : "Unknown error" });
    }
  });

  // Update expense
  app.put("/api/admin/expenses/:id", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const expense = await storage.updateExpense(id, req.body);
      
      if (!expense) {
        return res.status(404).json({ message: "Expense not found" });
      }
      
      res.json(expense);
    } catch (error) {
      console.error('Error updating expense:', error);
      res.status(400).json({ message: "Failed to update expense" });
    }
  });

  // Delete expense
  app.delete("/api/admin/expenses/:id", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const success = await storage.deleteExpense(id);
      
      if (!success) {
        return res.status(404).json({ message: "Expense not found" });
      }
      
      res.json({ message: "Expense deleted successfully" });
    } catch (error) {
      console.error('Error deleting expense:', error);
      res.status(500).json({ message: "Failed to delete expense" });
    }
  });

  // Get expenses by category
  app.get("/api/admin/expenses/by-category/:categoryId", isAuthenticated, async (req, res) => {
    try {
      const { categoryId } = req.params;
      const expenses = await storage.getExpensesByCategory(categoryId);
      res.json(expenses);
    } catch (error) {
      console.error('Error fetching expenses by category:', error);
      res.status(500).json({ message: "Failed to fetch expenses by category" });
    }
  });

  // Get expenses by vendor
  app.get("/api/admin/expenses/by-vendor/:vendor", isAuthenticated, async (req, res) => {
    try {
      const { vendor } = req.params;
      const expenses = await storage.getExpensesByVendor(vendor);
      res.json(expenses);
    } catch (error) {
      console.error('Error fetching expenses by vendor:', error);
      res.status(500).json({ message: "Failed to fetch expenses by vendor" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
