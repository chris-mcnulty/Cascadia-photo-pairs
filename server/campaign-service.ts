import crypto from "crypto";
import { db } from "./db";
import { eq, and, sql, inArray, isNull } from "drizzle-orm";
import {
  contacts,
  contactLists,
  contactListMembers,
  emailCampaigns,
  emailCampaignRecipients,
  emailCampaignEvents,
  users,
  customers,
  settings as settingsTable,
} from "@shared/schema";
import { renderBrandedEmail } from "./email-template";
import sgMail from "@sendgrid/mail";

const SENDGRID_CONFIGURED = !!process.env.SENDGRID_API_KEY;
if (SENDGRID_CONFIGURED) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY!);
}

const BATCH_SIZE = 50;
const BATCH_DELAY_MS = 1100; // ~50 emails/sec

function rowCount(result: unknown): number {
  return (result as { rowCount?: number | null }).rowCount ?? 0;
}

export function errMsg(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  return "Unknown error";
}

// Replaces every email-looking substring with [redacted] so SendGrid error
// bodies never leak recipient addresses into logs.
function scrubPii(s: string): string {
  return s.replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, "[redacted]");
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function applyMergeTokens(
  html: string,
  ctx: {
    firstName?: string | null;
    lastName?: string | null;
    email: string;
    unsubscribeUrl: string;
  },
): string {
  return html.replace(/\{\{\s*([a-zA-Z]+)(?:\s*\|\s*([^}]*?))?\s*\}\}/g, (match, name: string, fallback?: string) => {
    const fb = fallback?.trim() ?? "";
    let value: string | undefined;
    switch (name) {
      case "firstName":
        value = ctx.firstName ?? undefined;
        break;
      case "lastName":
        value = ctx.lastName ?? undefined;
        break;
      case "email":
        value = ctx.email;
        break;
      case "unsubscribeUrl":
        // The unsubscribe URL goes inside an href, so escape but don't double-encode.
        return escapeHtml(ctx.unsubscribeUrl);
      default:
        return match;
    }
    return escapeHtml(value && value.trim() ? value : fb);
  });
}

export function generateUnsubscribeToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export function getUnsubscribeUrl(token: string): string {
  const baseUrl = process.env.BASE_URL || "https://voting.chrismcnulty.net";
  return `${baseUrl}/unsubscribe?t=${token}`;
}

// Idempotent backfill from users + customers. Users default opted in (signup
// presents the privacy notice); customers default opted out (no marketing
// consent step in the order pipeline).
export async function backfillContacts(): Promise<{ created: number; skipped: number }> {
  let created = 0;
  let skipped = 0;

  const allUsers = await db.select().from(users);
  for (const u of allUsers) {
    if (!u.email) continue;
    const lowered = u.email.trim().toLowerCase();
    const inserted = await db.execute(sql`
      INSERT INTO contacts (email, first_name, last_name, source, source_user_id, tags,
                            marketing_opt_in, unsubscribe_token)
      VALUES (${lowered}, ${u.firstName ?? null}, ${u.lastName ?? null}, 'user',
              ${u.id}, ARRAY[]::text[], true,
              ${generateUnsubscribeToken()})
      ON CONFLICT (email) DO NOTHING
      RETURNING id
    `);
    if (rowCount(inserted) > 0) created++;
    else skipped++;
  }

  const allCustomers = await db.select().from(customers);
  for (const c of allCustomers) {
    if (!c.email) continue;
    const lowered = c.email.trim().toLowerCase();
    const nameParts = (c.name || "").trim().split(/\s+/);
    const inserted = await db.execute(sql`
      INSERT INTO contacts (email, first_name, last_name, source, source_customer_id,
                            tags, marketing_opt_in, unsubscribe_token)
      VALUES (${lowered}, ${nameParts[0] || null},
              ${nameParts.slice(1).join(" ") || null},
              'customer', ${c.id}, ARRAY[]::text[], false,
              ${generateUnsubscribeToken()})
      ON CONFLICT (email) DO NOTHING
      RETURNING id
    `);
    if (rowCount(inserted) > 0) created++;
    else skipped++;
  }

  return { created, skipped };
}

interface SendCampaignOptions {
  campaignId: string;
}

