/**
 * Pending-photo cleanup scheduler.
 *
 * A chunked upload creates a DB record with imageUrl = '/api/photos/pending'
 * before any bytes are transferred.  If the browser closes mid-upload the
 * record is never finalized and stays stuck forever.
 *
 * This module sweeps for such orphans (older than STALE_THRESHOLD_MS) on
 * startup and then on a recurring interval, deletes any partial SPE files,
 * and removes the DB record.
 */

import { db } from "./db";
import { photos } from "../shared/schema";
import { eq } from "drizzle-orm";
import { storage } from "./storage";

const STALE_THRESHOLD_MS = 2 * 60 * 60 * 1000; // 2 hours
const TICK_MS = 60 * 60 * 1000; // 1 hour

export function startPendingPhotoCleanup() {
  // Stagger initial run so the app is fully up.
  setTimeout(sweep, 30_000);
  setInterval(sweep, TICK_MS);
  console.log("[pending-cleanup] scheduled (first run in 30s, then every 1h)");
}

async function sweep() {
  try {
    const cutoff = new Date(Date.now() - STALE_THRESHOLD_MS);

    // Fetch all photos still in the pending sentinel state and post-filter by age.
    // (created_at is stored as text so we compare in JS rather than SQL.)
    const pending = await db
      .select()
      .from(photos)
      .where(eq(photos.imageUrl, "/api/photos/pending"));

    const orphans = pending.filter((p) => {
      try {
        return new Date(p.createdAt).getTime() < cutoff.getTime();
      } catch {
        return false;
      }
    });

    if (orphans.length === 0) return;

    console.log(`[pending-cleanup] found ${orphans.length} orphaned pending photo(s) — cleaning up`);

    for (const photo of orphans) {
      await cleanupOne(photo);
    }
  } catch (err) {
    console.error("[pending-cleanup] sweep error:", err);
  }
}

async function cleanupOne(photo: {
  id: string;
  title: string;
  storageProvider: string;
  spContainerId: string | null;
  spFolderPath: string | null;
}) {
  // 1. Best-effort: delete any partial SPE files.
  if (
    photo.storageProvider === "sharepoint_embedded" &&
    photo.spContainerId &&
    photo.spFolderPath
  ) {
    try {
      const { getSpeGraphClient } = await import("./spe-graph-client");
      const client = getSpeGraphClient();

      // deleteFile treats 404 as success, so these are always safe to call.
      const variants = ["original.jpg", "thumb.jpg", "mid.jpg", "full.jpg"];
      await Promise.allSettled(
        variants.map((v) =>
          client.deleteFile(photo.spContainerId!, `${photo.spFolderPath}/${v}`)
        )
      );
      // Try to remove the folder itself (Graph supports this for empty folders).
      await client.deleteFile(photo.spContainerId, photo.spFolderPath).catch(() => {});
    } catch (err) {
      // SPE errors must not block DB cleanup.
      console.warn(`[pending-cleanup] SPE delete failed for photo ${photo.id}:`, err);
    }
  }

  // 2. Delete the DB record (also clears related vote rows via storage.deletePhoto).
  try {
    await storage.deletePhoto(photo.id);
    console.log(`[pending-cleanup] deleted orphaned photo ${photo.id} ("${photo.title}")`);
  } catch (err) {
    console.error(`[pending-cleanup] DB delete failed for photo ${photo.id}:`, err);
  }
}

/**
 * Returns all currently-pending (stuck) photos regardless of age.
 * Used by the admin API so admins can view and manually delete them.
 */
export async function getPendingPhotos() {
  return db
    .select()
    .from(photos)
    .where(eq(photos.imageUrl, "/api/photos/pending"))
    .orderBy(photos.createdAt);
}
