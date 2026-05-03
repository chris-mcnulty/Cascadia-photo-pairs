/**
 * CSV pipeline for the social publisher. Parses an admin-uploaded CSV into a
 * structured dry-run report. Required columns:
 *   platform, caption, image_url
 * Optional columns:
 *   additional_image_urls (semicolon-separated for IG carousels),
 *   link, scheduled_at (ISO 8601), utm_campaign, first_comment, account
 *
 * The `account` column may be the account display_name or external id; if
 * omitted, the row falls back to the first active account for that platform.
 */
import { parse } from "csv-parse/sync";
import type { SocialAccount } from "@shared/schema";

export interface SocialCsvRow {
  rowIndex: number; // 1-based, matches the spreadsheet row (header = row 1)
  platform: "instagram" | "facebook";
  caption: string;
  mediaUrls: string[];
  link?: string;
  scheduledAt: Date;
  utmCampaign?: string;
  firstComment?: string;
  accountId: string;
  accountName: string;
  errors: string[];
  warnings: string[];
}

export interface SocialCsvDryRun {
  filename: string;
  rows: SocialCsvRow[];
  totalRows: number;
  validRows: number;
  invalidRows: number;
}

const HTTPS_RE = /^https:\/\/[^\s]+$/i;

import { lookup as dnsLookup } from "dns/promises";

// SSRF guard: reject URLs that resolve to private/loopback/link-local/CGNAT
// ranges or to AWS/GCP-style metadata services.
function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) return true;
  const [a, b] = parts;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 0) return true;
  if (a === 169 && b === 254) return true; // link-local + AWS/GCP metadata
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  if (a >= 224) return true; // multicast / reserved
  return false;
}

function isPrivateIPv6(ip: string): boolean {
  const lower = ip.toLowerCase();
  if (lower === "::1" || lower === "::") return true;
  if (lower.startsWith("fc") || lower.startsWith("fd")) return true; // ULA
  if (lower.startsWith("fe80")) return true; // link-local
  if (lower.startsWith("::ffff:")) {
    const v4 = lower.slice(7);
    return isPrivateIPv4(v4);
  }
  return false;
}

export async function isHostPublic(hostname: string): Promise<boolean> {
  const lower = hostname.toLowerCase();
  if (
    lower === "localhost" ||
    lower.endsWith(".localhost") ||
    lower.endsWith(".internal") ||
    lower.endsWith(".local")
  ) {
    return false;
  }
  try {
    const records = await dnsLookup(hostname, { all: true });
    for (const r of records) {
      if (r.family === 4 && isPrivateIPv4(r.address)) return false;
      if (r.family === 6 && isPrivateIPv6(r.address)) return false;
    }
    return records.length > 0;
  } catch {
    return false;
  }
}

export async function validateImageUrl(url: string): Promise<boolean> {
  if (url.startsWith("data:")) return false;
  if (!HTTPS_RE.test(url)) return false;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (!(await isHostPublic(parsed.hostname))) return false;
  try {
    const res = await fetch(url, { method: "HEAD", redirect: "manual" });
    if (res.status >= 200 && res.status < 400) return true;
    // Some CDNs reject HEAD; try a tiny GET range as fallback
    const r2 = await fetch(url, {
      method: "GET",
      headers: { Range: "bytes=0-0" },
      redirect: "manual",
    });
    return r2.status >= 200 && r2.status < 400;
  } catch {
    return false;
  }
}

