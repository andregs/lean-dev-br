import { test, expect } from '@playwright/test';
import { testPrefix, recordBlogSlug } from '@lean-dev-br/e2e-support';
import { blogPath } from '../playwright.config';

// Editor API routes (`/blog/api/draft/*`) exist only under `next dev`
// (`blockInProduction()` returns 404 in production). Tag @dev-only so the
// nightly prod monitor skips these tests.

test('editor page renders form fields', { tag: ['@dev-only'] }, async ({ page }) => {
  await page.goto(blogPath('/editor'));
  await expect(page.locator('#title')).toBeVisible();
  await expect(page.locator('button:has-text("Save")')).toBeVisible();
  await expect(page.locator('.w-md-editor')).toBeVisible({ timeout: 15_000 });
});

test(
  'draft API: create en, create pt-BR, cascade delete',
  { tag: ['@dev-only'] },
  async ({ page }) => {
    const slug = `${testPrefix()}-editor-spec`;
    const now = new Date().toISOString();
    const draftApiBase = blogPath('/api/draft') + '/';

    // --- create EN draft with a pinned slug ---
    const enRes = await page.request.post(draftApiBase, {
      data: {
        locale: 'en',
        title: slug.replace(/-/g, ' '),
        date: now,
        body: '# E2E\n\nPlaceholder.',
        slugOverride: slug,
      },
    });
    expect(enRes.status()).toBe(200);
    const enBody = (await enRes.json()) as { ok: boolean; filename: string };
    expect(enBody.ok).toBe(true);
    expect(enBody.filename).toContain(slug);
    recordBlogSlug(slug);

    // --- create pt-BR draft sharing the same slug ---
    const ptRes = await page.request.post(draftApiBase, {
      data: {
        locale: 'pt-BR',
        title: `${slug} pt`,
        date: now,
        body: '# E2E (pt-BR)\n\nConteúdo de teste.',
        slugOverride: slug,
      },
    });
    expect(ptRes.status()).toBe(200);
    const ptBody = (await ptRes.json()) as { ok: boolean; filename: string };
    expect(ptBody.ok).toBe(true);

    // --- delete EN → should cascade-delete pt-BR ---
    const delRes = await page.request.delete(draftApiBase, {
      params: { slug, locale: 'en' },
    });
    expect(delRes.status()).toBe(200);
    const delBody = (await delRes.json()) as { ok: boolean };
    expect(delBody.ok).toBe(true);

    // --- pt-BR should be gone (second delete returns 404) ---
    const ptDelRes = await page.request.delete(draftApiBase, {
      params: { slug, locale: 'pt-BR' },
    });
    expect(ptDelRes.status()).toBe(404);
  },
);
