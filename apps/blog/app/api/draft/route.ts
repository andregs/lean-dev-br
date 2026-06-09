import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { draftFilename, isDraftFilename, renderDraft, type DraftInput } from '../../../lib/draft';
import { filenameForSlug, postsDir } from '../../../lib/posts-fs';

interface DraftRequest extends Partial<DraftInput> {
  // Filename from a previous save in this session; lets a re-save update the
  // same file (and rename it) instead of spawning a new one when the title changes.
  previousFilename?: string;
}

// These handlers mutate the working tree; they exist only for `next dev`. Non-GET
// methods are dropped from `output: export`, and they 404 in production anyway —
// the editor that calls them is dev-only too.
function blockInProduction(): Response | null {
  return process.env.NODE_ENV === 'production' ? new Response('Not found', { status: 404 }) : null;
}

// Save (create or update) a post.
export async function POST(request: Request): Promise<Response> {
  const blocked = blockInProduction();
  if (blocked) return blocked;

  const input = (await request.json()) as DraftRequest;
  if (!input.title || !input.date || !input.body) {
    return Response.json({ error: 'title, date and body are required' }, { status: 400 });
  }

  const draft: DraftInput = {
    title: input.title,
    date: input.date,
    body: input.body,
    tags: input.tags ?? [],
    description: input.description,
    draft: input.draft ?? false,
  };

  const dir = postsDir();
  const filename = draftFilename(draft.date, draft.title);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, filename), renderDraft(draft), 'utf8');

  // Title/date changed since the last save → remove the now-stale file.
  if (input.previousFilename && input.previousFilename !== filename) {
    if (!isDraftFilename(input.previousFilename)) {
      return Response.json({ error: 'invalid previousFilename' }, { status: 400 });
    }
    await rm(path.join(dir, input.previousFilename), { force: true });
  }

  return Response.json({ ok: true, filename });
}

// Delete a post by ?slug. No confirmation by design — `git` is the undo.
export async function DELETE(request: Request): Promise<Response> {
  const blocked = blockInProduction();
  if (blocked) return blocked;

  const slug = new URL(request.url).searchParams.get('slug');
  if (!slug) return Response.json({ error: 'slug required' }, { status: 400 });

  const filename = await filenameForSlug(slug);
  if (!filename || !isDraftFilename(filename)) {
    return Response.json({ error: 'not found' }, { status: 404 });
  }
  await rm(path.join(postsDir(), filename), { force: true });
  return Response.json({ ok: true, filename });
}
