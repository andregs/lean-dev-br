import { test, expect } from '@playwright/test';

test('pt-BR path prefix renders Portuguese content', { tag: ['@prod-safe'] }, async ({ page }) => {
  await page.goto('/pt-BR');
  await expect(page.locator('html')).toHaveAttribute('lang', 'pt-BR');
  await expect(page.locator('.hero h1')).toContainText('Olá');
});

test('English path renders English content', { tag: ['@prod-safe'] }, async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.locator('.hero h1')).toContainText('Hi');
});

test('lang toggle navigates to /pt-BR, saves preference, switches content', { tag: ['@prod-safe'] }, async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');

  await page.click('button[data-lang-toggle]');

  // onToggle calls pushState('/pt-BR') then re-renders
  await expect(page).toHaveURL(/\/pt-BR$/);
  await expect(page.locator('html')).toHaveAttribute('lang', 'pt-BR');
  await expect(page.locator('.hero h1')).toContainText('Olá');

  const stored = await page.evaluate(() => localStorage.getItem('lean:locale'));
  expect(stored).toBe('pt-BR');
});

test('hreflang tags update when navigating to /pt-BR', { tag: ['@prod-safe'] }, async ({ page }) => {
  await page.goto('/pt-BR');
  // updateHreflang('/pt-BR') sets pt-BR href to origin/pt-BR and en href to origin/
  await expect(page.locator('link[hreflang="pt-BR"]')).toHaveAttribute('href', /lean\.dev\.br\/pt-BR$/);
  await expect(page.locator('link[hreflang="en"]')).toHaveAttribute('href', /lean\.dev\.br\/$/);
  await expect(page.locator('link[hreflang="x-default"]')).toHaveAttribute('href', /lean\.dev\.br\/$/);
});
