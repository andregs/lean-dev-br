import { posts } from '#content';
import { adjacent, collectTags, sortByDateDesc, visiblePosts } from './post-utils';

export type Post = (typeof posts)[number];
export type Locale = 'en-US' | 'pt-BR';
export type LocalizedPost = Post & { fallback: boolean };

// Drafts are visible while developing (rendered with a DRAFT badge) and dropped
// from production builds entirely.
const includeDrafts = process.env.NODE_ENV !== 'production';
export const isDraftPreview = includeDrafts;

const visibleAll = sortByDateDesc(visiblePosts(posts, includeDrafts));

// ---------------------------------------------------------------------------
// EN-only API (used by existing EN routes — no locale param needed)
// ---------------------------------------------------------------------------

export const allPosts = visibleAll.filter((p) => p.locale !== 'pt-BR');
export const allTags = collectTags(allPosts);

export function getPost(slug: string): Post | undefined {
  return allPosts.find((p) => p.slug === slug);
}

export function getAdjacent(slug: string): { prev?: Post; next?: Post } {
  return adjacent(allPosts, slug);
}

export function postsByTag(tag: string): Post[] {
  return allPosts.filter((p) => p.tags.includes(tag));
}

// ---------------------------------------------------------------------------
// Locale-aware API (used by pt-BR routes)
// ---------------------------------------------------------------------------

/**
 * Posts for a given locale, with EN fallbacks for untranslated pt-BR slugs.
 *
 * - en-US: all EN posts, fallback:false.
 * - pt-BR: translated pt-BR posts (fallback:false) + EN posts that have no
 *   pt-BR counterpart (fallback:true), sorted newest-first.
 */
export function allPostsFor(locale: Locale): LocalizedPost[] {
  if (locale === 'en-US') {
    return allPosts.map((p) => ({ ...p, fallback: false }));
  }
  const ptSlugs = new Set(visibleAll.filter((p) => p.locale === 'pt-BR').map((p) => p.slug));
  const translated: LocalizedPost[] = visibleAll
    .filter((p) => p.locale === 'pt-BR')
    .map((p) => ({ ...p, fallback: false }));
  const fallbacks: LocalizedPost[] = visibleAll
    .filter((p) => p.locale !== 'pt-BR' && !ptSlugs.has(p.slug))
    .map((p) => ({ ...p, fallback: true }));
  return sortByDateDesc([...translated, ...fallbacks]);
}

/** Tags across all posts for a locale (including fallback EN posts). */
export function allTagsFor(locale: Locale): string[] {
  return collectTags(allPostsFor(locale));
}

/**
 * Look up a post by locale + slug.
 * For pt-BR: returns the translated post if it exists, otherwise the EN
 * counterpart flagged as a fallback.
 */
export function getPostLocalized(locale: Locale, slug: string): LocalizedPost | undefined {
  return allPostsFor(locale).find((p) => p.slug === slug);
}

/** Adjacent posts within the locale-aware list. */
export function getAdjacentLocalized(
  locale: Locale,
  slug: string,
): { prev?: LocalizedPost; next?: LocalizedPost } {
  return adjacent(allPostsFor(locale), slug);
}

/** Posts for a locale filtered by tag (includes EN fallbacks). */
export function postsByTagLocalized(locale: Locale, tag: string): LocalizedPost[] {
  return allPostsFor(locale).filter((p) => p.tags.includes(tag));
}
