// Pure sitemap construction — no Velite/content import, unit-testable with
// fixtures. app/sitemap.ts feeds it the real posts + tags.
import type { MetadataRoute } from 'next';
import { blogUrl } from './site';

export interface SitemapPost {
  slug: string;
  date: string;
}

export function buildSitemap(
  posts: readonly SitemapPost[],
  tags: readonly string[],
): MetadataRoute.Sitemap {
  return [
    { url: blogUrl('/'), changeFrequency: 'weekly' },
    ...posts.map((post) => ({
      url: blogUrl(`/${post.slug}/`),
      lastModified: post.date,
    })),
    ...tags.map((tag) => ({ url: blogUrl(`/tags/${tag}/`) })),
  ];
}
