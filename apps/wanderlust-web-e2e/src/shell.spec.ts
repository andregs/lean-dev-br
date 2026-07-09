import { test, expect } from '@playwright/test';

// @dev-only: wanderlust-web isn't deployed anywhere yet (no infra/wanderlust
// resources, no route in prod) - the synthetic monitor's @prod-safe run would
// hit the real lean.dev.br homepage instead and fail. Retag @prod-safe once
// this ships to prod.
test('shell renders chrome and mocked destinations', { tag: ['@dev-only'] }, async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('link', { name: 'lean.dev.br — home' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Blog' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Labs' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Contact' })).toBeVisible();

  await expect(page.getByRole('heading', { name: 'Hello, Wanderlust' })).toBeVisible();
  await expect(page.getByText('Fernando de Noronha')).toBeVisible();
  await expect(page.getByText('Machu Picchu')).toBeVisible();
  await expect(page.getByText('Tierra del Fuego')).toBeVisible();
  await expect(page.getByText('27°C')).toBeVisible();

  await expect(page.getByText('GitHub')).toBeVisible();
});
