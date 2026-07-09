import { test, expect } from '@playwright/test';

test('shell renders chrome and mocked destinations', { tag: ['@prod-safe'] }, async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('link', { name: 'lean.dev.br — home' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Blog' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Labs' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Contact' })).toBeVisible();

  await expect(page.getByRole('heading', { name: 'Hello, Wanderlust' })).toBeVisible();
  await expect(page.getByText('Lisbon')).toBeVisible();
  await expect(page.getByText('Kyoto')).toBeVisible();
  await expect(page.getByText('Reykjavik')).toBeVisible();

  await expect(page.getByText('GitHub')).toBeVisible();
});