export async function parseSocialCsv(args: {
  csvContent: string;
  filename: string;
  accounts: SocialAccount[];
  validateImages?: boolean; // default true; never disabled by client input
}): Promise<SocialCsvDryRun> {
  const cleanContent = args.csvContent.replace(/^\uFEFF/, "");
  const records = parse(cleanContent, {
    columns: (headers: string[]) =>
      headers.map((h) => h.trim().toLowerCase().replace(/\s+/g, "_")),
    skip_empty_lines: true,
    trim: true,
    relax_quotes: true,
    relax_column_count: true,
  }) as Array<Record<string, string>>;

  const rows: SocialCsvRow[] = [];

  for (let i = 0; i < records.length; i++) {
    const r = records[i];
    const errors: string[] = [];
    const warnings: string[] = [];

    const platformRaw = (r.platform || "").toLowerCase().trim();
    const platform: "instagram" | "facebook" =
      platformRaw === "ig" || platformRaw === "instagram"
        ? "instagram"
        : platformRaw === "fb" || platformRaw === "facebook"
        ? "facebook"
        : (platformRaw as any);
    if (platform !== "instagram" && platform !== "facebook") {
      errors.push(`Unknown platform "${r.platform}" (use instagram or facebook)`);
    }

    const caption = (r.caption || "").trim();
    if (!caption) errors.push("caption is required");
    if (platform === "instagram" && caption.length > 2200) {
      errors.push("Instagram captions max 2200 characters");
    }

    const mediaUrls: string[] = [];
    const primary = (r.image_url || "").trim();
    if (primary) mediaUrls.push(primary);
    const additional = (r.additional_image_urls || "").trim();
    if (additional) {
      for (const u of additional.split(/[;,]/).map((s) => s.trim()).filter(Boolean)) {
        mediaUrls.push(u);
      }
    }
    if (!mediaUrls.length) errors.push("image_url is required");
    if (platform === "instagram" && mediaUrls.length > 10) {
      errors.push("Instagram carousels allow max 10 images");
    }
    if (platform === "facebook" && mediaUrls.length > 1) {
      warnings.push(
        "Facebook publishes only the first image; additional images are ignored"
      );
    }

    if (args.validateImages !== false) {
      for (const u of mediaUrls) {
        if (u.startsWith("data:")) {
          errors.push(`data: URLs are not supported (${u.slice(0, 20)}…)`);
          continue;
        }
        if (!HTTPS_RE.test(u)) {
          errors.push(`Image URL must be HTTPS: ${u}`);
          continue;
        }
        const reachable = await validateImageUrl(u);
        if (!reachable) {
          errors.push(`Image URL is not publicly fetchable: ${u}`);
        }
      }
    }

    const link = (r.link || "").trim() || undefined;
    if (link) {
      try {
        const parsed = new URL(link);
        if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
          errors.push(`link must be http(s): ${link}`);
        } else if (!(await isHostPublic(parsed.hostname))) {
          errors.push(`link target is not a public host: ${link}`);
        }
      } catch {
        errors.push(`link is not a valid URL: ${link}`);
      }
    }
    if (caption.includes("{{link}}") && !link) {
      errors.push("caption uses {{link}} but no link column value was provided");
    }

    let scheduledAt: Date;
    const schedRaw = (r.scheduled_at || "").trim().toLowerCase();
    if (!schedRaw || schedRaw === "now") {
      scheduledAt = new Date();
    } else {
      scheduledAt = new Date(r.scheduled_at);
      if (isNaN(scheduledAt.getTime())) {
        errors.push(`Could not parse scheduled_at "${r.scheduled_at}"`);
        scheduledAt = new Date();
      }
    }

    // Resolve account
    const accountHint = (r.account || "").trim().toLowerCase();
    const platformAccounts = args.accounts.filter(
      (a) => a.platform === platform && a.isActive
    );
    let account: SocialAccount | undefined;
    if (accountHint) {
      account = platformAccounts.find(
        (a) =>
          a.displayName.toLowerCase() === accountHint ||
          a.externalId.toLowerCase() === accountHint
      );
      if (!account) errors.push(`No active ${platform} account named "${r.account}"`);
    } else {
      account = platformAccounts[0];
      if (!account)
        errors.push(`No active ${platform} account is connected`);
    }

    rows.push({
      rowIndex: i + 2, // header is row 1
      platform: platform as any,
      caption,
      mediaUrls,
      link,
      scheduledAt,
      utmCampaign: (r.utm_campaign || "").trim() || undefined,
      firstComment: (r.first_comment || "").trim() || undefined,
      accountId: account?.id || "",
      accountName: account?.displayName || "(none)",
      errors,
      warnings,
    });
  }

  return {
    filename: args.filename,
    rows,
    totalRows: rows.length,
    validRows: rows.filter((r) => r.errors.length === 0).length,
    invalidRows: rows.filter((r) => r.errors.length > 0).length,
  };
}
