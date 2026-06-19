import { test, expect } from '@playwright/test';

test('homepage loads with hero heading', { tag: ['@prod-safe'] }, async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.hero h1')).toBeVisible();
});

test('nav links to /blog, /labs, /contact', { tag: ['@prod-safe'] }, async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('a[href="/blog/"]')).toBeVisible();
  await expect(page.locator('a[href="/labs"]')).toBeVisible();
  await expect(page.locator('a[href="/contact"]')).toBeVisible();
});

test('footer GitHub link is external and safe', { tag: ['@prod-safe'] }, async ({ page }) => {
  await page.goto('/');
  const link = page.locator('.footer-link[href*="github.com"]');
  await expect(link).toBeVisible();
  await expect(link).toHaveAttribute('target', '_blank');
  await expect(link).toHaveAttribute('rel', 'noopener');
});

test('hreflang alternate tags in <head>', { tag: ['@prod-safe'] }, async ({ page }) => {
  await page.goto('/');
  // en canonical
  const enLink = page.locator('link[hreflang="en"]');
  await expect(enLink).toHaveAttribute('href', /lean\.dev\.br/);
  // pt-BR alternate
  const ptLink = page.locator('link[hreflang="pt-BR"]');
  await expect(ptLink).toHaveAttribute('href', /lean\.dev\.br.*pt-BR/);
  // x-default
  await expect(page.locator('link[hreflang="x-default"]')).toHaveCount(1);
});

test('/labs route renders without 404', { tag: ['@prod-safe'] }, async ({ page }) => {
  await page.goto('/labs');
  await expect(page.locator('#app')).not.toBeEmpty();
  // lang-toggle should still be in nav (SPA shell stays)
  await expect(page.locator('button[data-lang-toggle]')).toBeVisible();
});

test('unknown path shows not-found view', { tag: ['@prod-safe'] }, async ({ page }) => {
  const response = await page.goto('/this-path-does-not-exist');
  // Static host may 404 or SPA router catches it — either way the app renders a not-found message
  await expect(page.locator('#app')).toContainText(/not.found|404|page.*not.*exist/i);
  // Network response may be 200 (SPA) or 404 (static host) — accept both
  expect([200, 404]).toContain(response?.status() ?? 200);
});
