import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { draftFilename, renderDraft, type DraftInput } from '../../../lib/draft';

interface DraftRequest extends Partial<DraftInput> {
  // Filename from a previous save in this session; lets a re-save update the
  // same file (and rename it) instead of spawning a new one when the title changes.
  previousFilename?: string;
}

// Exactly the shape draftFilename() produces — no path separators or `..`, so a
// client-supplied previousFilename can't traverse out of content/posts/.
const DRAFT_FILENAME = /^\d{4}-\d{2}-\d{2}-[a-z0-9-]+\.md$/;

// Dev-only: writes/updates a markdown file under content/posts/. POST route
// handlers are omitted from `output: export`, so this never ships to production —
// the NODE_ENV guard is belt-and-suspenders.
export async function POST(request: Request): Promise<Response> {
  if (process.env.NODE_ENV === 'production') {
    return new Response('Not found', { status: 404 });
  }

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

  const dir = path.join(process.cwd(), 'content', 'posts');
  const filename = draftFilename(draft.date, draft.title);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, filename), renderDraft(draft), 'utf8');

  // Title/date changed since the last save → remove the now-stale file.
  if (input.previousFilename && input.previousFilename !== filename) {
    if (!DRAFT_FILENAME.test(input.previousFilename)) {
      return Response.json({ error: 'invalid previousFilename' }, { status: 400 });
    }
    await rm(path.join(dir, input.previousFilename), { force: true });
  }

  return Response.json({ ok: true, filename });
}
