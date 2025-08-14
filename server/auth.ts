import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { db } from "./db";
import { users, userStats, emailVerifications, userFavorites, contestEntries } from "@shared/schema";
import { eq, and, gte } from "drizzle-orm";
import type { User } from "@shared/schema";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-change-in-production";
const JWT_EXPIRES_IN = "7d";

export interface AuthTokenPayload {
  userId: string;
  email: string;
  isAdmin: boolean;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function generateToken(payload: AuthTokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

export function verifyToken(token: string): AuthTokenPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as AuthTokenPayload;
  } catch {
    return null;
  }
}

export function generateResetToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export function generateVerificationToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export async function createUser(
  email: string, 
  username: string, 
  password: string,
  firstName?: string,
  lastName?: string
): Promise<User> {
  const passwordHash = await hashPassword(password);
  
  // Create user
  const [user] = await db.insert(users).values({
    email,
    username,
    passwordHash,
    firstName,
    lastName,
  }).returning();

  // Create user stats entry
  await db.insert(userStats).values({
    userId: user.id,
  });

  return user;
}

export async function authenticateUser(emailOrUsername: string, password: string): Promise<User | null> {
  const [user] = await db
    .select()
    .from(users)
    .where(
      emailOrUsername.includes("@") 
        ? eq(users.email, emailOrUsername)
        : eq(users.username, emailOrUsername)
    );

  if (!user) return null;

  const isValid = await verifyPassword(password, user.passwordHash);
  if (!isValid) return null;

  // Update last login
  await db
    .update(users)
    .set({ lastLoginAt: new Date() })
    .where(eq(users.id, user.id));

  return user;
}

export async function createPasswordResetToken(email: string): Promise<string | null> {
  const [user] = await db.select().from(users).where(eq(users.email, email));
  if (!user) return null;

  const token = generateResetToken();
  const expiry = new Date(Date.now() + 3600000); // 1 hour

  await db
    .update(users)
    .set({ 
      resetToken: token,
      resetTokenExpiry: expiry 
    })
    .where(eq(users.id, user.id));

  return token;
}

export async function resetPassword(token: string, newPassword: string): Promise<boolean> {
  const [user] = await db
    .select()
    .from(users)
    .where(
      and(
        eq(users.resetToken, token),
        gte(users.resetTokenExpiry, new Date())
      )
    );

  if (!user) return false;

  const passwordHash = await hashPassword(newPassword);
  
  await db
    .update(users)
    .set({ 
      passwordHash,
      resetToken: null,
      resetTokenExpiry: null 
    })
    .where(eq(users.id, user.id));

  return true;
}

export async function createEmailVerificationToken(userId: string): Promise<string> {
  const token = generateVerificationToken();
  const expiresAt = new Date(Date.now() + 86400000); // 24 hours

  await db.insert(emailVerifications).values({
    userId,
    token,
    expiresAt,
  });

  return token;
}

export async function verifyEmail(token: string): Promise<boolean> {
  const [verification] = await db
    .select()
    .from(emailVerifications)
    .where(
      and(
        eq(emailVerifications.token, token),
        gte(emailVerifications.expiresAt, new Date())
      )
    );

  if (!verification) return false;

  await db
    .update(users)
    .set({ emailVerified: true })
    .where(eq(users.id, verification.userId));

  // Delete used token
  await db
    .delete(emailVerifications)
    .where(eq(emailVerifications.id, verification.id));

  return true;
}

// Contest tracking functions
export function getCurrentContestPeriod(type: "monthly" | "quarterly"): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  
  if (type === "monthly") {
    return `${year}-${month.toString().padStart(2, "0")}`;
  } else {
    const quarter = Math.ceil(month / 3);
    return `${year}-Q${quarter}`;
  }
}

export async function trackUserVote(userId: string): Promise<void> {
  // Get current stats
  const [stats] = await db
    .select()
    .from(userStats)
    .where(eq(userStats.userId, userId));
    
  if (stats) {
    // Update existing stats
    await db
      .update(userStats)
      .set({ 
        totalVotes: stats.totalVotes + 1,
        monthlyVotes: stats.monthlyVotes + 1,
        quarterlyVotes: stats.quarterlyVotes + 1,
        lastVoteAt: new Date()
      })
      .where(eq(userStats.userId, userId));
  } else {
    // Create new stats entry
    await db.insert(userStats).values({
      userId,
      totalVotes: 1,
      monthlyVotes: 1,
      quarterlyVotes: 1,
      lastVoteAt: new Date()
    });
  }

  // Update or create contest entries
  const monthlyPeriod = getCurrentContestPeriod("monthly");
  const quarterlyPeriod = getCurrentContestPeriod("quarterly");

  // Monthly contest entry
  const [monthlyEntry] = await db
    .select()
    .from(contestEntries)
    .where(
      and(
        eq(contestEntries.userId, userId),
        eq(contestEntries.contestPeriod, monthlyPeriod),
        eq(contestEntries.contestType, "monthly")
      )
    );

  if (monthlyEntry) {
    await db
      .update(contestEntries)
      .set({ voteCount: monthlyEntry.voteCount + 1 })
      .where(eq(contestEntries.id, monthlyEntry.id));
  } else {
    await db.insert(contestEntries).values({
      userId,
      contestPeriod: monthlyPeriod,
      contestType: "monthly",
      voteCount: 1,
    });
  }

  // Quarterly contest entry
  const [quarterlyEntry] = await db
    .select()
    .from(contestEntries)
    .where(
      and(
        eq(contestEntries.userId, userId),
        eq(contestEntries.contestPeriod, quarterlyPeriod),
        eq(contestEntries.contestType, "quarterly")
      )
    );

  if (quarterlyEntry) {
    await db
      .update(contestEntries)
      .set({ voteCount: quarterlyEntry.voteCount + 1 })
      .where(eq(contestEntries.id, quarterlyEntry.id));
  } else {
    await db.insert(contestEntries).values({
      userId,
      contestPeriod: quarterlyPeriod,
      contestType: "quarterly",
      voteCount: 1,
    });
  }
}