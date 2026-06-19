import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import matter from 'gray-matter';
import { draftFilename, draftFilenameFor, isDraftFilename, renderDraft, slugify, type DraftInput } from '../../../lib/draft';
import { filenameForSlug, postsDir, type PostLocale } from '../../../lib/posts-fs';
import { problem } from '../../../lib/problem';

// Slug portion of a filename: lowercase letters, digits, hyphens.
const SAFE_SLUG = /^[a-z0-9][a-z0-9-]*$/;

interface DraftRequest extends Partial<DraftInput> {
  locale?: string;
  // Filename from a previous save in this session; lets a re-save update the
  // same file (and rename it) instead of spawning a new one when the title changes.
  previousFilename?: string;
  // Pin the slug (overrides title-derived slug). Used by the editor when
  // translating an EN post to pt-BR — the pt-BR file must share the EN slug.
  slugOverride?: string;
}

// These handlers mutate the working tree; they exist only for `next dev`. Non-GET
// methods are dropped from `output: export`, and they 404 in production anyway —
// the editor that calls them is dev-only too.
function blockInProduction(): Response | null {
  return process.env.NODE_ENV === 'production' ? new Response('Not found', { status: 404 }) : null;
}

function parseLocale(raw: unknown): PostLocale {
  return raw === 'pt-BR' ? 'pt-BR' : 'en';
}

// Save (create or update) a post.
export async function POST(request: Request): Promise<Response> {
  const blocked = blockInProduction();
  if (blocked) return blocked;

  const input = (await request.json()) as DraftRequest;
  if (!input.title || !input.date || !input.body) {
    return problem({ title: 'Bad request', status: 400, detail: 'title, date and body are required' });
  }

  const locale = parseLocale(input.locale);

  const draft: DraftInput = {
    title: input.title,
    date: input.date,
    body: input.body,
    tags: input.tags ?? [],
    description: input.description,
    draft: input.draft ?? false,
  };

  if (input.slugOverride !== undefined && !SAFE_SLUG.test(input.slugOverride)) {
    return problem({ title: 'Bad request', status: 400, detail: 'invalid slugOverride' });
  }

  const dir = postsDir(locale);
  const filename = input.slugOverride
    ? draftFilenameFor(draft.date, input.slugOverride)
    : draftFilename(draft.date, draft.title);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, filename), renderDraft(draft), 'utf8');

  // Title/date changed since the last save → remove the now-stale file.
  if (input.previousFilename && input.previousFilename !== filename) {
    if (!isDraftFilename(input.previousFilename)) {
      return problem({ title: 'Bad request', status: 400, detail: 'invalid previousFilename' });
    }
    await rm(path.join(dir, input.previousFilename), { force: true });
  }

  // pt-BR posts share tags + date with their EN source. Sync those fields back
  // so both variants always have the same tag set and publish date.
  if (locale === 'pt-BR') {
    const ptSlug = input.slugOverride ?? slugify(input.title);
    const enFilename = await filenameForSlug(ptSlug, 'en');
    if (enFilename) {
      const enPath = path.join(postsDir('en'), enFilename);
      const { data: enData, content: enContent } = matter(await readFile(enPath, 'utf8'));
      const syncedEn: DraftInput = {
        title: typeof enData.title === 'string' ? enData.title : '',
        date: draft.date,
        tags: draft.tags,
        description: typeof enData.description === 'string' ? enData.description : undefined,
        draft: enData.draft === true,
        body: enContent.trim(),
      };
      await writeFile(enPath, renderDraft(syncedEn), 'utf8');
    }
  }

  return Response.json({ ok: true, filename });
}

// Delete a post by ?slug&locale. No confirmation by design — `git` is the undo.
export async function DELETE(request: Request): Promise<Response> {
  const blocked = blockInProduction();
  if (blocked) return blocked;

  const url = new URL(request.url);
  const slug = url.searchParams.get('slug');
  const locale = parseLocale(url.searchParams.get('locale'));

  if (!slug) return problem({ title: 'Bad request', status: 400, detail: 'slug required' });

  const filename = await filenameForSlug(slug, locale);
  if (!filename || !isDraftFilename(filename)) {
    return problem({ title: 'Not found', status: 404, detail: `No ${locale} post with slug "${slug}"` });
  }
  await rm(path.join(postsDir(locale), filename), { force: true });

  // Deleting the EN source cascades to the pt-BR counterpart (shared slug).
  if (locale === 'en') {
    const ptBRFilename = await filenameForSlug(slug, 'pt-BR');
    if (ptBRFilename) {
      await rm(path.join(postsDir('pt-BR'), ptBRFilename), { force: true });
    }
  }

  return Response.json({ ok: true, filename });
}
