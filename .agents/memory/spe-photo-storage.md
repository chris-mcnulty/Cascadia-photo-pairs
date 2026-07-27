---
name: SPE photo storage
description: Architecture decisions for SharePoint Embedded photo storage migration
---

# SharePoint Embedded Photo Storage

## Rule
All photo image serving goes through `/api/photos/:id/image?size=thumb|mid|full`.
The proxy handles SPE, base64, and Wix in a single endpoint — never use `photo.imageUrl` directly in `<img src>`.

**Why:** The storageProvider enum (wix | base64 | sharepoint_embedded) controls which path serves. As photos migrate, consumers don't need to know.

**How to apply:** Any new UI showing a photo should use `/api/photos/${id}/image?size=...` with an `onError` fallback to `photo.imageUrl` for during-migration safety.

## Key files
- `server/spe-graph-client.ts` — MSAL client-credential auth, driveId resolution (5-min TTL), upload/download
- `shared/schema.ts` → photos table: added `storageProvider`, `spContainerId`, `spFolderPath`
- `server/routes.ts` — image proxy at GET /api/photos/:id/image, multipart POST /api/photos, SPE migration routes

## Arch constraints (from Orbit)
- SPE does NOT support `/storage/fileStorage/containers/{id}/drive/root:…` chaining
- Must: GET container/drive → driveId, then use `/drives/{driveId}/root:/{path}:/content`
- Upload split: ≤4MB simple PUT, >4MB resumable session
- Folder pattern: `photos/{photoId}/{size}.jpg` (thumb/mid/full)

## SPE_CONTAINER_ID env var
Must be set before file uploads or migration will return 503. `SPE_CONTAINER_TYPE_ID` is a one-time Azure admin step (PowerShell), not needed in app code.

## Migration
- POST /api/admin/photos/migrate-to-spe starts background job, returns jobId
- GET /api/admin/photos/migration-status?jobId=... polls status
- Admin Settings → "Photo Storage" panel has connection test + migration UI
