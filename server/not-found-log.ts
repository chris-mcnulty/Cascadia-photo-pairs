import type { Express } from "express";
import { db } from "./db";
import { notFoundLogs, users } from "@shared/schema";
import { eq, desc, gte, lte, and } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { verifyToken } from "./auth";

async function adminAuthMiddleware(req: any, res: any, next: any) {
  try {
    const authToken = req.headers["authorization"]?.replace("Bearer ", "") || req.headers["x-auth-token"];
    if (authToken) {
      const tokenPayload = verifyToken(authToken);
      if (tokenPayload?.userId) {
        const [user] = await db.select().from(users).where(eq(users.id, tokenPayload.userId));
        if (user && (user.isAdmin || user.isMasterAdmin)) return next();
      }
    }
  } catch {}
  return res.status(401).json({ message: "Admin authentication required" });
}

export function registerNotFoundLogRoutes(app: Express) {
  // Public: log a 404 hit (client-side reporter)
  app.post("/api/404-log", async (req, res) => {
    try {
      const { path, referrer, userAgent } = req.body;
      if (!path || typeof path !== "string") return res.status(400).json({ message: "path required" });
      const cleanPath = path.substring(0, 500);
      const cleanReferrer = referrer ? String(referrer).substring(0, 500) : null;
      const cleanUA = userAgent ? String(userAgent).substring(0, 500) : null;

      await db.execute(
        sql`
          INSERT INTO not_found_logs (id, path, hit_count, last_referrer, last_user_agent, resolved, first_seen_at, last_seen_at)
          VALUES (gen_random_uuid(), ${cleanPath}, 1, ${cleanReferrer}, ${cleanUA}, false, NOW(), NOW())
          ON CONFLICT (path) DO UPDATE SET
            hit_count = not_found_logs.hit_count + 1,
            last_referrer = EXCLUDED.last_referrer,
            last_user_agent = EXCLUDED.last_user_agent,
            last_seen_at = NOW()
        `
      );
      res.json({ ok: true });
    } catch {
      res.json({ ok: false });
    }
  });

  // Admin: list 404 log entries
  app.get("/api/admin/404-log", adminAuthMiddleware, async (req, res) => {
    try {
      const showResolved = req.query.resolved === "true";

      // Optional date-range filtering on last_seen_at
      let fromDate: Date | null = null;
      let toDate: Date | null = null;
      if (req.query.from) {
        fromDate = new Date(String(req.query.from));
      } else if (req.query.days) {
        const d = parseInt(String(req.query.days), 10);
        if (!isNaN(d) && d > 0) {
          fromDate = new Date(Date.now() - d * 24 * 60 * 60 * 1000);
        }
      }
      if (req.query.to) {
        toDate = new Date(String(req.query.to));
        // include the entire to-day
        toDate.setHours(23, 59, 59, 999);
      }

      const conditions: any[] = [];
      if (!showResolved) conditions.push(eq(notFoundLogs.resolved, false));
      if (fromDate) conditions.push(gte(notFoundLogs.lastSeenAt, fromDate));
      if (toDate) conditions.push(lte(notFoundLogs.lastSeenAt, toDate));

      let query = db.select().from(notFoundLogs);
      if (conditions.length === 1) {
        query = query.where(conditions[0]) as any;
      } else if (conditions.length > 1) {
        query = query.where(and(...conditions)) as any;
      }

      const rows = await (query as any).orderBy(desc(notFoundLogs.hitCount));
      res.json(rows);
    } catch {
      res.status(500).json({ message: "Failed to fetch 404 log" });
    }
  });

  // Admin: update a 404 log entry (mark resolved, add notes)
  app.patch("/api/admin/404-log/:id", adminAuthMiddleware, async (req, res) => {
    try {
      const { id } = req.params;
      const updates: Record<string, any> = {};
      if ("resolved" in req.body) updates.resolved = req.body.resolved;
      if ("notes" in req.body) updates.notes = req.body.notes;
      if (Object.keys(updates).length === 0)
        return res.status(400).json({ message: "No valid fields to update" });
      const [row] = await db
        .update(notFoundLogs)
        .set(updates)
        .where(eq(notFoundLogs.id, id))
        .returning();
      if (!row) return res.status(404).json({ message: "Entry not found" });
      res.json(row);
    } catch {
      res.status(500).json({ message: "Failed to update 404 log entry" });
    }
  });
}
