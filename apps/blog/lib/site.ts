// Single source for blog identity + URL construction. The canonical origin is
// overridable via NEXT_PUBLIC_SITE_URL (inlined at build); it falls back to the
// production domain. basePath (/blog) is applied by next/link for internal nav,
// but must be added explicitly for the absolute URLs used in sitemap, RSS,
// canonical, and JSON-LD.
const RAW_SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://lean.dev.br';

export const SITE_URL = RAW_SITE_URL.replace(/\/+$/, '');
export const BLOG_BASE = '/blog';
export const SITE_NAME = 'lean.dev.br';
export const BLOG_TITLE = 'lean.dev.br — blog';
export const BLOG_DESCRIPTION = 'A dev blog by André Gomes — notes on full-stack and cloud.';
export const AUTHOR = 'André Gomes';

/** Absolute URL under the blog, for canonical / sitemap / RSS / JSON-LD. */
export function blogUrl(path = ''): string {
  return `${SITE_URL}${BLOG_BASE}${path}`;
}
