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

  it('starts with the EN blog index then the pt-BR index', () => {
    expect(entries[0]?.url).toBe(blogUrl('/'));
    expect(entries[1]?.url).toBe(blogUrl('/pt-BR/'));
  });

  it('includes EN + pt-BR URL per post with lastModified', () => {
    const enFirst = entries.find((e) => e.url === blogUrl('/first/'));
    const ptFirst = entries.find((e) => e.url === blogUrl('/pt-BR/first/'));
    expect(enFirst?.lastModified).toBe('2026-06-07T09:00:00.000Z');
    expect(ptFirst?.lastModified).toBe('2026-06-07T09:00:00.000Z');
    expect(urls).toContain(blogUrl('/second/'));
    expect(urls).toContain(blogUrl('/pt-BR/second/'));
  });

  it('includes EN + pt-BR URL per tag', () => {
    expect(urls).toContain(blogUrl('/tags/nextjs/'));
    expect(urls).toContain(blogUrl('/tags/csp/'));
    expect(urls).toContain(blogUrl('/pt-BR/tags/nextjs/'));
    expect(urls).toContain(blogUrl('/pt-BR/tags/csp/'));
  });

  it('includes hreflang alternates on index + post entries', () => {
    expect(entries.at(0)?.alternates?.languages).toMatchObject({
      en: blogUrl('/'),
      'pt-BR': blogUrl('/pt-BR/'),
      'x-default': blogUrl('/'),
    });
    const enFirst = entries.find((e) => e.url === blogUrl('/first/'));
    expect(enFirst?.alternates?.languages).toMatchObject({
      en: blogUrl('/first/'),
      'pt-BR': blogUrl('/pt-BR/first/'),
    });
  });

  it('emits 2 indexes + 2 URLs per post + 2 URLs per tag, no duplicates', () => {
    expect(entries).toHaveLength(2 + posts.length * 2 + tags.length * 2);
    expect(new Set(urls).size).toBe(urls.length);
  });
});
