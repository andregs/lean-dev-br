// Static invariant: every app/**/page.tsx must resolve to exactly one ancestor
// layout.tsx that emits an <html> element. Zero means the page has no root
// layout (the bug that caused the missing-<html>/<body> overlay); more than one
// means nested <html> trees.
//
// This catches regressions that next build cannot — editor and other dev-only
// pages are excluded from the production static export and therefore never
// rendered by `output: export`.

import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// This file lives at app/route-layout.invariant.test.ts, so __dirname = app/.
const appDir = path.dirname(fileURLToPath(import.meta.url));

// Non-page special files that coexist with page.tsx naming but aren't RSC pages.
const EXCLUDED_NAMES = new Set(['route.ts', 'route.tsx', 'sitemap.ts', 'opengraph-image.tsx']);

function walkPages(dir: string): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      results.push(...walkPages(path.join(dir, entry.name)));
    } else if (entry.name === 'page.tsx' && !EXCLUDED_NAMES.has(entry.name)) {
      results.push(path.join(dir, entry.name));
    }
  }
  return results;
}

/** Walk ancestor dirs from pageDir up to (and including) appDir, collect
 *  layout.tsx files whose source contains `<html`. */
function findHtmlLayouts(pageFile: string): string[] {
  const htmlLayouts: string[] = [];
  let dir = path.dirname(pageFile);
  for (;;) {
    try {
      const src = readFileSync(path.join(dir, 'layout.tsx'), 'utf-8');
      if (src.includes('<html')) htmlLayouts.push(path.join(dir, 'layout.tsx'));
    } catch {
      // no layout at this level
    }
    if (dir === appDir) break;
    dir = path.dirname(dir);
  }
  return htmlLayouts;
}

const pages = walkPages(appDir);

describe('route layout invariant', () => {
  it('finds at least one page.tsx in app/', () => {
    expect(pages.length).toBeGreaterThan(0);
  });

  for (const page of pages) {
    const rel = path.relative(appDir, page);
    it(`${rel} resolves to exactly one root layout with <html>`, () => {
      const layouts = findHtmlLayouts(page);
      expect(
        layouts.length,
        layouts.length === 0
          ? `No ancestor layout.tsx has <html>. Move this page inside a route group that owns a root layout (e.g. app/(en)/…).`
          : `Multiple ancestor layouts have <html>: ${layouts.join(', ')}. Nested <html> trees will break rendering.`,
      ).toBe(1);
    });
  }
});
