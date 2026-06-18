import { renderFeed } from '../../../../lib/feed';
import { allPostsFor } from '../../../../lib/posts';

export const dynamic = 'force-static';

export function GET(): Response {
  const xml = renderFeed(allPostsFor('pt-BR'), '/pt-BR');
  return new Response(xml, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
}