// Queue per-recipient rows for a campaign. Idempotent via ON CONFLICT DO NOTHING.
export async function queueCampaignRecipients(campaignId: string): Promise<number> {
  const [campaign] = await db
    .select()
    .from(emailCampaigns)
    .where(eq(emailCampaigns.id, campaignId));
  if (!campaign) throw new Error("Campaign not found");
  if (!campaign.listId) throw new Error("Campaign has no target list");

  return await db.transaction(async (tx) => {
    const members = await tx
      .select({
        contactId: contacts.id,
        email: contacts.email,
        marketingOptIn: contacts.marketingOptIn,
        unsubscribedAt: contacts.unsubscribedAt,
      })
      .from(contactListMembers)
      .innerJoin(contacts, eq(contactListMembers.contactId, contacts.id))
      .where(eq(contactListMembers.listId, campaign.listId!));

    let queued = 0;
    for (const m of members) {
      const status = !m.marketingOptIn || !!m.unsubscribedAt ? "skipped" : "pending";
      const result = await tx.execute(sql`
        INSERT INTO email_campaign_recipients (campaign_id, contact_id, email, status)
        VALUES (${campaignId}, ${m.contactId}, ${m.email}, ${status})
        ON CONFLICT (campaign_id, contact_id) DO NOTHING
        RETURNING id
      `);
      if (rowCount(result) > 0) queued++;
    }

    const [{ count }] = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(emailCampaignRecipients)
      .where(eq(emailCampaignRecipients.campaignId, campaignId));

    await tx
      .update(emailCampaigns)
      .set({ totalRecipients: count, updatedAt: new Date() })
      .where(eq(emailCampaigns.id, campaignId));

    return queued;
  });
}

// Send a campaign. Atomically claims rows via SELECT … FOR UPDATE SKIP LOCKED
// so parallel senders cannot double-send. Re-checks opt-in per recipient.
// Updates aggregate counts after each batch so the admin UI reflects progress.
export async function sendCampaign(opts: SendCampaignOptions): Promise<{
  sent: number;
  failed: number;
  skipped: number;
}> {
  const { campaignId } = opts;
  const [campaign] = await db
    .select()
    .from(emailCampaigns)
    .where(eq(emailCampaigns.id, campaignId));
  if (!campaign) throw new Error("Campaign not found");

  await queueCampaignRecipients(campaignId);

  await db
    .update(emailCampaigns)
    .set({ status: "sending", updatedAt: new Date() })
    .where(eq(emailCampaigns.id, campaignId));

  let sent = 0;
  let failed = 0;
  let skipped = 0;

  async function refreshAggregateCounts() {
    const counts = await db
      .select({ status: emailCampaignRecipients.status, n: sql<number>`count(*)::int` })
      .from(emailCampaignRecipients)
      .where(eq(emailCampaignRecipients.campaignId, campaignId))
      .groupBy(emailCampaignRecipients.status);
    const sentTotal = counts.find((c) => c.status === "sent")?.n || 0;
    const failedTotal =
      (counts.find((c) => c.status === "failed")?.n || 0) +
      (counts.find((c) => c.status === "bounced")?.n || 0);
    const skippedTotal =
      (counts.find((c) => c.status === "skipped")?.n || 0) +
      (counts.find((c) => c.status === "unsubscribed")?.n || 0);
    await db
      .update(emailCampaigns)
      .set({
        sentCount: sentTotal,
        failedCount: failedTotal,
        unsubscribedCount: skippedTotal,
        updatedAt: new Date(),
      })
      .where(eq(emailCampaigns.id, campaignId));
  }

  while (true) {
    // Atomically claim up to BATCH_SIZE pending rows by flipping their status
    // to "claimed". SKIP LOCKED ensures parallel senders take disjoint sets.
    const claimedRes = await db.execute(sql`
      UPDATE email_campaign_recipients
         SET status = 'claimed'
       WHERE id IN (
         SELECT id FROM email_campaign_recipients
          WHERE campaign_id = ${campaignId}
            AND status = 'pending'
          ORDER BY created_at
          FOR UPDATE SKIP LOCKED
          LIMIT ${BATCH_SIZE}
       )
      RETURNING id, contact_id AS "contactId", email
    `);
    const pending = (
      claimedRes as unknown as {
        rows: Array<{ id: string; contactId: string; email: string }>;
      }
    ).rows;

    if (pending.length === 0) break;

    for (const r of pending) {
      // Re-check opt-in
      const [contact] = await db.select().from(contacts).where(eq(contacts.id, r.contactId));
      if (!contact) {
        await db
          .update(emailCampaignRecipients)
          .set({ status: "failed", errorMessage: "Contact not found" })
          .where(eq(emailCampaignRecipients.id, r.id));
        failed++;
        continue;
      }
      if (!contact.marketingOptIn || contact.unsubscribedAt) {
        await db
          .update(emailCampaignRecipients)
          .set({ status: "skipped", errorMessage: "Opted out" })
          .where(eq(emailCampaignRecipients.id, r.id));
        skipped++;
        continue;
      }

      const unsubscribeUrl = getUnsubscribeUrl(contact.unsubscribeToken);
      const mergedBody = applyMergeTokens(campaign.bodyHtml, {
        firstName: contact.firstName,
        lastName: contact.lastName,
        email: contact.email,
        unsubscribeUrl,
      });
      const html = await renderBrandedEmail({
        bodyHtml: mergedBody,
        unsubscribeUrl,
        recipientEmail: contact.email,
      });

      const result = await sendOneCampaignEmail({
        to: contact.email,
        from: campaign.fromEmail,
        fromName: campaign.fromName,
        replyTo: campaign.replyTo || undefined,
        subject: campaign.subject,
        html,
        trackOpens: campaign.trackOpens,
        trackClicks: campaign.trackClicks,
        campaignId: campaign.id,
        recipientId: r.id,
      });

      if (result.success) {
        await db
          .update(emailCampaignRecipients)
          .set({
            status: "sent",
            sendgridMessageId: result.messageId || null,
            sentAt: new Date(),
          })
          .where(eq(emailCampaignRecipients.id, r.id));
        await db
          .update(contacts)
          .set({ lastEmailedAt: new Date(), updatedAt: new Date() })
          .where(eq(contacts.id, contact.id));
        sent++;
      } else {
        await db
          .update(emailCampaignRecipients)
          .set({
            status: "failed",
            errorMessage: (result.error || "unknown").slice(0, 500),
          })
          .where(eq(emailCampaignRecipients.id, r.id));
        failed++;
      }
    }

    // Update live progress counters then throttle.
    await refreshAggregateCounts();
    await new Promise((res) => setTimeout(res, BATCH_DELAY_MS));
  }

  // Reconcile any rows stuck in 'claimed' (e.g. process killed mid-batch).
  await db.execute(sql`
    UPDATE email_campaign_recipients
       SET status = 'failed',
           error_message = COALESCE(error_message, 'Send interrupted')
     WHERE campaign_id = ${campaignId}
       AND status = 'claimed'
  `);

  await refreshAggregateCounts();
  await db
    .update(emailCampaigns)
    .set({ status: "sent", sentAt: new Date(), updatedAt: new Date() })
    .where(eq(emailCampaigns.id, campaignId));

  console.log(`[Campaigns] Campaign ${campaignId} finished`);
  return { sent, failed, skipped };
}

