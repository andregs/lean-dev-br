// Pure sitemap construction — no Velite/content import, unit-testable with
// fixtures. app/sitemap.ts feeds it the real posts + tags.
import type { MetadataRoute } from 'next';
import { blogUrl } from './site';

export interface SitemapPost {
  slug: string;
  date: string;
}

function hreflang(enUrl: string, ptBrUrl: string) {
  return { languages: { en: enUrl, 'pt-BR': ptBrUrl, 'x-default': enUrl } };
}

export function buildSitemap(
  posts: readonly SitemapPost[],
  tags: readonly string[],
): MetadataRoute.Sitemap {
  const enIndex = blogUrl('/');
  const ptIndex = blogUrl('/pt-BR/');

  return [
    { url: enIndex, changeFrequency: 'weekly', alternates: hreflang(enIndex, ptIndex) },
    { url: ptIndex, changeFrequency: 'weekly', alternates: hreflang(enIndex, ptIndex) },
    ...posts.flatMap((post) => {
      const enUrl = blogUrl(`/${post.slug}/`);
      const ptUrl = blogUrl(`/pt-BR/${post.slug}/`);
      const alt = hreflang(enUrl, ptUrl);
      return [
        { url: enUrl, lastModified: post.date, alternates: alt },
        { url: ptUrl, lastModified: post.date, alternates: alt },
      ];
    }),
    ...tags.flatMap((tag) => [
      { url: blogUrl(`/tags/${tag}/`) },
      { url: blogUrl(`/pt-BR/tags/${tag}/`) },
    ]),
  ];
}
