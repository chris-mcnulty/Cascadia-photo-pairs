---
name: Catalog purchase URLs
description: Why catalog QR codes and "more sizes" links point at customPurchaseUrl, not the app store route
---

The public storefront for chrismcnulty.net is hosted on Wix; individual product
pages live at `https://www.chrismcnulty.net/product-page/<wix-slug>` and are
stored per photo in `photos.custom_purchase_url`. This app also has its own
`/store/:slug` route, but that is not necessarily where buyers actually land.

**Rule:** when generating buyer-facing links (catalog QR codes, "More sizes at…"),
prefer `entry.customPurchaseUrl` and only fall back to `{storeBaseUrl}/store/{slug}`
when it is empty.

**Why:** a QR pointing at `/store/<slug>` can 404 on the live Wix site, sending
exhibit visitors to a dead page. The DB-stored customPurchaseUrl is the canonical
buy link.

**How to apply:** in `server/catalog/catalog-docx.ts` / `catalog-pdf.ts` the QR
target is `entry.customPurchaseUrl || productUrl(entry.slug, baseUrl)`. Keep that
precedence for any new buyer link surfaces.
