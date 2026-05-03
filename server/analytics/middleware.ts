/**
 * Analytics request helpers: cookie session id, daily-rotating visitor hash,
 * bot/device detection. No external deps.
 */
import crypto from "crypto";
import type { Request, Response } from "express";
import { db } from "../db";
import { dailyTrafficSalts } from "@shared/schema";
import { eq } from "drizzle-orm";

export const SESSION_COOKIE = "cmnAnalyticsSid";
export const SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes sliding

const BOT_RE = /bot|spider|crawler|crawling|slurp|facebookexternalhit|whatsapp|telegram|preview|monitor|pingdom|uptime|lighthouse|headlesschrome|axios|curl|wget|python-requests|node-fetch|java\//i;
const TABLET_RE = /ipad|tablet|playbook|silk|kindle/i;
const MOBILE_RE = /mobi|android|iphone|ipod|blackberry|opera mini|iemobile/i;

export function classifyDevice(ua?: string): "mobile" | "tablet" | "desktop" | "bot" {
  if (!ua) return "desktop";
  if (BOT_RE.test(ua)) return "bot";
  if (TABLET_RE.test(ua)) return "tablet";
  if (MOBILE_RE.test(ua)) return "mobile";
  return "desktop";
}

export function isBotUA(ua?: string): boolean {
  return !!ua && BOT_RE.test(ua);
}

export function classifyBrowser(ua?: string): string {
  if (!ua) return "unknown";
  if (/edg\//i.test(ua)) return "Edge";
  if (/opr\/|opera/i.test(ua)) return "Opera";
  if (/chrome\//i.test(ua) && !/chromium/i.test(ua)) return "Chrome";
  if (/firefox\//i.test(ua)) return "Firefox";
  if (/safari\//i.test(ua) && !/chrome/i.test(ua)) return "Safari";
  return "other";
}

export function countryFromHeaders(req: Request): string | null {
  const h = req.headers;
  const v = (h["cf-ipcountry"] || h["x-vercel-ip-country"] || h["x-country-code"]) as string | undefined;
  if (!v || typeof v !== "string") return null;
  const c = v.trim().toUpperCase();
  return /^[A-Z]{2}$/.test(c) ? c : null;
}

function utcDay(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

const saltCache = new Map<string, string>();

/**
 * Return today's salt, creating it (idempotently) on first call of the day.
 */
export async function getTodaySalt(): Promise<string> {
  const day = utcDay();
  const cached = saltCache.get(day);
  if (cached) return cached;
  const [existing] = await db.select().from(dailyTrafficSalts).where(eq(dailyTrafficSalts.day, day));
  if (existing) {
    saltCache.set(day, existing.salt);
    return existing.salt;
  }
  const salt = crypto.randomBytes(32).toString("hex");
  try {
    await db.insert(dailyTrafficSalts).values({ day, salt });
    saltCache.set(day, salt);
    return salt;
  } catch {
    // race: another process inserted first
    const [now] = await db.select().from(dailyTrafficSalts).where(eq(dailyTrafficSalts.day, day));
    const final = now?.salt || salt;
    saltCache.set(day, final);
    return final;
  }
}

export async function visitorHashFor(req: Request): Promise<string> {
  const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0].trim() || req.ip || "";
  const ua = (req.headers["user-agent"] as string) || "";
  const salt = await getTodaySalt();
  return crypto.createHash("sha256").update(ip + "|" + ua + "|" + salt).digest("hex").slice(0, 32);
}

function parseCookies(header?: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(";")) {
    const i = part.indexOf("=");
    if (i < 0) continue;
    const k = part.slice(0, i).trim();
    const v = part.slice(i + 1).trim();
    if (k) out[k] = decodeURIComponent(v);
  }
  return out;
}

export function readSessionCookie(req: Request): string | undefined {
  return parseCookies(req.headers.cookie as string)[SESSION_COOKIE];
}

export function setSessionCookie(res: Response, sid: string): void {
  // 30-min sliding cookie; HttpOnly so JS can't read; SameSite=Lax for normal nav.
  res.setHeader(
    "Set-Cookie",
    `${SESSION_COOKIE}=${encodeURIComponent(sid)}; Path=/; Max-Age=${SESSION_TTL_MS / 1000}; HttpOnly; SameSite=Lax`,
  );
}

export function newSessionId(): string {
  return crypto.randomBytes(16).toString("hex");
}
