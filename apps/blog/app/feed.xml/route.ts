import { renderFeed } from '../../lib/feed';
import { allPosts } from '../../lib/posts';

export const dynamic = 'force-static';

export function GET(): Response {
  const xml = renderFeed(allPosts);
  return new Response(xml, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
}
