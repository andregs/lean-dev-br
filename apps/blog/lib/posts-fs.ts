// Dev-only filesystem helpers for the authoring routes (save/load/delete). Kept
// out of lib/posts.ts so the static site never imports node:fs.
import { readdir } from 'node:fs/promises';
import path from 'node:path';

export function postsDir(): string {
  return path.join(process.cwd(), 'content', 'posts');
}

/** Resolve a post slug to its on-disk filename (the slug drops the date prefix). */
export async function filenameForSlug(slug: string): Promise<string | undefined> {
  const files = await readdir(postsDir());
  return files.find(
    (file) =>
      file.endsWith('.md') && file.replace(/^\d{4}-\d{2}-\d{2}-/, '').replace(/\.md$/, '') === slug,
  );
}
