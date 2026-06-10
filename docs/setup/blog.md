# Blog Setup

The blog (`apps/blog`) is a Next.js static export served at `/blog` on the existing
CloudFront distribution. Posts are markdown files in `content/posts/` — no CMS, no database.

## Post format

**Filename:** `YYYY-MM-DD-slug.md` inside `apps/blog/content/posts/`.
The date prefix drives ordering; the slug is the URL path under `/blog/`.

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

## Authoring flow

### Option A — editor UI (recommended)

Requires Chrome (built-in AI APIs: Prompt API + Proofreader). Other browsers show the
editor without AI features.

1. Run `pnpm nx dev blog` — starts the Next.js dev server (also starts Velite in watch mode).
2. Open `http://localhost:3000/blog/editor` (or `/blog/editor?slug=my-post` to edit an
   existing post).
3. Write; click **Proofread** for AI prose suggestions, **Suggest tags** for tag ideas.
4. Toggle `draft: false` in the frontmatter pane to mark ready for publish.
5. Save — the editor writes directly to `content/posts/`.

**Chrome flags required for built-in AI** (one-time setup):
- `chrome://flags/#prompt-api-for-gemini-nano` → Enabled
- `chrome://flags/#optimization-guide-on-device-model` → Enabled BypassPerfRequirement
- Then: `chrome://components` → "Optimization Guide On Device Model" → Check for update

### Option B — plain text

Create `apps/blog/content/posts/YYYY-MM-DD-slug.md` manually with the frontmatter above.

## Draft → publish → deploy

1. Set `draft: false` in frontmatter.
2. Run `pnpm nx run blog:postbuild` to verify the post appears in the production build
   (`apps/blog/out/` should contain the post's `index.html`).
3. Commit and push to `main`. GitHub Actions deploys automatically and invalidates
   `/blog/*` in CloudFront so the new content is live within seconds.

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
