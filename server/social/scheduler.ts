/**
 * In-process scheduler for queued social posts. Ticks every minute.
 *
 * Idempotency: each tick atomically transitions a row from "scheduled" to
 * "posting" inside an UPDATE … WHERE status='scheduled' RETURNING * so two
 * concurrent ticks (or two server processes) can't pick the same row twice.
 *
 * Failure isolation: this module never throws into the parent process; all
 * errors are caught and logged. Disable by setting SOCIAL_SCHEDULER_DISABLED=1.
 *
 * Rate limit: hard cap of 25 Instagram publishes per account per rolling 24h.
 */
import { db } from "../db";
import { socialPosts, socialAccounts } from "@shared/schema";
import { and, eq, lte, sql, gte } from "drizzle-orm";
import {
  publishFacebookPagePost,
  publishInstagramPost,
} from "./meta-client";

const TICK_MS = 60_000;
const MAX_ATTEMPTS = 5;
const IG_DAILY_CAP = 25;

let started = false;

export function startSocialScheduler() {
  if (started) return;
  if (process.env.SOCIAL_SCHEDULER_DISABLED === "1") {
    console.log("[social-scheduler] disabled via SOCIAL_SCHEDULER_DISABLED=1");
    return;
  }
  started = true;
  console.log("[social-scheduler] starting (tick=60s)");
  // Stagger initial tick a few seconds after boot so the app is fully up.
  setTimeout(tick, 5_000);
  setInterval(tick, TICK_MS);
}

async function tick() {
  try {
    await processOnce();
  } catch (e) {
    console.error("[social-scheduler] tick error", e);
  }
}

async function igDailyCount(accountId: string): Promise<number> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const rows = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(socialPosts)
    .where(
      and(
        eq(socialPosts.accountId, accountId),
        eq(socialPosts.status, "posted"),
        gte(socialPosts.postedAt, since)
      )
    );
  return rows[0]?.c ?? 0;
}

// Stuck-post recovery: if a post has been in `posting` for >10 minutes, the
// publisher process likely crashed mid-call. Reset to `scheduled` so the next
// tick can retry it (subject to MAX_ATTEMPTS).
async function recoverStuckPosts() {
  const cutoff = new Date(Date.now() - 10 * 60 * 1000);
  const result = await db.execute(sql`
    UPDATE social_posts
       SET status = 'scheduled',
           next_retry_at = now() + interval '1 minute',
           error_message = COALESCE(error_message, '') ||
             ' [recovered from stuck posting state]',
           updated_at = now()
     WHERE status = 'posting'
       AND updated_at < ${cutoff}
     RETURNING id
  `);
  const rows: any[] = (result as any).rows || [];
  if (rows.length) {
    console.warn(
      `[social-scheduler] recovered ${rows.length} stuck posting rows`
    );
  }
}

async function processOnce() {
  const now = new Date();
  await recoverStuckPosts();

  // Atomic claim: scheduled + due + (no retry-gate or retry-due) → posting.
  // Returning the claimed rows guarantees exclusive ownership for this tick.
  const claimed = await db.execute(sql`
    UPDATE social_posts
       SET status = 'posting',
           updated_at = now()
     WHERE id IN (
       SELECT id FROM social_posts
        WHERE status = 'scheduled'
          AND scheduled_at <= ${now}
          AND (next_retry_at IS NULL OR next_retry_at <= ${now})
        ORDER BY scheduled_at ASC
        LIMIT 10
        FOR UPDATE SKIP LOCKED
     )
     RETURNING id, account_id, platform, caption, media_urls, link_url,
               tracked_slug, utm_campaign, attempt_count
  `);

  // neon serverless returns { rows }; drizzle execute returns { rows }.
  const rows: any[] = (claimed as any).rows || (claimed as any) || [];
  if (!rows.length) return;

  for (const row of rows) {
    await publishOne(row).catch((e) => {
      console.error("[social-scheduler] publishOne crash", e);
    });
  }
}

async function publishOne(row: any) {
  const postId: string = row.id;
  const accountId: string = row.account_id;
  const platform: string = row.platform;
  const attempt: number = (row.attempt_count ?? 0) + 1;

  const [account] = await db
    .select()
    .from(socialAccounts)
    .where(eq(socialAccounts.id, accountId));
  if (!account) {
    await markFailed(postId, attempt, "Connected account no longer exists", false);
    return;
  }
  if (!account.isActive) {
    await markFailed(postId, attempt, "Account is disabled", false);
    return;
  }

  // Build effective caption with tracked link substitution
  const baseUrl =
    process.env.PUBLIC_BASE_URL ||
    process.env.REPLIT_DEV_DOMAIN
      ? `https://${process.env.REPLIT_DEV_DOMAIN}`
      : "";
  const trackedUrl =
    row.tracked_slug && baseUrl ? `${baseUrl}/go/${row.tracked_slug}` : row.link_url || "";
  let caption: string = row.caption || "";
  if (caption.includes("{{link}}")) caption = caption.split("{{link}}").join(trackedUrl);

  // IG daily cap
  if (platform === "instagram") {
    const count = await igDailyCount(accountId);
    if (count >= IG_DAILY_CAP) {
      // Push out 1 hour and re-schedule
      await db
        .update(socialPosts)
        .set({
          status: "scheduled",
          nextRetryAt: new Date(Date.now() + 60 * 60 * 1000),
          attemptCount: attempt,
          updatedAt: new Date(),
          errorMessage: `IG daily cap (${IG_DAILY_CAP}) reached; will retry in 1h`,
        })
        .where(eq(socialPosts.id, postId));
      return;
    }
  }

  let result;
  try {
    if (platform === "facebook") {
      result = await publishFacebookPagePost({
        pageId: account.externalId,
        tokenSecretKey: account.tokenSecretKey,
        caption,
        imageUrl: (row.media_urls || [])[0],
        link: trackedUrl || undefined,
      });
    } else {
      result = await publishInstagramPost({
        igUserId: account.externalId,
        tokenSecretKey: account.tokenSecretKey,
        caption,
        mediaUrls: row.media_urls || [],
      });
    }
  } catch (e: any) {
    await markFailed(postId, attempt, e.message || "Unknown error", true);
    return;
  }

  if (result.ok) {
    await db
      .update(socialPosts)
      .set({
        status: "posted",
        externalPostId: result.externalPostId,
        externalPermalink: result.permalink || null,
        postedAt: new Date(),
        attemptCount: attempt,
        errorMessage: null,
        updatedAt: new Date(),
      })
      .where(eq(socialPosts.id, postId));
    console.log(
      `[social-scheduler] posted ${platform} ${postId} -> ${result.externalPostId}`
    );
  } else {
    await markFailed(postId, attempt, result.message, result.retryable);
  }
}

async function markFailed(
  postId: string,
  attempt: number,
  message: string,
  retryable: boolean
) {
  if (retryable && attempt < MAX_ATTEMPTS) {
    // Exponential backoff: 1m, 4m, 16m, 64m
    const delayMs = Math.min(64, Math.pow(4, attempt - 1)) * 60_000;
    await db
      .update(socialPosts)
      .set({
        status: "scheduled",
        nextRetryAt: new Date(Date.now() + delayMs),
        attemptCount: attempt,
        errorMessage: message,
        updatedAt: new Date(),
      })
      .where(eq(socialPosts.id, postId));
  } else {
    await db
      .update(socialPosts)
      .set({
        status: "failed",
        attemptCount: attempt,
        errorMessage: message,
        updatedAt: new Date(),
      })
      .where(eq(socialPosts.id, postId));
  }
}
