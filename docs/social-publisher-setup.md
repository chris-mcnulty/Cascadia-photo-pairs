# Social Publisher — Operator Setup Guide

This document covers the one-time setup required to publish to Instagram and
Facebook from the Cascadia admin.

## 1. Prerequisites on the Meta side

You need:

1. A **Facebook Page** you own/manage.
2. An **Instagram Business or Creator account** linked to that Page (in the
   Instagram app: Settings → Account → Switch to Professional → Business; then
   in Facebook Page settings → Linked Accounts → Connect Instagram).
3. A **Meta App** in <https://developers.facebook.com/apps/>:
   - Type: "Business".
   - Add the products: **Facebook Login for Business**, **Instagram Graph API**,
     **Pages API**.
4. The Meta App in Live Mode (Settings → Basic → toggle "App Mode" to Live)
   so non-admin tokens can publish.

## 2. Generate a long-lived Page Access Token

1. Open <https://developers.facebook.com/tools/explorer/>.
2. Select your Meta App in the top-right.
3. "User or Page" dropdown → "Get Page Access Token" → choose your Page.
4. Required permissions on the token:
   - `pages_manage_posts`
   - `pages_read_engagement`
   - `pages_show_list`
   - `instagram_basic`
   - `instagram_content_publish`
   - `business_management` (recommended)
5. Click "Generate Access Token" and approve.
6. Click the blue "i" next to the token → **Open in Access Token Tool** →
   **Extend Access Token**. The result is a long-lived (~60-day) token.
7. Re-issue this Page token through `/me/accounts` if you need a never-expiring
   Page token (recommended for production).

Copy the long-lived token. **Treat it like a password.**

## 3. Find your IDs

- **Facebook Page ID** — Page → About → Page transparency → Page ID.
- **Instagram User ID** — Graph API Explorer:
  `GET /{page-id}?fields=instagram_business_account` → returns
  `instagram_business_account.id`.

## 4. Connect the account in the admin

1. Sign in as admin → **Social** tab → **Accounts** → **Connect Account**.
2. Pick platform (Instagram or Facebook).
3. Paste the Page ID (FB) or Instagram User ID (IG) and the long-lived token.
4. Click **Test token** to validate against Meta.
5. Click **Save**. The token is encrypted (AES-256-GCM) with a key derived
   from `SESSION_SECRET` and stored in `social_accounts.access_token_encrypted`.
   It is **not** written to env vars or to disk in plaintext, and it is never
   returned by any GET endpoint.

## 5. Required Replit env vars / secrets

| Key | Required | Purpose |
| --- | --- | --- |
| `SESSION_SECRET` | yes | Source of the token-encryption key. **Do not rotate without re-connecting accounts** — old ciphertexts will become unreadable. |
| `SOCIAL_TOKEN_KEY` | optional | Override key source (use this if you want to rotate without changing `SESSION_SECRET`). |
| `PUBLIC_BASE_URL` | recommended in prod | Used to build tracked links (e.g. `https://chrismcnulty.net`). Falls back to `REPLIT_DEV_DOMAIN` in dev. |
| `SOCIAL_FAILURE_EMAIL` | optional | Inbox notified when a post permanently fails. |
| `SOCIAL_SCHEDULER_DISABLED` | optional | Set to `1` to stop the in-process scheduler (e.g. during a migration). |

## 6. Daily limits

- Instagram caps publishing at **25 posts / 24h / account**. The scheduler
  enforces this and reschedules excess posts an hour out.
- Meta API errors classified as transient (codes 1, 2, 4, 17, 32, 613 or 5xx)
  are retried with exponential backoff (1m, 4m, 16m, 64m, then failed).
- A post stuck in `posting` for >10 minutes is marked **failed** automatically
  to prevent double-publishes. Verify on Meta before clicking **Retry**.

## 7. Workflow

1. Build a CSV (sample is in the **Import CSV** tab). Columns:
   `platform,caption,image_url,additional_image_urls,link,scheduled_at,utm_campaign,first_comment,account`.
2. Upload → **Dry-run** to see per-row validation, the rendered caption (with
   `{{link}}` replaced) and the tracked URL preview.
3. Click **Queue N posts** to commit. The whole import is a single DB
   transaction — either everything is queued or nothing is.
4. Watch the **Post Queue** tab; click counts, retries, and live permalinks
   show up there. The queue auto-refreshes every 30 s.