// Convenience wrapper used by routes: invokes sendCampaign and on uncaught
// failure marks the campaign 'failed' so it cannot be left stuck in 'sending'.
export async function sendCampaignWithFailureGuard(campaignId: string): Promise<void> {
  try {
    await sendCampaign({ campaignId });
  } catch (err) {
    console.error("[Campaigns] background send error:", scrubPii(errMsg(err)));
    try {
      await db
        .update(emailCampaigns)
        .set({ status: "failed", updatedAt: new Date() })
        .where(eq(emailCampaigns.id, campaignId));
    } catch (innerErr) {
      console.error("[Campaigns] failed to mark campaign failed:", errMsg(innerErr));
    }
  }
}

interface SendOneArgs {
  to: string;
  from: string;
  fromName: string;
  replyTo?: string;
  subject: string;
  html: string;
  trackOpens?: boolean;
  trackClicks?: boolean;
  campaignId?: string;
  recipientId?: string;
}

/**
 * Send a single campaign email via SendGrid. Separate code path from transactional.
 */
export async function sendOneCampaignEmail(args: SendOneArgs): Promise<{
  success: boolean;
  messageId?: string;
  error?: string;
}> {
  if (!SENDGRID_CONFIGURED) {
    console.log(`[Campaigns] SendGrid not configured. Would send "${args.subject}".`);
    return { success: true, messageId: `dev-${Date.now()}` };
  }
  try {
    const customArgs: Record<string, string> = {};
    if (args.campaignId) customArgs.campaign_id = args.campaignId;
    if (args.recipientId) customArgs.recipient_id = args.recipientId;
    const [resp] = await sgMail.send({
      to: args.to,
      from: { email: args.from, name: args.fromName },
      replyTo: args.replyTo,
      subject: args.subject,
      html: args.html,
      // Open tracking injects a 1x1 pixel; click tracking rewrites <a href>
      // links. The unsubscribe link is marked clicktracking="off" in
      // email-template.ts so it survives un-rewritten regardless of this flag.
      trackingSettings: {
        openTracking: { enable: !!args.trackOpens },
        clickTracking: { enable: !!args.trackClicks, enableText: false },
      },
      customArgs: Object.keys(customArgs).length ? customArgs : undefined,
    });
    const messageId = resp?.headers?.["x-message-id"] as string | undefined;
    return { success: true, messageId };
  } catch (err: unknown) {
    const e = err as { response?: { body?: { errors?: Array<{ message?: string }> } }; message?: string };
    const raw = e?.response?.body?.errors?.[0]?.message || e?.message || "SendGrid send failed";
    const safe = scrubPii(raw);
    console.error("[Campaigns] send failure:", safe);
    return { success: false, error: safe };
  }
}

