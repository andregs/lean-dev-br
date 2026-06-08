// Pure RSS rendering — no Velite/content import, so it's unit-testable with
// fixtures. app/feed.xml/route.ts feeds it the real posts.
import { AUTHOR, BLOG_DESCRIPTION, BLOG_TITLE, blogUrl } from './site';

export interface FeedItem {
  title: string;
  slug: string;
  date: string;
  description?: string;
}

const XML_ESCAPES: Record<string, string> = {
  '<': '&lt;',
  '>': '&gt;',
  '&': '&amp;',
  "'": '&apos;',
  '"': '&quot;',
};

export function escapeXml(s: string): string {
  return s.replace(/[<>&'"]/g, (c) => XML_ESCAPES[c] ?? c);
}

export function renderFeed(items: readonly FeedItem[]): string {
  const body = items
    .map((item) => {
      const url = blogUrl(`/${item.slug}/`);
      const description = item.description
        ? `\n      <description>${escapeXml(item.description)}</description>`
        : '';
      return `    <item>
      <title>${escapeXml(item.title)}</title>
      <link>${url}</link>
      <guid isPermaLink="true">${url}</guid>
      <pubDate>${new Date(item.date).toUTCString()}</pubDate>${description}
    </item>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${escapeXml(BLOG_TITLE)}</title>
    <link>${blogUrl('/')}</link>
    <description>${escapeXml(BLOG_DESCRIPTION)}</description>
    <managingEditor>${escapeXml(AUTHOR)}</managingEditor>
${body}
  </channel>
</rss>`;
}
