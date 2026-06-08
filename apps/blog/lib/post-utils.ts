// Pure post-list helpers — no Velite/content import so they're trivially
// unit-testable with fixtures. lib/posts.ts applies these to the real content.

export interface PostLike {
  slug: string;
  date: string;
  draft: boolean;
  tags: string[];
}

/** Newest-first by frontmatter date. */
export function sortByDateDesc<T extends PostLike>(posts: readonly T[]): T[] {
  return [...posts].sort((a, b) => +new Date(b.date) - +new Date(a.date));
}

/** Drop drafts unless drafts are explicitly included (dev preview). */
export function visiblePosts<T extends PostLike>(posts: readonly T[], includeDrafts: boolean): T[] {
  return includeDrafts ? [...posts] : posts.filter((p) => !p.draft);
}

/**
 * Prev/next neighbours within a newest-first list. "next" is the chronologically
 * newer post (the one above in the list), "prev" the older one.
 */
export function adjacent<T extends PostLike>(
  ordered: readonly T[],
  slug: string,
): { prev?: T; next?: T } {
  const i = ordered.findIndex((p) => p.slug === slug);
  if (i === -1) return {};
  return { next: ordered[i - 1], prev: ordered[i + 1] };
}

/** Unique, alphabetically-sorted tag list across the given posts. */
export function collectTags(posts: readonly PostLike[]): string[] {
  return [...new Set(posts.flatMap((p) => p.tags))].sort();
}
