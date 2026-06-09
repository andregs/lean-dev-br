// Dev-only filesystem helpers for the authoring routes (save/load/delete). Kept
// out of lib/posts.ts so the static site never imports node:fs.
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { slugFromFilename } from './draft';

export function postsDir(): string {
  return path.join(process.cwd(), 'content', 'posts');
}

/** Pure: pick the `.md` file in `files` whose slug matches (no fs). */
export function matchPostFilename(files: readonly string[], slug: string): string | undefined {
  return files.find((file) => file.endsWith('.md') && slugFromFilename(file) === slug);
}

/** Resolve a post slug to its on-disk filename (the slug drops the date prefix). */
export async function filenameForSlug(slug: string): Promise<string | undefined> {
  return matchPostFilename(await readdir(postsDir()), slug);
}
