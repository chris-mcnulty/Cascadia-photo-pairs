import type { Express, Request, Response, NextFunction } from "express";
import { db } from "./db";
import { urlRedirects, users } from "@shared/schema";
import { eq } from "drizzle-orm";
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

type RedirectRule = {
  id: string;
  sourcePath: string;
  sourceHost: string | null;
  targetPath: string;
  statusCode: number;
  matchType: string;
};

type RuleCache = {
  exact: RedirectRule[];
  prefix: RedirectRule[];
};

let cache: RuleCache | null = null;

/** Strip trailing `/*` from a prefix source path so `/product-page/*` and `/product-page` behave identically. */
function canonicalizePrefixPath(p: string): string {
  return p.endsWith("/*") ? p.slice(0, -2) : p;
}

async function loadCache(): Promise<RuleCache> {
  const rows = await db
    .select({
      id: urlRedirects.id,
      sourcePath: urlRedirects.sourcePath,
      sourceHost: urlRedirects.sourceHost,
      targetPath: urlRedirects.targetPath,
      statusCode: urlRedirects.statusCode,
      matchType: urlRedirects.matchType,
    })
    .from(urlRedirects)
    .where(eq(urlRedirects.active, true));

  const result: RuleCache = { exact: [], prefix: [] };
  for (const row of rows) {
    if (row.matchType === "prefix") {
      result.prefix.push({ ...row, sourcePath: canonicalizePrefixPath(row.sourcePath) });
    } else {
      result.exact.push(row);
    }
  }
  cache = result;
  return result;
}

export function invalidateRedirectCache() {
  cache = null;
}

export async function redirectMiddleware(req: Request, res: Response, next: NextFunction) {
  if (
    req.path.startsWith("/api/") ||
    req.path.startsWith("/@") ||
    req.path.startsWith("/src/") ||
    req.path.startsWith("/node_modules/") ||
    req.path.startsWith("/assets/")
  ) {
    return next();
  }
  try {
    const rules = cache ?? (await loadCache());
    const hostname = req.hostname;
    const path = req.path;

    // Exact matches take priority
    for (const rule of rules.exact) {
      const pathMatches = rule.sourcePath === path;
      const hostMatches = !rule.sourceHost || rule.sourceHost === hostname;
      if (pathMatches && hostMatches) {
        db.execute(
          sql`UPDATE url_redirects SET hit_count = hit_count + 1, last_hit_at = NOW() WHERE id = ${rule.id}`
        ).catch(() => {});
        return res.redirect(rule.statusCode, rule.targetPath);
      }
    }

    // Prefix matches (longest prefix wins)
    let bestPrefix: RedirectRule | null = null;
    for (const rule of rules.prefix) {
      const hostMatches = !rule.sourceHost || rule.sourceHost === hostname;
      if (!hostMatches) continue;
      const prefix = rule.sourcePath.endsWith("/") ? rule.sourcePath : rule.sourcePath + "/";
      const pathMatches = path === rule.sourcePath || path.startsWith(prefix);
      if (pathMatches) {
        if (!bestPrefix || rule.sourcePath.length > bestPrefix.sourcePath.length) {
          bestPrefix = rule;
        }
      }
    }
    if (bestPrefix) {
      db.execute(
        sql`UPDATE url_redirects SET hit_count = hit_count + 1, last_hit_at = NOW() WHERE id = ${bestPrefix.id}`
      ).catch(() => {});
      return res.redirect(bestPrefix.statusCode, bestPrefix.targetPath);
    }
  } catch {
    // Non-fatal
  }
  return next();
}

export function registerRedirectRoutes(app: Express) {
  app.get("/api/admin/redirects", adminAuthMiddleware, async (_req, res) => {
    try {
      const rows = await db
        .select()
        .from(urlRedirects)
        .orderBy(urlRedirects.createdAt);
      res.json(rows);
    } catch {
      res.status(500).json({ message: "Failed to fetch redirects" });
    }
  });

  app.post("/api/admin/redirects", adminAuthMiddleware, async (req, res) => {
    try {
      const { insertUrlRedirectSchema } = await import("@shared/schema");
      const parsed = insertUrlRedirectSchema.safeParse(req.body);
      if (!parsed.success)
        return res.status(400).json({ message: "Invalid data", errors: parsed.error.flatten() });
      const [row] = await db.insert(urlRedirects).values(parsed.data).returning();
      invalidateRedirectCache();
      res.status(201).json(row);
    } catch {
      res.status(500).json({ message: "Failed to create redirect" });
    }
  });

  app.patch("/api/admin/redirects/:id", adminAuthMiddleware, async (req, res) => {
    try {
      const { id } = req.params;
      const allowed = ["sourcePath", "sourceHost", "targetPath", "statusCode", "matchType", "active", "notes"] as const;
      const updates: Record<string, any> = {};
      for (const key of allowed) {
        if (key in req.body) updates[key] = req.body[key];
      }
      if (Object.keys(updates).length === 0)
        return res.status(400).json({ message: "No valid fields to update" });
      const [row] = await db
        .update(urlRedirects)
        .set(updates)
        .where(eq(urlRedirects.id, id))
        .returning();
      if (!row) return res.status(404).json({ message: "Redirect not found" });
      invalidateRedirectCache();
      res.json(row);
    } catch {
      res.status(500).json({ message: "Failed to update redirect" });
    }
  });

  app.delete("/api/admin/redirects/:id", adminAuthMiddleware, async (req, res) => {
    try {
      const { id } = req.params;
      const [row] = await db
        .delete(urlRedirects)
        .where(eq(urlRedirects.id, id))
        .returning();
      if (!row) return res.status(404).json({ message: "Redirect not found" });
      invalidateRedirectCache();
      res.json({ message: "Deleted" });
    } catch {
      res.status(500).json({ message: "Failed to delete redirect" });
    }
  });
}
