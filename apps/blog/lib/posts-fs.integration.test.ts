// Integration: bind the authoring fs layer to the real committed content tree.
// Simulates the next dev environment by pointing cwd at the actual project root
// (apps/blog/) — the same value process.cwd() has in the real dev server.
//
// Any divergence between postsDir() and the on-disk content/posts/{locale}/
// convention becomes a CI failure here. The companion unit test (posts-fs.test.ts)
// covers the pure matchPostFilename logic separately.

import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { filenameForSlug, postsDir } from './posts-fs';

// Resolve the project root (apps/blog/) from this file's location (lib/).
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

beforeAll(() => {
  // Vitest cwd is the workspace root. Override to match next dev behaviour.
  vi.spyOn(process, 'cwd').mockReturnValue(projectRoot);
});

afterAll(() => {
  vi.restoreAllMocks();
});

describe('posts-fs — real content tree binding', () => {
  it('postsDir("en") resolves to the committed en locale dir', () => {
    const dir = postsDir('en');
    expect(dir).toMatch(/content[\\/]posts[\\/]en$/);
    expect(existsSync(dir), `Directory does not exist: ${dir}`).toBe(true);
  });

  it('postsDir("pt-BR") resolves to the pt-BR locale dir under project root', () => {
    const dir = postsDir('pt-BR');
    expect(dir.endsWith(path.join('content', 'posts', 'pt-BR'))).toBe(true);
    // Dir may not exist yet if no pt-BR posts are committed — the handler
    // creates it on first save. We validate the path shape, not existence.
    expect(dir.startsWith(projectRoot)).toBe(true);
  });

  it('filenameForSlug resolves a known committed EN slug', async () => {
    // "hello-world" lives at content/posts/en/2026-06-07-hello-world.md.
    // If this fails, either the file was removed or postsDir() no longer
    // points at content/posts/{locale}/ — update both that file and posts-fs.ts.
    const filename = await filenameForSlug('hello-world', 'en');
    expect(filename, 'Known EN post not found — check content/posts/en/ and postsDir()').toBeDefined();
    expect(filename).toMatch(/hello-world\.md$/);
  });

  it('filenameForSlug returns undefined for a non-existent slug', async () => {
    expect(await filenameForSlug('no-such-post-xyz', 'en')).toBeUndefined();
  });

  it('postsDir path is inside the project root, not the monorepo root', () => {
    const dir = postsDir('en');
    expect(dir.startsWith(projectRoot), `Expected ${dir} to start with ${projectRoot}`).toBe(true);
  });
});
