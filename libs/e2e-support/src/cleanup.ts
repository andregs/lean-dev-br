import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { glob } from 'node:fs/promises';
import { join } from 'node:path';

const MANIFEST_PATH = join(process.cwd(), 'test-results', 'e2e-manifest.json');

interface Manifest {
  blogSlugs: string[];
  relayRooms: string[];
}

function readManifest(): Manifest {
  if (!existsSync(MANIFEST_PATH)) return { blogSlugs: [], relayRooms: [] };
  return JSON.parse(readFileSync(MANIFEST_PATH, 'utf-8')) as Manifest;
}

function writeManifest(m: Manifest): void {
  writeFileSync(MANIFEST_PATH, JSON.stringify(m, null, 2));
}

export function recordBlogSlug(slug: string): void {
  const m = readManifest();
  if (!m.blogSlugs.includes(slug)) m.blogSlugs.push(slug);
  writeManifest(m);
}

export function recordRelayRoom(roomId: string): void {
  const m = readManifest();
  if (!m.relayRooms.includes(roomId)) m.relayRooms.push(roomId);
  writeManifest(m);
}

/**
 * Post-run teardown: deletes blog drafts recorded in the manifest.
 * Backstop for crashes where inline cleanup in tests didn't complete.
 */
export async function teardownBlogDrafts(blogApiBase: string): Promise<void> {
  const m = readManifest();
  for (const slug of m.blogSlugs) {
    await fetch(`${blogApiBase}/api/draft/?slug=${encodeURIComponent(slug)}&locale=en`, {
      method: 'DELETE',
    }).catch(() => undefined);
  }
}

/**
 * Pre-run sweeper: deletes any stale e2e- blog drafts regardless of manifest.
 * Cascade delete (en → pt-BR) is handled by the API itself.
 */
export async function sweepStaleBlogDrafts(blogApiBase: string): Promise<void> {
  const contentDir = join(process.cwd(), 'apps', 'blog', 'content', 'posts');
  const files: string[] = [];
  for await (const entry of glob('**/*.md', { cwd: contentDir })) {
    if (entry.includes('e2e-')) files.push(entry);
  }
  for (const file of files) {
    // filename: YYYY-MM-DD-{slug}.md  → extract slug after date part
    const slug = file.replace(/^\d{4}-\d{2}-\d{2}-/, '').replace(/\.md$/, '');
    const locale = file.startsWith('pt-BR/') ? 'pt-BR' : 'en';
    await fetch(`${blogApiBase}/api/draft?slug=${slug}&locale=${locale}`, {
      method: 'DELETE',
    });
  }
}
