/**
 * REST routes for the social publisher. Mounted from server/routes.ts.
 *
 * All /api/admin/social/* routes use isAuthenticated (admin-only).
 * /go/:slug is intentionally public.
 */
import type { Express, Request, Response } from "express";
import multer from "multer";
import crypto from "crypto";
import { z } from "zod";
import { db } from "../db";
import {
  socialAccounts,
  socialPosts,
  socialCsvImports,
  socialClicks,
  insertSocialAccountSchema,
  insertSocialPostSchema,
  type SocialAccount,
} from "@shared/schema";
import { and, desc, eq, sql } from "drizzle-orm";
import {
  validateFacebookPageToken,
  validateInstagramAccount,
  publishFacebookPagePost,
  publishInstagramPost,
} from "./meta-client";
import { parseSocialCsv, isHostPublic, validateImageUrl } from "./csv-import";
import { encryptToken } from "./token-crypto";

function trackedBaseUrl(): string {
  const explicit = process.env.PUBLIC_BASE_URL?.replace(/\/+$/, "");
  if (explicit) return explicit;
  if (process.env.REPLIT_DEV_DOMAIN) return `https://${process.env.REPLIT_DEV_DOMAIN}`;
  return "";
}

function renderCaption(caption: string, trackedUrl: string): string {
  if (!caption) return caption;
  if (caption.includes("{{link}}")) return caption.split("{{link}}").join(trackedUrl);
  return caption;
}

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

const BASE62 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
function generateSlug(len = 8): string {
  const buf = crypto.randomBytes(len);
  let out = "";
  for (let i = 0; i < len; i++) out += BASE62[buf[i] % 62];
  return out;
}

async function uniqueSlug(): Promise<string> {
  for (let i = 0; i < 8; i++) {
    const candidate = generateSlug(8);
    const [exists] = await db
      .select({ id: socialPosts.id })
      .from(socialPosts)
      .where(eq(socialPosts.trackedSlug, candidate));
    if (!exists) return candidate;
  }
  // fall back to longer slug
  return generateSlug(12);
}

function publicAccount(a: SocialAccount) {
  // Never return the token. Only safe display fields.
  return {
    id: a.id,
    platform: a.platform,
    displayName: a.displayName,
    externalId: a.externalId,
    pageId: a.pageId,
    tokenLastFour: a.tokenLastFour,
    tokenExpiresAt: a.tokenExpiresAt,
    tokenConfigured: !!a.accessTokenEncrypted || !!(a.tokenSecretKey && process.env[a.tokenSecretKey]),
    isActive: a.isActive,
    createdAt: a.createdAt,
  };
}

