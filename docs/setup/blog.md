# Blog Setup

The blog (`apps/blog`) is a Next.js static export served at `/blog` on the existing
CloudFront distribution. Posts are markdown files in `content/posts/` — no CMS, no database.

## Post format

**Filename:** `YYYY-MM-DD-slug.md` inside `apps/blog/content/posts/en/` (English) or
`apps/blog/content/posts/pt-BR/` (Portuguese). The date prefix drives ordering; the slug
(filename without the date prefix) is the shared identity across locales.

**Frontmatter:**

```yaml
---
title: My post title        # required
date: 2026-01-15            # required ISO date; authoritative for ordering
description: One sentence.  # optional, used in OG + post index
tags: [nextjs, aws]         # optional array; each tag gets a /blog/tags/<tag> page
draft: true                 # optional; default false. Draft posts render in dev,
                            # are excluded from production builds.
---
```

The `locale` field is derived automatically from the parent directory (`en/` → `en-US`,
`pt-BR/` → `pt-BR`). Do not set it manually in frontmatter.

## Localization

The blog is bilingual. URLs are:

| Locale | Index | Post | Tag |
|--------|-------|------|-----|
| English | `/blog/` | `/blog/[slug]/` | `/blog/tags/[tag]/` |
| Portuguese | `/blog/pt-BR/` | `/blog/pt-BR/[slug]/` | `/blog/pt-BR/tags/[tag]/` |

### Writing a translation

1. Create `apps/blog/content/posts/pt-BR/YYYY-MM-DD-same-slug.md` — **same date prefix and
   slug** as the English original. Velite matches them by slug.
2. Translate title, description, and body. Tags stay as English slugs (display labels are
   handled by `lib/tag-labels.ts`).
3. The translation replaces the fallback for that post in the pt-BR tree.

### EN fallback (untranslated posts)

If a slug has no `pt-BR/` counterpart, the pt-BR index and tag pages still list the post
with the English body. A **"só em inglês"** pill (`title="por enquanto"`) marks these posts.
`lib/posts.ts` sets `fallback: true` on them; `app/PostList.tsx` and `app/PostDetail.tsx`
render the pill.

### Locale default redirect

First-time pt-* visitors (no stored `lean:locale`) are redirected from `/blog/…` to
`/blog/pt-BR/…` by `app/LocaleDefaultBoot.tsx` (client-side, EN tree only). An explicit
stored preference always wins.

### Tag labels

English tag slugs are canonical. `lib/tag-labels.ts` maps translatable tags to pt-BR
display labels (`security → segurança`, `decisions → decisões`,
`infrastructure → infraestrutura`). Tech proper nouns pass through unchanged.

## Lang toggle (feature flag)

The nav toggle between `/blog/` ↔ `/blog/pt-BR/` is gated by the `lang-toggle` OpenFeature
flag (`flags.json`). Toggle the flag to show/hide it globally without a redeploy. See
`docs/setup/feature-flags.md` for the flip runbook.

## Authoring flow

### Option A — editor UI (recommended)

Requires Chrome (built-in AI APIs: Prompt API + Proofreader). Other browsers show the
editor without AI features.

1. Run `pnpm nx dev blog` — starts the Next.js dev server (also starts Velite in watch mode).
2. Open `http://localhost:3000/blog/editor` (or `/blog/editor?slug=my-post` to edit an
   existing post).
3. Write; click **Proofread** for AI prose suggestions, **Suggest tags** for tag ideas.
4. Toggle `draft: false` in the frontmatter pane to mark ready for publish.
5. Save — the editor writes directly to `content/posts/en/`.

**Chrome flags required for built-in AI** (one-time setup):
- `chrome://flags/#prompt-api-for-gemini-nano` → Enabled
- `chrome://flags/#optimization-guide-on-device-model` → Enabled BypassPerfRequirement
- Then: `chrome://components` → "Optimization Guide On Device Model" → Check for update

### Option B — plain text

Create `apps/blog/content/posts/en/YYYY-MM-DD-slug.md` manually with the frontmatter above.

## Draft → publish → deploy

1. Set `draft: false` in frontmatter.
2. Run `pnpm nx run blog:postbuild` to verify the post appears in the production build
   (`apps/blog/out/` should contain the post's `index.html`).
3. Commit and push to `main`. GitHub Actions deploys automatically and invalidates
   `/blog/*` in CloudFront so the new content is live within seconds.

## SEO

- **hreflang:** Each post page's `generateMetadata` emits `alternates.languages` with
  `en`, `pt-BR`, and `x-default` (→ EN). Google/Bing use these to serve the right locale.
- **Sitemap:** `app/sitemap.ts` emits both locale trees with per-entry `alternates.languages`.
- **RSS feeds:** `/blog/feed.xml` (EN), `/blog/pt-BR/feed.xml` (pt-BR, includes EN fallbacks).
- **Locale switch reloads** the page (route groups `(en)/` and `(pt-BR)/` have separate root
  layouts with the correct `<html lang>`). In-locale navigation is soft.

## Build

```zsh
# Full blog build (Next.js + postbuild rename of opengraph-image):
pnpm nx run blog:postbuild

# Prod-like preview with blog CSP (emulates CloudFront):
pnpm nx preview blog
```

`postbuild` depends on `build` — running it is always safe even if `build` is cached.
CI calls `pnpm nx run blog:postbuild --skip-nx-cache` to get a fresh build artifact.

## GitHub Actions variables

The blog reuses the existing `VITE_RUM_*` variable values; the deploy workflow maps them
to `NEXT_PUBLIC_RUM_*` names automatically. No new variables are needed.

See `docs/setup/observability.md` for details.

## CloudFront invalidation

Blog HTML pages are cached at CloudFront (`CACHING_OPTIMIZED` policy). The deploy workflow
invalidates `/blog/*` after every `pulumi up`, so new and edited posts go live immediately.
`/blog/_next/*` assets are content-addressed (hashed filenames) and never invalidated.
