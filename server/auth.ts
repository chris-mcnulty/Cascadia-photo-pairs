import { Request, Response, NextFunction } from 'express';
import { storage } from './storage';
import twilio from 'twilio';

interface AuthSession {
  isAuthenticated: boolean;
  pendingMfa: boolean;
  mfaCode?: string;
  mfaExpiry?: number;
}

// Simple in-memory session store (in production, use Redis or database)
const sessions = new Map<string, AuthSession>();

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

export function generateSessionId(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

export function generateMfaCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function sendMfaCode(phoneNumber: string, code: string): Promise<boolean> {
  try {
    if (!process.env.TWILIO_PHONE_NUMBER) {
      console.error('TWILIO_PHONE_NUMBER not configured');
      return false;
    }

    await twilioClient.messages.create({
      body: `Your Cascadia Oceanic admin verification code is: ${code}`,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: phoneNumber
    });
    
    return true;
  } catch (error) {
    console.error('Failed to send SMS:', error);
    return false;
  }
}

export function getSession(sessionId: string): AuthSession {
  return sessions.get(sessionId) || { isAuthenticated: false, pendingMfa: false };
}

export function setSession(sessionId: string, session: AuthSession): void {
  sessions.set(sessionId, session);
}

export function clearSession(sessionId: string): void {
  sessions.delete(sessionId);
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const sessionId = req.headers['x-session-id'] as string;
  
  if (!sessionId) {
    res.status(401).json({ message: 'Session ID required', requiresAuth: true });
    return;
  }
  
  const session = getSession(sessionId);
  
  if (!session.isAuthenticated) {
    res.status(401).json({ message: 'Authentication required', requiresAuth: true });
    return;
  }
  
  next();
}

// Cleanup expired MFA codes every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [sessionId, session] of Array.from(sessions.entries())) {
    if (session.mfaExpiry && session.mfaExpiry < now) {
      session.pendingMfa = false;
      session.mfaCode = undefined;
      session.mfaExpiry = undefined;
    }
  }
}, 5 * 60 * 1000);