export function registerSocialRoutes(
  app: Express,
  isAuthenticated: (req: any, res: any, next: any) => any,
  getCurrentAdminUser: (req: any) => Promise<any>
) {
  /* ---------------- Public click tracker ---------------- */
  app.get("/go/:slug", async (req: Request, res: Response) => {
    try {
      const { slug } = req.params;
      const [post] = await db
        .select()
        .from(socialPosts)
        .where(eq(socialPosts.trackedSlug, slug));
      if (!post || !post.linkUrl) {
        return res.status(404).send("Link not found");
      }
      // Increment click counter (fire-and-forget; best-effort).
      // Bot/crawler clicks are excluded from analytics counts (Task #7).
      const ua = (req.headers["user-agent"] as string) || "";
      const looksBot = /bot|crawl|spider|preview|slurp|monitor|fetch|curl|wget|http|axios|postman|node-fetch/i.test(ua);
      if (!looksBot) {
        try {
          await db
            .update(socialPosts)
            .set({ clickCount: sql`${socialPosts.clickCount} + 1` })
            .where(eq(socialPosts.id, post.id));
          const ipHash = crypto
            .createHash("sha256")
            .update(String(req.ip || "") + (process.env.SESSION_SECRET || ""))
            .digest("hex")
            .slice(0, 16);
          await db.insert(socialClicks).values({
            postId: post.id,
            userAgent: ua || null,
            referer: (req.headers.referer as string) || null,
            ipHash,
          });
        } catch (e) {
          console.warn("[social] click tracking failed", e);
        }
      }

      // Append UTM params (re-check host is public to defend against
      // any historical post that smuggled a private/loopback URL).
      const target = new URL(post.linkUrl);
      if (target.protocol !== "https:" && target.protocol !== "http:") {
        return res.status(400).send("Invalid link protocol");
      }
      if (!(await isHostPublic(target.hostname))) {
        return res.status(400).send("Link target is not a public host");
      }
      target.searchParams.set("utm_source", post.platform);
      target.searchParams.set("utm_medium", "social");
      if (post.utmCampaign) target.searchParams.set("utm_campaign", post.utmCampaign);
      target.searchParams.set("utm_content", post.id);
      return res.redirect(302, target.toString());
    } catch (e: any) {
      console.error("[social] /go/:slug error", e);
      return res.status(500).send("Redirect error");
    }
  });

  /* ---------------- Accounts ---------------- */
  app.get("/api/admin/social/accounts", isAuthenticated, async (_req, res) => {
    const accounts = await db
      .select()
      .from(socialAccounts)
      .orderBy(socialAccounts.createdAt);
    res.json(accounts.map(publicAccount));
  });

  const connectSchema = z.object({
    platform: z.enum(["instagram", "facebook"]),
    // Optional — discovered from Meta during validation if omitted
    displayName: z.string().min(1).optional(),
    pageId: z.string().min(1).optional(),
    igUserId: z.string().min(1).optional(),
    accessToken: z.string().min(20),
  });

  app.post(
    "/api/admin/social/accounts/validate",
    isAuthenticated,
    async (req, res) => {
      try {
        const body = connectSchema.parse(req.body);
        if (body.platform === "facebook") {
          if (!body.pageId)
            return res.status(400).json({ error: "pageId is required" });
          const r = await validateFacebookPageToken(body.pageId, body.accessToken);
          return res.json(r);
        } else {
          if (!body.igUserId)
            return res.status(400).json({ error: "igUserId is required" });
          const r = await validateInstagramAccount(body.igUserId, body.accessToken);
          return res.json(r);
        }
      } catch (e: any) {
        return res.status(400).json({ error: e.message });
      }
    }
  );

  app.post("/api/admin/social/accounts", isAuthenticated, async (req, res) => {
    try {
      const body = connectSchema.parse(req.body);
      const externalId = body.platform === "facebook" ? body.pageId! : body.igUserId!;
      // Validate token by hitting Meta first
      const v =
        body.platform === "facebook"
          ? await validateFacebookPageToken(externalId, body.accessToken)
          : await validateInstagramAccount(externalId, body.accessToken);
      if (!v.ok) {
        return res
          .status(400)
          .json({ error: `Token validation failed: ${v.error || "unknown"}` });
      }

      // Encrypt the token with AES-256-GCM and store the ciphertext in the
      // database. Survives restarts; raw token never written to disk in plain.
      const accessTokenEncrypted = encryptToken(body.accessToken);
      const tokenLastFour = body.accessToken.slice(-4);

      const [created] = await db
        .insert(socialAccounts)
        .values({
          platform: body.platform,
          displayName: body.displayName || v.displayName || externalId,
          externalId: v.externalId || externalId,
          pageId: body.pageId || null,
          accessTokenEncrypted,
          tokenLastFour,
          tokenExpiresAt: v.expiresAt || null,
          isActive: true,
        })
        .returning();

      console.log(
        `[social] connected ${body.platform} account ${created.id} (${created.displayName}); token encrypted in DB`
      );

      return res.json(publicAccount(created));
    } catch (e: any) {
      console.error("[social] connect error", e);
      return res.status(400).json({ error: e.message });
    }
  });

  app.patch("/api/admin/social/accounts/:id", isAuthenticated, async (req, res) => {
    try {
      const id = req.params.id;
      const updates: any = {};
      if (typeof req.body.isActive === "boolean") updates.isActive = req.body.isActive;
      if (typeof req.body.displayName === "string")
        updates.displayName = req.body.displayName;
      updates.updatedAt = new Date();
      const [u] = await db
        .update(socialAccounts)
        .set(updates)
        .where(eq(socialAccounts.id, id))
        .returning();
      if (!u) return res.status(404).json({ error: "Not found" });
      res.json(publicAccount(u));
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.delete("/api/admin/social/accounts/:id", isAuthenticated, async (req, res) => {
    try {
      const id = req.params.id;
      const [acc] = await db.select().from(socialAccounts).where(eq(socialAccounts.id, id));
      if (!acc) return res.status(404).json({ error: "Not found" });
      // Don't delete if posts reference it; deactivate instead
      const [{ c }] = await db
        .select({ c: sql<number>`count(*)::int` })
        .from(socialPosts)
        .where(eq(socialPosts.accountId, id));
      if ((c as any) > 0) {
        await db
          .update(socialAccounts)
          .set({ isActive: false, updatedAt: new Date() })
          .where(eq(socialAccounts.id, id));
        return res.json({ deactivated: true });
      }
      await db.delete(socialAccounts).where(eq(socialAccounts.id, id));
      // Clear any legacy in-memory token (DB ciphertext goes with the row)
      if (acc.tokenSecretKey) delete process.env[acc.tokenSecretKey];
      res.json({ deleted: true });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  /* ---------------- CSV import (dry-run + commit) ---------------- */

  app.post(
    "/api/admin/social/csv/dry-run",
    isAuthenticated,
    upload.single("file"),
    async (req, res) => {
      try {
        if (!req.file) return res.status(400).json({ error: "No file uploaded" });
        const accounts = await db.select().from(socialAccounts);
        const dry = await parseSocialCsv({
          csvContent: req.file.buffer.toString("utf8"),
          filename: req.file.originalname,
          accounts,
          validateImages: true,
        });
        // Enrich each row with a preview of the rendered caption + tracked URL
        // so admins see exactly what will be published.
        const base = trackedBaseUrl();
        const enriched = {
          ...dry,
          baseUrl: base,
          rows: dry.rows.map((r) => {
            const previewSlug = "PREVIEW";
            const trackedUrl = r.link && base ? `${base}/go/${previewSlug}` : r.link || "";
            return {
              ...r,
              previewTrackedUrl: trackedUrl,
              previewCaption: renderCaption(r.caption, trackedUrl),
            };
          }),
        };
        res.json(enriched);
      } catch (e: any) {
        console.error("[social] dry-run error", e);
        res.status(400).json({ error: e.message });
      }
    }
  );

  app.post(
    "/api/admin/social/csv/commit",
    isAuthenticated,
    upload.single("file"),
    async (req, res) => {
      try {
        if (!req.file) return res.status(400).json({ error: "No file uploaded" });
        const adminUser = await getCurrentAdminUser(req);
        const campaignName = (req.body.campaignName as string) || null;
        const accounts = await db.select().from(socialAccounts);
        const dry = await parseSocialCsv({
          csvContent: req.file.buffer.toString("utf8"),
          filename: req.file.originalname,
          accounts,
          validateImages: true,
        });
        if (dry.invalidRows > 0) {
          // Hard-stop on commit if any row failed validation. Admin must fix
          // the CSV; we never queue a row that didn't pass image+URL checks.
          return res.status(400).json({
            error: `Refusing to commit: ${dry.invalidRows} row(s) failed validation`,
            details: dry.rows.filter((r) => r.errors.length).map((r) => ({
              row: r.rowIndex,
              errors: r.errors,
            })),
          });
        }

        // Pre-allocate tracked slugs OUTSIDE the transaction (each call hits
        // its own auto-commit) so the actual insert is purely local writes
        // and can be wrapped in a single atomic transaction.
        const validRows = dry.rows.filter((r) => !r.errors.length);
        const slugs: string[] = [];
        for (let i = 0; i < validRows.length; i++) slugs.push(await uniqueSlug());

        const result = await db.transaction(async (tx) => {
          const [imp] = await tx
            .insert(socialCsvImports)
            .values({
              filename: dry.filename,
              campaignName,
              rowCount: dry.totalRows,
              successCount: 0,
              failedCount: 0,
              status: "queued",
              createdBy: adminUser?.id || null,
            })
            .returning();

          let inserted = 0;
          for (let i = 0; i < validRows.length; i++) {
            const row = validRows[i];
            await tx.insert(socialPosts).values({
              accountId: row.accountId,
              platform: row.platform,
              caption: row.caption,
              mediaUrls: row.mediaUrls,
              linkUrl: row.link || null,
              trackedSlug: slugs[i],
              utmCampaign: row.utmCampaign || campaignName || null,
              firstComment: row.firstComment || null,
              scheduledAt: row.scheduledAt,
              status: "scheduled",
              csvImportId: imp.id,
            });
            inserted++;
          }
          await tx
            .update(socialCsvImports)
            .set({
              successCount: inserted,
              failedCount: dry.invalidRows,
              status: dry.invalidRows ? "partial" : "done",
            })
            .where(eq(socialCsvImports.id, imp.id));

          return { importId: imp.id, inserted };
        });

        res.json({
          importId: result.importId,
          inserted: result.inserted,
          skipped: dry.invalidRows,
          totalRows: dry.totalRows,
        });
      } catch (e: any) {
        console.error("[social] commit error", e);
        res.status(400).json({ error: e.message });
      }
    }
  );

  /* ---------------- Posts ---------------- */

  app.get("/api/admin/social/posts", isAuthenticated, async (req, res) => {
    const { status, accountId } = req.query as Record<string, string>;
    const conds: any[] = [];
    if (status) conds.push(eq(socialPosts.status, status));
    if (accountId) conds.push(eq(socialPosts.accountId, accountId));
    const where = conds.length ? and(...conds) : undefined;
    const rows = await db
      .select()
      .from(socialPosts)
      .where(where as any)
      .orderBy(desc(socialPosts.scheduledAt))
      .limit(500);
    res.json(rows);
  });

  app.get("/api/admin/social/imports", isAuthenticated, async (_req, res) => {
    const rows = await db
      .select()
      .from(socialCsvImports)
      .orderBy(desc(socialCsvImports.createdAt))
      .limit(50);
    res.json(rows);
  });

  // Ad-hoc one-off post (uses the same scheduling pipeline)
  const adhocSchema = insertSocialPostSchema.extend({
    scheduledAt: z.coerce.date().optional(),
  });
  app.post("/api/admin/social/posts", isAuthenticated, async (req, res) => {
    try {
      const body = adhocSchema.parse(req.body);
      // Apply the same validation rules as the CSV pipeline.
      const urls = body.mediaUrls || [];
      if (!urls.length) return res.status(400).json({ error: "At least one image URL is required" });
      if (body.platform === "instagram" && urls.length > 10)
        return res.status(400).json({ error: "Instagram allows max 10 carousel images" });
      const imageErrors: string[] = [];
      for (const u of urls) {
        const ok = await validateImageUrl(u);
        if (!ok) imageErrors.push(u);
      }
      if (imageErrors.length) {
        return res.status(400).json({
          error: `Image URL(s) failed validation (must be HTTPS + public host + reachable): ${imageErrors.join(", ")}`,
        });
      }
      if (body.linkUrl) {
        try {
          const parsed = new URL(body.linkUrl);
          if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
            return res.status(400).json({ error: "Link must be http(s)" });
          }
          if (!(await isHostPublic(parsed.hostname))) {
            return res.status(400).json({ error: "Link target must be a public host" });
          }
        } catch {
          return res.status(400).json({ error: "Invalid link URL" });
        }
      }
      const slug = await uniqueSlug();
      const [created] = await db
        .insert(socialPosts)
        .values({
          ...body,
          trackedSlug: slug,
          scheduledAt: body.scheduledAt || new Date(),
          status: "scheduled",
        })
        .returning();
      res.json(created);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.post("/api/admin/social/posts/:id/retry", isAuthenticated, async (req, res) => {
    try {
      const id = req.params.id;
      const [u] = await db
        .update(socialPosts)
        .set({
          status: "scheduled",
          nextRetryAt: null,
          errorMessage: null,
          updatedAt: new Date(),
        })
        .where(eq(socialPosts.id, id))
        .returning();
      if (!u) return res.status(404).json({ error: "Not found" });
      res.json(u);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.delete("/api/admin/social/posts/:id", isAuthenticated, async (req, res) => {
    try {
      const id = req.params.id;
      // Only allow delete for non-posted statuses
      const [p] = await db.select().from(socialPosts).where(eq(socialPosts.id, id));
      if (!p) return res.status(404).json({ error: "Not found" });
      if (p.status === "posted") {
        return res
          .status(400)
          .json({ error: "Cannot delete a post that has already been published" });
      }
      await db.delete(socialPosts).where(eq(socialPosts.id, id));
      res.json({ deleted: true });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  // Remaining IG daily quota per account
  app.get("/api/admin/social/quota", isAuthenticated, async (_req, res) => {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const igAccounts = await db
      .select()
      .from(socialAccounts)
      .where(eq(socialAccounts.platform, "instagram"));
    const out: Record<string, { used: number; cap: number; remaining: number }> = {};
    for (const a of igAccounts) {
      const [{ c }] = await db
        .select({ c: sql<number>`count(*)::int` })
        .from(socialPosts)
        .where(
          and(
            eq(socialPosts.accountId, a.id),
            eq(socialPosts.status, "posted"),
            sql`${socialPosts.postedAt} >= ${since}`
          )
        );
      const used = Number(c) || 0;
      out[a.id] = { used, cap: 25, remaining: Math.max(0, 25 - used) };
    }
    res.json(out);
  });

  // Per-post click summary
  app.get("/api/admin/social/posts/:id/clicks", isAuthenticated, async (req, res) => {
    const id = req.params.id;
    const [{ c }] = await db
      .select({ c: sql<number>`count(*)::int` })
      .from(socialClicks)
      .where(eq(socialClicks.postId, id));
    res.json({ count: c });
  });
}
