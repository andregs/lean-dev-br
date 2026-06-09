import { readFile } from 'node:fs/promises';
import path from 'node:path';
import matter from 'gray-matter';
import { filenameForSlug, postsDir } from '../../../../lib/posts-fs';

// Load a post's raw fields for the editor's edit mode. POST (not GET) so it's
// dropped from `output: export`; 404s in production as a backstop.
export async function POST(request: Request): Promise<Response> {
  if (process.env.NODE_ENV === 'production') {
    return new Response('Not found', { status: 404 });
  }

  const { slug } = (await request.json()) as { slug?: string };
  if (!slug) return Response.json({ error: 'slug required' }, { status: 400 });

  const filename = await filenameForSlug(slug);
  if (!filename) return Response.json({ error: 'not found' }, { status: 404 });

  const { data, content } = matter(await readFile(path.join(postsDir(), filename), 'utf8'));
  return Response.json({
    filename,
    title: typeof data.title === 'string' ? data.title : '',
    date: new Date(data.date as string | number | Date).toISOString(),
    tags: Array.isArray(data.tags) ? (data.tags as string[]) : [],
    description: typeof data.description === 'string' ? data.description : '',
    draft: data.draft === true,
    body: content.trim(),
  });
}
