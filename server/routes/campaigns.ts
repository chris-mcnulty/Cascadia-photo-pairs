import type { Express, Request, RequestHandler } from "express";
import crypto from "crypto";
import { z } from "zod";
import { contactStorage } from "../contact-storage";
import {
  insertContactSchema,
  insertContactListSchema,
  insertEmailCampaignSchema,
} from "@shared/schema";
import {
  backfillContacts,
  sendCampaignWithFailureGuard,
  sendCampaignTest,
  queueCampaignRecipients,
  ingestSendGridEvents,
  errMsg,
} from "../campaign-service";
import { storage } from "../storage";

export function registerCampaignRoutes(app: Express, isAuthenticated: RequestHandler) {
  // ---------------- Public unsubscribe ----------------
  app.get("/api/unsubscribe/:token", async (req, res) => {
    try {
      const token = req.params.token;
      if (!token || token.length < 8) {
        return res.status(404).json({ message: "Invalid token" });
      }
      const contact = await contactStorage.getByToken(token);
      if (!contact) return res.status(404).json({ message: "Token not found" });
      return res.json({
        email: contact.email,
        alreadyUnsubscribed: !contact.marketingOptIn || !!contact.unsubscribedAt,
      });
    } catch (err) {
      console.error("[unsubscribe GET] error", errMsg(err));
      res.status(500).json({ message: "Server error" });
    }
  });

  app.post("/api/unsubscribe/:token", async (req, res) => {
    try {
      const contact = await contactStorage.unsubscribeByToken(req.params.token);
      if (!contact) return res.status(404).json({ message: "Token not found" });
      console.log(`[Campaigns] Contact ${contact.id} unsubscribed`);
      res.json({ success: true, email: contact.email });
    } catch (err) {
      console.error("[unsubscribe POST] error", errMsg(err));
      res.status(500).json({ message: "Server error" });
    }
  });

  // ---------------- Admin: contacts ----------------
  app.get("/api/admin/contacts", isAuthenticated, async (req, res) => {
    try {
      const optInRaw = (req.query.optIn as string) || "all";
      const optIn: "all" | "in" | "out" =
        optInRaw === "in" || optInRaw === "out" ? optInRaw : "all";
      const tag = (req.query.tag as string) || undefined;
      const rows = await contactStorage.list({
        search: (req.query.search as string) || undefined,
        source: (req.query.source as string) || undefined,
        optIn,
        listId: (req.query.listId as string) || undefined,
        tag,
      });
      res.json(rows.map(({ unsubscribeToken, ...rest }) => rest));
    } catch (err) {
      console.error("[admin contacts list] error", errMsg(err));
      res.status(500).json({ message: "Server error" });
    }
  });

  app.get("/api/admin/contacts/tags", isAuthenticated, async (_req, res) => {
    try {
      res.json(await contactStorage.listTags());
    } catch (err) {
      console.error("[admin contacts tags] error", errMsg(err));
      res.status(500).json({ message: "Server error" });
    }
  });

  app.post("/api/admin/contacts", isAuthenticated, async (req, res) => {
    try {
      const data = insertContactSchema.parse(req.body);
      const existing = await contactStorage.getByEmail(data.email);
      if (existing) return res.status(409).json({ message: "Contact with that email already exists" });
      const contact = await contactStorage.create(data);
      const { unsubscribeToken, ...safe } = contact;
      res.json(safe);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: "Invalid data", errors: err.errors });
      console.error("[admin contacts create] error", errMsg(err));
      res.status(500).json({ message: "Server error" });
    }
  });

  app.patch("/api/admin/contacts/:id", isAuthenticated, async (req, res) => {
    try {
      const data = insertContactSchema.partial().parse(req.body);
      const contact = await contactStorage.update(req.params.id, data);
      if (!contact) return res.status(404).json({ message: "Not found" });
      const { unsubscribeToken, ...safe } = contact;
      res.json(safe);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: "Invalid data", errors: err.errors });
      console.error("[admin contacts patch] error", errMsg(err));
      res.status(500).json({ message: "Server error" });
    }
  });

  app.post("/api/admin/contacts/:id/opt-in", isAuthenticated, async (req, res) => {
    try {
      const optIn = !!req.body?.optIn;
      const contact = await contactStorage.setOptIn(req.params.id, optIn);
      if (!contact) return res.status(404).json({ message: "Not found" });
      const { unsubscribeToken, ...safe } = contact;
      res.json(safe);
    } catch (err) {
      console.error("[admin contacts opt-in] error", errMsg(err));
      res.status(500).json({ message: "Server error" });
    }
  });

  app.post("/api/admin/contacts/bulk-opt-in", isAuthenticated, async (req, res) => {
    try {
      const schema = z.object({
        contactIds: z.array(z.string()).min(1).max(5000),
        optIn: z.boolean(),
      });
      const data = schema.parse(req.body);
      const updated = await contactStorage.bulkSetOptIn(data.contactIds, data.optIn);
      res.json({ updated });
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: "Invalid data", errors: err.errors });
      console.error("[admin contacts bulk-opt-in] error", errMsg(err));
      res.status(500).json({ message: "Server error" });
    }
  });

  app.get("/api/admin/contacts/:id/campaigns", isAuthenticated, async (req, res) => {
    try {
      res.json(await contactStorage.getCampaignsForContact(req.params.id));
    } catch (err) {
      console.error("[admin contact campaigns] error", errMsg(err));
      res.status(500).json({ message: "Server error" });
    }
  });

  app.delete("/api/admin/contacts/:id", isAuthenticated, async (req, res) => {
    try {
      const ok = await contactStorage.delete(req.params.id);
      if (!ok) return res.status(404).json({ message: "Not found" });
      res.json({ success: true });
    } catch (err) {
      console.error("[admin contacts delete] error", errMsg(err));
      res.status(500).json({ message: "Server error" });
    }
  });

  app.post("/api/admin/contacts/import", isAuthenticated, async (req, res) => {
    try {
      const schema = z.object({
        rows: z
          .array(
            z.object({
              email: z.string(),
              firstName: z.string().optional(),
              lastName: z.string().optional(),
              tags: z.array(z.string()).optional(),
              marketingOptIn: z.boolean().optional(),
            }),
          )
          .max(5000),
      });
      const data = schema.parse(req.body);
      const result = await contactStorage.importCsv(data.rows);
      res.json(result);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: "Invalid data", errors: err.errors });
      console.error("[admin contacts import] error", errMsg(err));
      res.status(500).json({ message: "Server error" });
    }
  });

  app.post("/api/admin/contacts/backfill", isAuthenticated, async (_req, res) => {
    try {
      res.json(await backfillContacts());
    } catch (err) {
      console.error("[admin contacts backfill] error", errMsg(err));
      res.status(500).json({ message: "Server error" });
    }
  });

  // ---------------- Admin: lists ----------------
  app.get("/api/admin/contact-lists", isAuthenticated, async (_req, res) => {
    try {
      res.json(await contactStorage.listLists());
    } catch (err) {
      console.error("[admin lists] error", errMsg(err));
      res.status(500).json({ message: "Server error" });
    }
  });

  app.post("/api/admin/contact-lists", isAuthenticated, async (req, res) => {
    try {
      const data = insertContactListSchema.parse(req.body);
      res.json(await contactStorage.createList(data));
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: "Invalid data", errors: err.errors });
      console.error("[admin lists create] error", errMsg(err));
      res.status(500).json({ message: "Server error" });
    }
  });

  app.patch("/api/admin/contact-lists/:id", isAuthenticated, async (req, res) => {
    try {
      const data = insertContactListSchema.partial().parse(req.body);
      const row = await contactStorage.updateList(req.params.id, data);
      if (!row) return res.status(404).json({ message: "Not found" });
      res.json(row);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: "Invalid data", errors: err.errors });
      console.error("[admin lists patch] error", errMsg(err));
      res.status(500).json({ message: "Server error" });
    }
  });

  app.delete("/api/admin/contact-lists/:id", isAuthenticated, async (req, res) => {
    try {
      const ok = await contactStorage.deleteList(req.params.id);
      if (!ok) return res.status(404).json({ message: "Not found" });
      res.json({ success: true });
    } catch (err) {
      console.error("[admin lists delete] error", errMsg(err));
      res.status(500).json({ message: "Server error" });
    }
  });

  app.get("/api/admin/contact-lists/:id/campaigns", isAuthenticated, async (req, res) => {
    try {
      res.json(await contactStorage.getCampaignsForList(req.params.id));
    } catch (err) {
      console.error("[admin list campaigns] error", errMsg(err));
      res.status(500).json({ message: "Server error" });
    }
  });

  app.post("/api/admin/contact-lists/:id/members", isAuthenticated, async (req, res) => {
    try {
      const schema = z.object({ contactIds: z.array(z.string()).min(1) });
      const data = schema.parse(req.body);
      const added = await contactStorage.addMembers(req.params.id, data.contactIds);
      res.json({ added });
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: "Invalid data", errors: err.errors });
      console.error("[admin lists add members] error", errMsg(err));
      res.status(500).json({ message: "Server error" });
    }
  });

  app.delete("/api/admin/contact-lists/:id/members", isAuthenticated, async (req, res) => {
    try {
      const schema = z.object({ contactIds: z.array(z.string()).min(1) });
      const data = schema.parse(req.body);
      const removed = await contactStorage.removeMembers(req.params.id, data.contactIds);
      res.json({ removed });
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: "Invalid data", errors: err.errors });
      console.error("[admin lists remove members] error", errMsg(err));
      res.status(500).json({ message: "Server error" });
    }
  });

  // ---------------- Admin: campaigns ----------------
  app.get("/api/admin/campaigns", isAuthenticated, async (_req, res) => {
    try {
      res.json(await contactStorage.listCampaigns());
    } catch (err) {
      console.error("[admin campaigns list] error", errMsg(err));
      res.status(500).json({ message: "Server error" });
    }
  });

  app.get("/api/admin/campaigns/:id", isAuthenticated, async (req, res) => {
    try {
      const c = await contactStorage.getCampaign(req.params.id);
      if (!c) return res.status(404).json({ message: "Not found" });
      res.json(c);
    } catch (err) {
      console.error("[admin campaigns get] error", errMsg(err));
      res.status(500).json({ message: "Server error" });
    }
  });

  app.get("/api/admin/campaigns/:id/recipients", isAuthenticated, async (req, res) => {
    try {
      res.json(await contactStorage.getCampaignRecipients(req.params.id));
    } catch (err) {
      console.error("[admin campaigns recipients] error", errMsg(err));
      res.status(500).json({ message: "Server error" });
    }
  });

  app.get("/api/admin/campaigns/:id/events", isAuthenticated, async (req, res) => {
    try {
      const eventType = (req.query.type as string) || undefined;
      res.json(await contactStorage.getCampaignEvents(req.params.id, eventType));
    } catch (err) {
      console.error("[admin campaigns events] error", errMsg(err));
      res.status(500).json({ message: "Server error" });
    }
  });

  app.get("/api/admin/campaign-recipients/:id/events", isAuthenticated, async (req, res) => {
    try {
      res.json(await contactStorage.getRecipientEvents(req.params.id));
    } catch (err) {
      console.error("[admin recipient events] error", errMsg(err));
      res.status(500).json({ message: "Server error" });
    }
  });

  // ---------------- SendGrid event webhook ----------------
  // Ingests open/click/bounce/etc events. Idempotent via sg_event_id.
  // Public endpoint (called by SendGrid) but protected by SendGrid's signed
  // Event Webhook ECDSA P-256 signature. Requires SENDGRID_WEBHOOK_PUBLIC_KEY
  // env var (the base64 public key shown in SendGrid's Mail Settings UI).
  app.post("/api/webhooks/sendgrid/events", async (req, res) => {
    try {
      const publicKey = process.env.SENDGRID_WEBHOOK_PUBLIC_KEY;
      if (!publicKey) {
        console.error(
          "[sendgrid webhook] SENDGRID_WEBHOOK_PUBLIC_KEY not set - rejecting request"
        );
        return res.status(401).json({ message: "Webhook signing key not configured" });
      }
      const signature = String(
        req.header("X-Twilio-Email-Event-Webhook-Signature") || ""
      );
      const timestamp = String(
        req.header("X-Twilio-Email-Event-Webhook-Timestamp") || ""
      );
      const rawBody = (req as Request & { rawBody?: Buffer }).rawBody;
      if (!signature || !timestamp || !rawBody) {
        return res.status(401).json({ message: "Missing signature headers" });
      }
      // Reject events older than 10 minutes to limit replay attacks.
      const tsSec = Number(timestamp);
      if (!Number.isFinite(tsSec) || Math.abs(Date.now() / 1000 - tsSec) > 600) {
        return res.status(401).json({ message: "Stale or invalid timestamp" });
      }
      let pubKey: crypto.KeyObject;
      try {
        pubKey = crypto.createPublicKey({
          key: Buffer.from(publicKey, "base64"),
          format: "der",
          type: "spki",
        });
      } catch (err) {
        console.error(
          "[sendgrid webhook] invalid SENDGRID_WEBHOOK_PUBLIC_KEY:",
          errMsg(err)
        );
        return res.status(500).json({ message: "Invalid webhook key" });
      }
      const verifier = crypto.createVerify("sha256");
      verifier.update(timestamp);
      verifier.update(rawBody);
      verifier.end();
      let valid = false;
      try {
        valid = verifier.verify(
          { key: pubKey, dsaEncoding: "der" },
          Buffer.from(signature, "base64")
        );
      } catch {
        valid = false;
      }
      if (!valid) {
        return res.status(401).json({ message: "Invalid signature" });
      }
      const events = Array.isArray(req.body) ? req.body : [];
      const result = await ingestSendGridEvents(events);
      res.json(result);
    } catch (err) {
      console.error("[sendgrid webhook] error", errMsg(err));
      // Return 200 so SendGrid doesn't retry on a transient store error and
      // potentially flood logs - errors are logged above for investigation.
      res.status(200).json({ inserted: 0, error: "ingest failed" });
    }
  });

  app.post("/api/admin/campaigns", isAuthenticated, async (req, res) => {
    try {
      const settings = await storage.getSettings();
      const body = {
        ...req.body,
        fromName: req.body?.fromName || settings.campaignFromName || "Cascadia Oceanic",
        fromEmail: req.body?.fromEmail || settings.campaignFromEmail || "cascadia@chrismcnulty.net",
        replyTo: req.body?.replyTo || settings.campaignReplyTo || settings.campaignFromEmail || "cascadia@chrismcnulty.net",
      };
      const data = insertEmailCampaignSchema.parse(body);
      res.json(await contactStorage.createCampaign(data));
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: "Invalid data", errors: err.errors });
      console.error("[admin campaigns create] error", errMsg(err));
      res.status(500).json({ message: "Server error" });
    }
  });

  app.post("/api/admin/campaigns/preview", isAuthenticated, async (req, res) => {
    try {
      const schema = z.object({
        bodyHtml: z.string().max(200_000),
        recipientEmail: z.string().email().optional(),
      });
      const data = schema.parse(req.body);
      const { renderBrandedEmail } = await import("../email-template");
      const { applyMergeTokens } = await import("../campaign-service");
      const previewEmail = data.recipientEmail || "preview@example.com";
      const unsubscribeUrl = `${process.env.BASE_URL || "https://voting.chrismcnulty.net"}/unsubscribe?t=preview`;
      const merged = applyMergeTokens(data.bodyHtml, {
        firstName: "Preview",
        lastName: "Reader",
        email: previewEmail,
        unsubscribeUrl,
      });
      const html = await renderBrandedEmail({
        bodyHtml: merged,
        unsubscribeUrl,
        recipientEmail: previewEmail,
      });
      res.type("text/html").send(html);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: "Invalid data", errors: err.errors });
      console.error("[admin campaigns preview] error", errMsg(err));
      res.status(500).json({ message: "Server error" });
    }
  });

  app.patch("/api/admin/campaigns/:id", isAuthenticated, async (req, res) => {
    try {
      const data = insertEmailCampaignSchema.partial().parse(req.body);
      const row = await contactStorage.updateCampaign(req.params.id, data);
      if (!row) return res.status(404).json({ message: "Not found" });
      res.json(row);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: "Invalid data", errors: err.errors });
      console.error("[admin campaigns patch] error", errMsg(err));
      res.status(500).json({ message: "Server error" });
    }
  });

  app.delete("/api/admin/campaigns/:id", isAuthenticated, async (req, res) => {
    try {
      const ok = await contactStorage.deleteCampaign(req.params.id);
      if (!ok) return res.status(404).json({ message: "Not found" });
      res.json({ success: true });
    } catch (err) {
      console.error("[admin campaigns delete] error", errMsg(err));
      res.status(500).json({ message: "Server error" });
    }
  });

  app.post("/api/admin/campaigns/:id/test", isAuthenticated, async (req, res) => {
    try {
      const schema = z.object({ to: z.string().email() });
      const data = schema.parse(req.body);
      const result = await sendCampaignTest(req.params.id, data.to);
      res.json(result);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: "Invalid data", errors: err.errors });
      console.error("[admin campaigns test] error", errMsg(err));
      res.status(500).json({ message: "Server error" });
    }
  });

  app.post("/api/admin/campaigns/:id/queue", isAuthenticated, async (req, res) => {
    try {
      const queued = await queueCampaignRecipients(req.params.id);
      res.json({ queued });
    } catch (err) {
      console.error("[admin campaigns queue] error", errMsg(err));
      res.status(500).json({ message: errMsg(err) });
    }
  });

  app.post("/api/admin/campaigns/:id/send", isAuthenticated, async (req, res) => {
    try {
      const id = req.params.id;
      // Validate before responding so the admin gets immediate feedback
      // when a campaign is unsendable instead of a phantom "queued" status.
      const campaign = await contactStorage.getCampaign(id);
      if (!campaign) return res.status(404).json({ message: "Campaign not found" });
      if (!campaign.listId) return res.status(400).json({ message: "Campaign has no target list" });
      if (campaign.status === "sending" || campaign.status === "sent") {
        return res.status(409).json({ message: `Campaign already ${campaign.status}` });
      }
      const queued = await queueCampaignRecipients(id);
      if (queued === 0) {
        const existing = await contactStorage.getCampaignRecipients(id);
        if (existing.length === 0) {
          return res.status(400).json({ message: "Target list has no opted-in members" });
        }
      }
      await contactStorage.markCampaignQueued(id);
      res.json({ success: true, status: "queued", queued });
      // Background send is guarded so any throw flips status to 'failed'.
      void sendCampaignWithFailureGuard(id);
    } catch (err) {
      console.error("[admin campaigns send] error", errMsg(err));
      res.status(500).json({ message: errMsg(err) });
    }
  });
}
