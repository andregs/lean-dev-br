import { readFile } from 'node:fs/promises';
import path from 'node:path';
import matter from 'gray-matter';
import { filenameForSlug, postsDir, type PostLocale } from '../../../../lib/posts-fs';
import { problem } from '../../../../lib/problem';

// Load a post's raw fields for the editor's edit mode. POST (not GET) so it's
// dropped from `output: export`; 404s in production as a backstop.
export async function POST(request: Request): Promise<Response> {
  if (process.env.NODE_ENV === 'production') {
    return new Response('Not found', { status: 404 });
  }

  const body = (await request.json()) as { slug?: string; locale?: string };
  if (!body.slug) return problem({ title: 'Bad request', status: 400, detail: 'slug required' });

  const slug: string = body.slug;
  const locale: PostLocale = body.locale === 'pt-BR' ? 'pt-BR' : 'en';

  let filename = await filenameForSlug(slug, locale);
  let seededFromEn = false;

  if (!filename && locale === 'pt-BR') {
    // No pt-BR file yet — seed the editor from the EN source so the translator
    // starts from English text. Return filename=undefined so the editor treats
    // this as a new save (no rename-over-EN-source risk).
    filename = await filenameForSlug(slug, 'en');
    seededFromEn = true;
  }

  if (!filename) {
    return problem({ title: 'Not found', status: 404, detail: `No post with slug "${slug}"` });
  }

  const readLocale: PostLocale = seededFromEn ? 'en' : locale;
  const { data, content } = matter(
    await readFile(path.join(postsDir(readLocale), filename), 'utf8'),
  );

  return Response.json({
    // Omit filename when seeded from EN so savedFilename stays null in the
    // editor — prevents the rename logic from deleting the EN source.
    filename: seededFromEn ? undefined : filename,
    // Return the slug when seeded so the editor can pin it as slugOverride,
    // ensuring the pt-BR file is named with the same slug as the EN source.
    slug: seededFromEn ? slug : undefined,
    seededFromEn,
    title: typeof data.title === 'string' ? data.title : '',
    date: new Date(data.date as string | number | Date).toISOString(),
    tags: Array.isArray(data.tags) ? (data.tags as string[]) : [],
    description: typeof data.description === 'string' ? data.description : '',
    draft: data.draft === true,
    body: content.trim(),
  });
}
