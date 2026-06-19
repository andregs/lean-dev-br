import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DELETE, POST } from './route';
import { POST as loadPost } from './load/route';

// The handlers resolve content/posts/{locale} under process.cwd(); point that
// at a temp dir so the real working tree is untouched.
let tmp: string;
let postsBase: string;

beforeEach(async () => {
  tmp = await mkdtemp(path.join(os.tmpdir(), 'blog-route-'));
  postsBase = path.join(tmp, 'content', 'posts');
  await mkdir(postsBase, { recursive: true });
  vi.spyOn(process, 'cwd').mockReturnValue(tmp);
});

afterEach(async () => {
  vi.restoreAllMocks();
  await rm(tmp, { recursive: true, force: true });
});

const DATE = '2026-06-08T15:30:00.000Z';

function jsonReq(url: string, body: unknown, method = 'POST'): Request {
  return new Request(url, {
    method,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function save(fields: Record<string, unknown>) {
  return POST(jsonReq('http://t/blog/api/draft/', { date: DATE, ...fields }));
}

describe('POST /api/draft (save)', () => {
  it('writes EN markdown file with escaped frontmatter + trimmed body', async () => {
    const res = await save({ title: 'Hello, World', tags: ['a', 'b'], description: 'd', draft: true, body: '  hi  ' });
    const data = (await res.json()) as { filename: string };
    expect(res.status).toBe(200);
    expect(data.filename).toBe('2026-06-08-hello-world.md');

    const content = await readFile(path.join(postsBase, 'en', data.filename), 'utf8');
    expect(content).toContain('title: "Hello, World"');
    expect(content).toContain('tags: ["a", "b"]');
    expect(content).toContain('draft: true');
    expect(content).toMatch(/\nhi\n$/);
  });

  it('writes pt-BR markdown file into the pt-BR locale dir', async () => {
    const res = await save({ locale: 'pt-BR', title: 'Olá Mundo', tags: [], body: 'corpo' });
    const data = (await res.json()) as { filename: string };
    expect(res.status).toBe(200);

    const content = await readFile(path.join(postsBase, 'pt-BR', data.filename), 'utf8');
    expect(content).toContain('title: "Olá Mundo"');
    // EN dir untouched
    await expect(readdir(path.join(postsBase, 'en'))).rejects.toThrow();
  });

  it('slugOverride pins the slug regardless of the translated title', async () => {
    // Simulates: editor seeds from EN "Hello World" → user translates title to
    // "Olá Mundo" but passes slugOverride='hello-world' so slugs stay in sync.
    const res = await save({ locale: 'pt-BR', title: 'Olá Mundo', tags: [], body: 'corpo', slugOverride: 'hello-world' });
    const data = (await res.json()) as { filename: string };
    expect(res.status).toBe(200);
    expect(data.filename).toBe('2026-06-08-hello-world.md');
    const content = await readFile(path.join(postsBase, 'pt-BR', data.filename), 'utf8');
    expect(content).toContain('title: "Olá Mundo"'); // translated title preserved in frontmatter
  });

  it('saving pt-BR syncs tags + date back to the EN source', async () => {
    // EN post starts with different tags.
    await save({ locale: 'en', title: 'My Post', tags: ['old'], body: 'en body', description: 'desc' });
    const newDate = '2026-06-10T12:00:00.000Z';
    await POST(jsonReq('http://t/blog/api/draft/', {
      date: newDate,
      locale: 'pt-BR',
      title: 'Meu Post',
      tags: ['new', 'tags'],
      body: 'corpo',
      slugOverride: 'my-post',
    }));
    const enContent = await readFile(path.join(postsBase, 'en', '2026-06-08-my-post.md'), 'utf8');
    expect(enContent).toContain('tags: ["new", "tags"]'); // tags synced
    expect(enContent).toContain(newDate); // date synced
    expect(enContent).toContain('title: "My Post"'); // EN title unchanged
    expect(enContent).toContain('description: "desc"'); // EN description unchanged
    expect(enContent).toContain('en body'); // EN body unchanged
  });

  it('renames in place on re-save when the title changes (no duplicate)', async () => {
    const first = (await save({ title: 'First', tags: [], draft: true, body: 'x' })).json() as Promise<{
      filename: string;
    }>;
    const { filename } = await first;
    await POST(
      jsonReq('http://t/blog/api/draft/', {
        date: DATE,
        title: 'Second',
        tags: [],
        draft: true,
        body: 'x',
        previousFilename: filename,
      }),
    );
    expect(await readdir(path.join(postsBase, 'en'))).toEqual(['2026-06-08-second.md']);
  });

  it('400s on a traversal previousFilename and on missing fields', async () => {
    const traversal = await POST(
      jsonReq('http://t/blog/api/draft/', {
        date: DATE,
        title: 'X',
        body: 'y',
        previousFilename: '../../../etc/passwd',
      }),
    );
    expect(traversal.status).toBe(400);
    expect(traversal.headers.get('Content-Type')).toBe('application/problem+json');
    expect((await traversal.json() as { detail: string }).detail).toMatch(/invalid previousFilename/);
    expect((await save({ title: 'only-title' })).status).toBe(400);
  });
});

describe('POST /api/draft/load', () => {
  it('reads a saved EN post back into editor fields', async () => {
    await save({ title: 'Round Trip', tags: ['meta'], description: 'desc', draft: true, body: 'body text' });
    const res = await loadPost(jsonReq('http://t/blog/api/draft/load/', { slug: 'round-trip', locale: 'en' }));
    const data = (await res.json()) as Record<string, unknown>;
    expect(data.title).toBe('Round Trip');
    expect(data.tags).toEqual(['meta']);
    expect(data.draft).toBe(true);
    expect(data.body).toBe('body text');
    expect(data.date).toBe(DATE);
    expect(data.seededFromEn).toBe(false);
  });

  it('reads a saved pt-BR post', async () => {
    await save({ locale: 'pt-BR', title: 'Meu Post', tags: [], body: 'conteudo' });
    const res = await loadPost(jsonReq('http://t/blog/api/draft/load/', { slug: 'meu-post', locale: 'pt-BR' }));
    const data = (await res.json()) as Record<string, unknown>;
    expect(data.title).toBe('Meu Post');
    expect(data.seededFromEn).toBe(false);
  });

  it('seeds from EN when no pt-BR file exists yet', async () => {
    await save({ locale: 'en', title: 'My Post', tags: ['t'], body: 'english body' });
    const res = await loadPost(jsonReq('http://t/blog/api/draft/load/', { slug: 'my-post', locale: 'pt-BR' }));
    const data = (await res.json()) as Record<string, unknown>;
    expect(data.title).toBe('My Post');
    expect(data.body).toBe('english body');
    expect(data.seededFromEn).toBe(true);
    expect(data.slug).toBe('my-post'); // editor uses this as slugOverride on save
    expect(data.filename).toBeUndefined(); // no savedFilename so editor won't rename EN source
  });

  it('404s for an unknown slug', async () => {
    const res = await loadPost(jsonReq('http://t/blog/api/draft/load/', { slug: 'nope' }));
    expect(res.status).toBe(404);
    expect(res.headers.get('Content-Type')).toBe('application/problem+json');
  });
});

describe('DELETE /api/draft', () => {
  it('removes the EN file for a slug', async () => {
    await save({ title: 'Bye', tags: [], draft: true, body: 'x' });
    const res = await DELETE(new Request('http://t/blog/api/draft/?slug=bye&locale=en', { method: 'DELETE' }));
    expect(((await res.json()) as { ok: boolean }).ok).toBe(true);
    expect(await readdir(path.join(postsBase, 'en'))).toEqual([]);
  });

  it('removes the pt-BR file, leaving EN untouched', async () => {
    await save({ locale: 'en', title: 'Keep', tags: [], body: 'x' });
    await save({ locale: 'pt-BR', title: 'Keep', tags: [], body: 'y' });
    const res = await DELETE(new Request('http://t/blog/api/draft/?slug=keep&locale=pt-BR', { method: 'DELETE' }));
    expect(((await res.json()) as { ok: boolean }).ok).toBe(true);
    expect(await readdir(path.join(postsBase, 'pt-BR'))).toEqual([]);
    expect(await readdir(path.join(postsBase, 'en'))).toHaveLength(1); // EN untouched
  });

  it('deleting EN cascades to the pt-BR counterpart', async () => {
    await save({ locale: 'en', title: 'Cascade', tags: [], body: 'x' });
    await save({ locale: 'pt-BR', title: 'Cascade', tags: [], body: 'y' });
    const res = await DELETE(new Request('http://t/blog/api/draft/?slug=cascade&locale=en', { method: 'DELETE' }));
    expect(((await res.json()) as { ok: boolean }).ok).toBe(true);
    expect(await readdir(path.join(postsBase, 'en'))).toEqual([]);
    expect(await readdir(path.join(postsBase, 'pt-BR'))).toEqual([]);
  });

  it('deleting EN succeeds when no pt-BR counterpart exists', async () => {
    await save({ locale: 'en', title: 'Solo', tags: [], body: 'x' });
    const res = await DELETE(new Request('http://t/blog/api/draft/?slug=solo&locale=en', { method: 'DELETE' }));
    expect(res.status).toBe(200);
    expect(await readdir(path.join(postsBase, 'en'))).toEqual([]);
  });

  it('404s and deletes nothing for a traversal slug', async () => {
    await save({ title: 'Keep', tags: [], draft: true, body: 'x' });
    const res = await DELETE(
      new Request('http://t/blog/api/draft/?slug=../../package', { method: 'DELETE' }),
    );
    expect(res.status).toBe(404);
    expect(res.headers.get('Content-Type')).toBe('application/problem+json');
    expect(await readdir(path.join(postsBase, 'en'))).toEqual(['2026-06-08-keep.md']);
  });

  it('requires slug, returning 400 problem+json', async () => {
    const res = await DELETE(new Request('http://t/blog/api/draft/', { method: 'DELETE' }));
    expect(res.status).toBe(400);
    expect(res.headers.get('Content-Type')).toBe('application/problem+json');
  });
});

// Ensure an EN file created for seeding is never deleted when the load response
// omits filename. This is behavioural: the handler itself doesn't delete — it's
// the save's previousFilename rename logic that would fire. Verify filename is
// absent in the seeded-load response.
describe('seeded pt-BR load guard', () => {
  it('omits filename in seeded response so editor cannot rename/delete EN source', async () => {
    // Write a known EN markdown file directly (simulates a committed post).
    const enDir = path.join(postsBase, 'en');
    await mkdir(enDir, { recursive: true });
    await writeFile(
      path.join(enDir, '2026-06-08-source.md'),
      '---\ntitle: "Source"\ndate: 2026-06-08T00:00:00Z\ntags: []\n---\n\nbody\n',
      'utf8',
    );

    const res = await loadPost(jsonReq('http://t/blog/api/draft/load/', { slug: 'source', locale: 'pt-BR' }));
    const data = (await res.json()) as Record<string, unknown>;
    expect(data.seededFromEn).toBe(true);
    expect(data.filename).toBeUndefined();
    // EN file still present
    expect(await readdir(enDir)).toContain('2026-06-08-source.md');
  });
});