// Send a single test email of the given campaign to a specified address.
export async function sendCampaignTest(
  campaignId: string,
  toEmail: string,
): Promise<{ success: boolean; error?: string }> {
  const [campaign] = await db
    .select()
    .from(emailCampaigns)
    .where(eq(emailCampaigns.id, campaignId));
  if (!campaign) throw new Error("Campaign not found");

  const baseUrl = process.env.BASE_URL || "https://voting.chrismcnulty.net";
  const unsubscribeUrl = `${baseUrl}/unsubscribe?t=test`;
  const merged = applyMergeTokens(campaign.bodyHtml, {
    firstName: null,
    lastName: null,
    email: toEmail,
    unsubscribeUrl,
  });
  const html = await renderBrandedEmail({
    bodyHtml: `<p style="margin:0 0 12px 0;color:#888;font-style:italic;">[Test send] This is a preview of the "${campaign.name}" campaign.</p>` + merged,
    unsubscribeUrl,
    recipientEmail: toEmail,
  });
  return await sendOneCampaignEmail({
    to: toEmail,
    from: campaign.fromEmail,
    fromName: campaign.fromName,
    replyTo: campaign.replyTo || undefined,
    subject: `[TEST] ${campaign.subject}`,
    html,
  });
}

// =============== Tracking event ingest (SendGrid Event Webhook) ===============

interface SendGridEvent {
  email?: string;
  timestamp?: number;
  event?: string;
  url?: string;
  useragent?: string;
  ip?: string;
  sg_event_id?: string;
  sg_message_id?: string;
  campaign_id?: string;   // populated via customArgs at send time
  recipient_id?: string;  // populated via customArgs at send time
}

/**
 * Ingest a batch of SendGrid event webhook payloads. Idempotent via
 * unique sg_event_id. Updates per-recipient and per-campaign aggregates
 * for open/click events.
 */
