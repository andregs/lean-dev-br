import { describe, expect, it } from 'vitest';
import { blogUrl, SITE_URL } from './site';

describe('site URLs', () => {
  it('blogUrl joins origin + basePath + path', () => {
    expect(blogUrl()).toBe(`${SITE_URL}/blog`);
    expect(blogUrl('/feed.xml')).toBe(`${SITE_URL}/blog/feed.xml`);
    expect(blogUrl('/tags/nextjs/')).toBe(`${SITE_URL}/blog/tags/nextjs/`);
  });

  it('SITE_URL has no trailing slash', () => {
    expect(SITE_URL.endsWith('/')).toBe(false);
  });
});
