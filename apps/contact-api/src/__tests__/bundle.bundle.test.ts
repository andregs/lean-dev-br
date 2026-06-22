import { readFileSync } from 'node:fs';
import { builtinModules } from 'node:module';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Scans the built handler.cjs for bare require() calls and asserts that every
 * required module is either a Node.js built-in or an @aws-sdk/* package
 * (the only npm packages the Lambda runtime provides).
 *
 * Fails if a third-party dep is accidentally left external — the exact bug that
 * caused the @openfeature/server-sdk 500 in production.
 */
describe('handler.cjs bundle artifact', () => {
  const distPath = resolve(import.meta.dirname, '../../dist/handler.cjs');

  let source: string;
  try {
    source = readFileSync(distPath, 'utf-8');
  } catch {
    throw new Error(
      `dist/handler.cjs not found at ${distPath}. Run 'pnpm exec nx build contact-api' first.`,
    );
  }

  const allRequires = [...source.matchAll(/require\("([^"]+)"\)/g)].map((m) => m[1]);

  const runtimeAllowed = new Set([...builtinModules, ...builtinModules.map((m) => `node:${m}`)]);

  const forbidden = allRequires.filter(
    (id) => !runtimeAllowed.has(id) && !id.startsWith('@aws-sdk/'),
  );

  it('has no external requires outside the Lambda runtime allowlist', () => {
    expect(
      forbidden,
      `Forbidden external require()s found in dist/handler.cjs:\n  ${forbidden.join('\n  ')}\n\nAdd "thirdParty": true to the esbuild target so these are bundled.`,
    ).toEqual([]);
  });
});
