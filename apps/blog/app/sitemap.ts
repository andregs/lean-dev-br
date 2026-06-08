import type { MetadataRoute } from 'next';
import { allPosts, allTags } from '../lib/posts';
import { buildSitemap } from '../lib/sitemap';

export const dynamic = 'force-static';

export default function sitemap(): MetadataRoute.Sitemap {
  return buildSitemap(allPosts, allTags);
}
