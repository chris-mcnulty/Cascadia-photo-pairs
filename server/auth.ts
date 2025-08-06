import { Request, Response, NextFunction } from 'express';
import { storage } from './storage';
import twilio from 'twilio';
import { db } from './db';
import { sessions } from '@shared/schema';
import { eq, sql } from 'drizzle-orm';
import type { Session, InsertSession } from '@shared/schema';

interface AuthSession {
  isAuthenticated: boolean;
  pendingMfa: boolean;
  mfaCode?: string;
  mfaExpiry?: number;
}

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

export function generateSessionId(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

export function generateMfaCode(): string {
  // Hardcoded for testing - user requested 121365
  return "121365";
}

export async function sendMfaCode(phoneNumber: string, code: string): Promise<boolean> {
  // Temporarily skip SMS sending and return success for testing
  console.log(`MFA Code for ${phoneNumber}: ${code} (hardcoded for testing)`);
  return true;
}

export async function getSession(sessionId: string): Promise<AuthSession> {
  try {
    const [session] = await db.select().from(sessions).where(eq(sessions.id, sessionId));
    
    if (!session) {
      return { isAuthenticated: false, pendingMfa: false };
    }
    
    // Check if session is expired (24 hours)
    const lastActive = new Date(session.lastActiveAt);
    const now = new Date();
    const hoursSinceActive = (now.getTime() - lastActive.getTime()) / (1000 * 60 * 60);
    
    if (hoursSinceActive > 24) {
      await clearSession(sessionId);
      return { isAuthenticated: false, pendingMfa: false };
    }
    
    // Update last active timestamp
    await db
      .update(sessions)
      .set({ lastActiveAt: sql`CURRENT_TIMESTAMP` })
      .where(eq(sessions.id, sessionId));
    
    return {
      isAuthenticated: session.isAuthenticated,
      pendingMfa: session.pendingMfa,
      mfaCode: session.mfaCode || undefined,
      mfaExpiry: session.mfaExpiry ? parseInt(session.mfaExpiry) : undefined,
    };
  } catch (error) {
    console.error('Error getting session:', error);
    return { isAuthenticated: false, pendingMfa: false };
  }
}

export async function setSession(sessionId: string, session: AuthSession): Promise<void> {
  try {
    const sessionData: InsertSession = {
      id: sessionId,
      isAuthenticated: session.isAuthenticated,
      pendingMfa: session.pendingMfa,
      mfaCode: session.mfaCode || null,
      mfaExpiry: session.mfaExpiry ? session.mfaExpiry.toString() : null,
    };
    
    // Upsert the session
    await db
      .insert(sessions)
      .values(sessionData)
      .onConflictDoUpdate({
        target: sessions.id,
        set: {
          isAuthenticated: sessionData.isAuthenticated,
          pendingMfa: sessionData.pendingMfa,
          mfaCode: sessionData.mfaCode,
          mfaExpiry: sessionData.mfaExpiry,
          lastActiveAt: sql`CURRENT_TIMESTAMP`,
        },
      });
  } catch (error) {
    console.error('Error setting session:', error);
  }
}

export async function clearSession(sessionId: string): Promise<void> {
  try {
    await db.delete(sessions).where(eq(sessions.id, sessionId));
  } catch (error) {
    console.error('Error clearing session:', error);
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const sessionId = req.headers['x-session-id'] as string;
  
  if (!sessionId) {
    res.status(401).json({ message: 'Session ID required', requiresAuth: true });
    return;
  }
  
  getSession(sessionId).then(session => {
    if (!session.isAuthenticated) {
      res.status(401).json({ message: 'Authentication required', requiresAuth: true });
      return;
    }
    
    next();
  }).catch(error => {
    console.error('Auth error:', error);
    res.status(500).json({ message: 'Authentication error' });
  });
}

// Cleanup expired MFA codes and old sessions every 5 minutes
setInterval(async () => {
  try {
    const now = Date.now();
    const oneDayAgo = new Date(now - 24 * 60 * 60 * 1000).toISOString();
    
    // Clear expired MFA codes
    await db
      .update(sessions)
      .set({ 
        pendingMfa: false, 
        mfaCode: null, 
        mfaExpiry: null 
      })
      .where(sql`${sessions.mfaExpiry} IS NOT NULL AND ${sessions.mfaExpiry} < '${now.toString()}'`);
    
    // Delete sessions older than 24 hours
    await db
      .delete(sessions)
      .where(sql`${sessions.lastActiveAt} < '${oneDayAgo}'`);
      
  } catch (error) {
    console.error('Session cleanup error:', error);
  }
}, 5 * 60 * 1000);