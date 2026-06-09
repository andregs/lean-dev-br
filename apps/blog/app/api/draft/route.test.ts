import { mkdir, mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DELETE, POST } from './route';
import { POST as loadPost } from './load/route';

// The handlers resolve content/posts under process.cwd(); point that at a temp
// dir so the real working tree is untouched.
let tmp: string;
let posts: string;

beforeEach(async () => {
  tmp = await mkdtemp(path.join(os.tmpdir(), 'blog-route-'));
  posts = path.join(tmp, 'content', 'posts');
  await mkdir(posts, { recursive: true });
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
  it('writes a markdown file with escaped frontmatter + trimmed body', async () => {
    const res = await save({ title: 'Hello, World', tags: ['a', 'b'], description: 'd', draft: true, body: '  hi  ' });
    const data = (await res.json()) as { filename: string };
    expect(res.status).toBe(200);
    expect(data.filename).toBe('2026-06-08-hello-world.md');

    const content = await readFile(path.join(posts, data.filename), 'utf8');
    expect(content).toContain('title: "Hello, World"');
    expect(content).toContain('tags: ["a", "b"]');
    expect(content).toContain('draft: true');
    expect(content).toMatch(/\nhi\n$/);
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
    expect(await readdir(posts)).toEqual(['2026-06-08-second.md']);
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
    expect((await save({ title: 'only-title' })).status).toBe(400);
  });
});

describe('POST /api/draft/load', () => {
  it('reads a saved post back into editor fields', async () => {
    await save({ title: 'Round Trip', tags: ['meta'], description: 'desc', draft: true, body: 'body text' });
    const res = await loadPost(jsonReq('http://t/blog/api/draft/load/', { slug: 'round-trip' }));
    const data = (await res.json()) as Record<string, unknown>;
    expect(data.title).toBe('Round Trip');
    expect(data.tags).toEqual(['meta']);
    expect(data.draft).toBe(true);
    expect(data.body).toBe('body text');
    expect(data.date).toBe(DATE);
  });

  it('404s for an unknown slug', async () => {
    const res = await loadPost(jsonReq('http://t/blog/api/draft/load/', { slug: 'nope' }));
    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/draft', () => {
  it('removes the file for a slug', async () => {
    await save({ title: 'Bye', tags: [], draft: true, body: 'x' });
    const res = await DELETE(new Request('http://t/blog/api/draft/?slug=bye', { method: 'DELETE' }));
    expect(((await res.json()) as { ok: boolean }).ok).toBe(true);
    expect(await readdir(posts)).toEqual([]);
  });

  it('404s and deletes nothing for a traversal slug', async () => {
    await save({ title: 'Keep', tags: [], draft: true, body: 'x' });
    const res = await DELETE(
      new Request('http://t/blog/api/draft/?slug=../../package', { method: 'DELETE' }),
    );
    expect(res.status).toBe(404);
    expect(await readdir(posts)).toEqual(['2026-06-08-keep.md']);
  });
});
