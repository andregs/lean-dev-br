import { test, expect } from '@playwright/test';

// @dev-only: wanderlust-web isn't deployed anywhere yet (no infra/wanderlust
// resources, no route in prod) - the synthetic monitor's @prod-safe run would
// hit the real lean.dev.br homepage instead and fail. Retag @prod-safe once
// this ships to prod (iteration 7+).
test('shell renders chrome and mocked destinations', { tag: ['@dev-only'] }, async ({ page }) => {
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
