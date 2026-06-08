import { posts } from '#content';
import { adjacent, collectTags, sortByDateDesc, visiblePosts } from './post-utils';

export type Post = (typeof posts)[number];

// Drafts are visible while developing (rendered with a DRAFT badge) and dropped
// from production builds entirely.
const includeDrafts = process.env.NODE_ENV !== 'production';
export const isDraftPreview = includeDrafts;

export const allPosts = sortByDateDesc(visiblePosts(posts, includeDrafts));
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
