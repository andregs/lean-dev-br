import { describe, expect, it } from 'vitest';
import { escapeXml, renderFeed, type FeedItem } from './feed';
import { blogUrl } from './site';

const items: FeedItem[] = [
  { title: 'First & <b>tag</b>', slug: 'first', date: '2026-06-07', description: 'a & b' },
  { title: 'Second', slug: 'second', date: '2026-06-08' },
];

describe('escapeXml', () => {
  it('escapes the five XML metacharacters', () => {
    expect(escapeXml(`<a href="x" id='y'> & </a>`)).toBe(
      '&lt;a href=&quot;x&quot; id=&apos;y&apos;&gt; &amp; &lt;/a&gt;',
    );
  });
});

describe('renderFeed', () => {
  it('renders one <item> per post', () => {
    const xml = renderFeed(items);
    expect(xml.match(/<item>/g)?.length).toBe(2);
  });

  it('escapes XML in titles and descriptions', () => {
    const xml = renderFeed(items);
    expect(xml).toContain('<title>First &amp; &lt;b&gt;tag&lt;/b&gt;</title>');
    expect(xml).not.toContain('First & <b>');
  });

  it('uses absolute blog URLs and RFC-822 dates', () => {
    const xml = renderFeed(items);
    expect(xml).toContain(`<link>${blogUrl('/first/')}</link>`);
    expect(xml).toContain(new Date('2026-06-07').toUTCString());
  });

  it('omits description when absent, includes it when present', () => {
    const xml = renderFeed(items);
    expect(xml).toContain('<description>a &amp; b</description>');
    // The second item has no description and must not emit an empty tag.
    expect(xml).not.toContain('<description></description>');
  });

  it('is well-formed RSS 2.0', () => {
    const xml = renderFeed(items);
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(xml).toContain('<rss version="2.0">');
    expect(xml.trimEnd().endsWith('</rss>')).toBe(true);
  });
});
