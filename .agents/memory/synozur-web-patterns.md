---
name: Synozur web patterns
description: Reminder to check the Synozur repo for existing web optimization patterns before building anything new in that space.
---

# Synozur Web Patterns — Check Before Building

**Repo:** https://github.com/chris-mcnulty/synozur-webbase

## The rule

Before planning or implementing any of the following features in this project, fetch the relevant source file(s) from the Synozur repo and reuse or adapt the existing pattern rather than building from scratch:

- OpenGraph / Twitter Card meta tags
- SEO (page titles, canonical URLs, meta descriptions)
- Structured data / JSON-LD (Article, Product, BreadcrumbList, etc.)
- Sitemap generation
- Page-speed / Core Web Vitals optimizations (lazy loading, image sizing, font strategies)
- `robots.txt` configuration
- CSP (Content Security Policy) headers
- Any other web-standard optimization or SEO signal

## Why

The Synozur repo is a production marketing site built by the same author with similar goals. Patterns there are already tested and production-hardened. Duplicating that work from scratch wastes time and risks inconsistency.

## How to apply

1. When a plan or user request touches any area above, add a step: **"Check Synozur repo for existing implementation"**.
2. Use `code_execution` with `fetch()` to pull the relevant file from `https://raw.githubusercontent.com/chris-mcnulty/synozur-webbase/main/...` before designing the solution.
3. Adapt the Synozur pattern to fit this project's Express + React + Wouter stack rather than copying verbatim.
4. Note in the plan which Synozur file(s) were referenced.
