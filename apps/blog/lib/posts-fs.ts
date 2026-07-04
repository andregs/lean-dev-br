// Dev-only filesystem helpers for the authoring routes (save/load/delete). Kept
// out of lib/posts.ts so the static site never imports node:fs.
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { slugFromFilename } from './draft';

export type PostLocale = 'en' | 'pt-BR';

export function postsDir(locale: PostLocale = 'en'): string {
  return path.join(process.cwd(), 'content', 'posts', locale);
}

/** Pure: pick the `.md` file in `files` whose slug matches (no fs). */
export function matchPostFilename(files: readonly string[], slug: string): string | undefined {
  return files.find((file) => file.endsWith('.md') && slugFromFilename(file) === slug);
}

/** Resolve a post slug to its on-disk filename within the given locale dir.
 *  Returns undefined if the dir doesn't exist yet (first save creates it). */
export async function filenameForSlug(
  slug: string,
  locale: PostLocale = 'en',
): Promise<string | undefined> {
  try {
    return matchPostFilename(await readdir(postsDir(locale)), slug);
  } catch {
    return undefined;
  }
}