export async function ingestSendGridEvents(events: SendGridEvent[]): Promise<{
  inserted: number;
  matched: number;
  unmatched: number;
}> {
  let inserted = 0;
  let matched = 0;
  let unmatched = 0;

  // Track which (campaignId, recipientId) pairs need aggregate refresh.
  const dirtyCampaigns = new Set<string>();

  for (const ev of events) {
    if (!ev || !ev.event) continue;
    const eventType = String(ev.event).toLowerCase();
    const occurredAt = ev.timestamp ? new Date(ev.timestamp * 1000) : new Date();
    const email = (ev.email || "").toLowerCase();

    // Resolve recipient by recipient_id customArg first, then by sg_message_id prefix.
    let recipientRow:
      | { id: string; campaignId: string; contactId: string; openCount: number; clickCount: number; openedAt: Date | null; clickedAt: Date | null }
      | undefined;

    if (ev.recipient_id) {
      const [row] = await db
        .select({
          id: emailCampaignRecipients.id,
          campaignId: emailCampaignRecipients.campaignId,
          contactId: emailCampaignRecipients.contactId,
          openCount: emailCampaignRecipients.openCount,
          clickCount: emailCampaignRecipients.clickCount,
          openedAt: emailCampaignRecipients.openedAt,
          clickedAt: emailCampaignRecipients.clickedAt,
        })
        .from(emailCampaignRecipients)
        .where(eq(emailCampaignRecipients.id, ev.recipient_id));
      recipientRow = row;
    }
    if (!recipientRow && ev.sg_message_id) {
      // SendGrid event sg_message_id is like "<x-message-id>.<suffix>".
      const prefix = ev.sg_message_id.split(".")[0];
      const [row] = await db
        .select({
          id: emailCampaignRecipients.id,
          campaignId: emailCampaignRecipients.campaignId,
          contactId: emailCampaignRecipients.contactId,
          openCount: emailCampaignRecipients.openCount,
          clickCount: emailCampaignRecipients.clickCount,
          openedAt: emailCampaignRecipients.openedAt,
          clickedAt: emailCampaignRecipients.clickedAt,
        })
        .from(emailCampaignRecipients)
        .where(eq(emailCampaignRecipients.sendgridMessageId, prefix));
      recipientRow = row;
    }

    if (!recipientRow) {
      unmatched++;
      continue;
    }
    matched++;

    // Insert into events log (idempotent on sg_event_id). If SendGrid omits
    // sg_event_id, synthesize a stable hash so duplicates still dedupe.
    let dedupeId = ev.sg_event_id;
    if (!dedupeId) {
      const basis = [
        recipientRow.id,
        eventType,
        ev.sg_message_id ?? "",
        ev.timestamp ?? "",
        ev.url ?? "",
      ].join("|");
      dedupeId =
        "synth-" +
        crypto.createHash("sha256").update(basis).digest("hex").slice(0, 32);
    }
    try {
      const ins = await db.execute(sql`
        INSERT INTO email_campaign_events
          (campaign_id, recipient_id, contact_id, email, event_type, url,
           user_agent, ip, sg_event_id, sg_message_id, occurred_at)
        VALUES (${recipientRow.campaignId}, ${recipientRow.id}, ${recipientRow.contactId},
                ${email || ""}, ${eventType}, ${ev.url ?? null},
                ${ev.useragent ?? null}, ${ev.ip ?? null},
                ${dedupeId}, ${ev.sg_message_id ?? null}, ${occurredAt})
        ON CONFLICT (sg_event_id) DO NOTHING
        RETURNING id
      `);
      if (rowCount(ins) > 0) inserted++;
      else continue; // duplicate event - don't double-count
    } catch (err) {
      console.error("[Campaigns] event insert failed:", scrubPii(errMsg(err)));
      continue;
    }

    if (eventType === "open") {
      // Atomic increment: avoids lost updates when multiple events for the
      // same recipient arrive in one batch (or concurrently across requests).
      await db.execute(sql`
        UPDATE email_campaign_recipients
        SET open_count = open_count + 1,
            opened_at = COALESCE(opened_at, ${occurredAt})
        WHERE id = ${recipientRow.id}
      `);
      dirtyCampaigns.add(recipientRow.campaignId);
    } else if (eventType === "click") {
      await db.execute(sql`
        UPDATE email_campaign_recipients
        SET click_count = click_count + 1,
            clicked_at = COALESCE(clicked_at, ${occurredAt})
        WHERE id = ${recipientRow.id}
      `);
      dirtyCampaigns.add(recipientRow.campaignId);
    }
  }

  // Refresh aggregate counts on each touched campaign.
  for (const campaignId of Array.from(dirtyCampaigns)) {
    await refreshTrackingAggregates(campaignId);
  }

  return { inserted, matched, unmatched };
}

export async function refreshTrackingAggregates(campaignId: string): Promise<void> {
  const [agg] = await db
    .select({
      openCount: sql<number>`coalesce(sum(${emailCampaignRecipients.openCount}), 0)::int`,
      uniqueOpens: sql<number>`count(*) filter (where ${emailCampaignRecipients.openedAt} is not null)::int`,
      clickCount: sql<number>`coalesce(sum(${emailCampaignRecipients.clickCount}), 0)::int`,
      uniqueClicks: sql<number>`count(*) filter (where ${emailCampaignRecipients.clickedAt} is not null)::int`,
    })
    .from(emailCampaignRecipients)
    .where(eq(emailCampaignRecipients.campaignId, campaignId));
  await db
    .update(emailCampaigns)
    .set({
      openCount: agg?.openCount ?? 0,
      uniqueOpenCount: agg?.uniqueOpens ?? 0,
      clickCount: agg?.clickCount ?? 0,
      uniqueClickCount: agg?.uniqueClicks ?? 0,
      updatedAt: new Date(),
    })
    .where(eq(emailCampaigns.id, campaignId));
}
