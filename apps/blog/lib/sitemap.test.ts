import { describe, expect, it } from 'vitest';
import { buildSitemap, type SitemapPost } from './sitemap';
import { blogUrl } from './site';

const posts: SitemapPost[] = [
  { slug: 'first', date: '2026-06-07T09:00:00.000Z' },
  { slug: 'second', date: '2026-06-08T15:30:00.000Z' },
];
const tags = ['nextjs', 'csp'];

describe('buildSitemap', () => {
  const entries = buildSitemap(posts, tags);
  const urls = entries.map((e) => e.url);

  it('starts with the blog index', () => {
    expect(entries[0]?.url).toBe(blogUrl('/'));
  });

  it('includes an absolute, trailing-slash URL per post with lastModified', () => {
    const first = entries.find((e) => e.url === blogUrl('/first/'));
    expect(first?.lastModified).toBe('2026-06-07T09:00:00.000Z');
    expect(urls).toContain(blogUrl('/second/'));
  });

  it('includes a URL per tag', () => {
    expect(urls).toContain(blogUrl('/tags/nextjs/'));
    expect(urls).toContain(blogUrl('/tags/csp/'));
  });

  it('emits index + posts + tags with no duplicates', () => {
    expect(entries).toHaveLength(1 + posts.length + tags.length);
    expect(new Set(urls).size).toBe(urls.length);
  });
});
