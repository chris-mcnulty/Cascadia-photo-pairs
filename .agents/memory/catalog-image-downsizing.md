---
name: Catalog export image downsizing
description: Why catalog DOCX/PDF exports must downscale Wix CDN images and how the URL rewrite works.
---

# Catalog export must downsize Wix CDN images

Catalog generators (DOCX/PDF) embed each photo's image. The originals on
`static.wixstatic.com` can be huge (6000px JPEGs, ~13MB PNGs). Embedding originals
made production exports slow and memory-heavy (a full export took ~15s and risked
OOM).

**Rule:** always request a bounded rendition (~1600px) before embedding. The helper
`resizedImageUrl(url, maxDim)` rewrites Wix URLs to a `v1/fit/w_,h_,q_82` transform;
`fetchImageBuffer(url, maxDim)` applies it. Generators pass `maxDim=1600`.

**Why:** Wix serves arbitrary-size renditions from a single source via the
`/v1/fit/...` path segment, so we never need the full-res file for a printed catalog
page. Measured: a 13.6MB PNG drops to ~1.36MB (10x); a 7-photo portfolio PDF
generates in ~2.5s vs the prior ~15s.

**How to apply:** any new code path that embeds a Wix image into a generated
document should go through `fetchImageBuffer(url, 1600)`, not a raw fetch. Non-Wix
URLs pass through `resizedImageUrl` unchanged, so it is safe to call unconditionally.
