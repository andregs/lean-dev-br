import { test, expect } from '@playwright/test';
import { labPath } from '../playwright.config';

test('catalog renders products from the mocked API', { tag: ['@prod-safe'] }, async ({ page }) => {
  await page.goto(labPath('/catalog'));
  await expect(page.getByRole('link', { name: 'Super Widget' })).toBeVisible();
  await expect(page.getByText('$29.99')).toBeVisible();
});

test(
  'add to cart from the catalog list updates the badge and cart page — crossing the catalog then cart remote boundary',
  { tag: ['@prod-safe'] },
  async ({ page }) => {
    await page.goto(labPath('/catalog'));

    const widgetCard = page.getByRole('listitem').filter({ hasText: 'Super Widget' });
    await widgetCard.getByRole('button', { name: 'Add to cart' }).click();

    const cartLink = page.getByRole('link', { name: /cart/i });
    await expect(cartLink).toContainText('1');

    await cartLink.click();
    await expect(page).toHaveURL(new RegExp(`${labPath('/cart')}$`));
    await expect(page.getByText('Super Widget')).toBeVisible();
    await expect(page.getByText('Total: $29.99')).toBeVisible();
  },
);

test(
  'add to cart from the product detail page shows the confirmation state',
  { tag: ['@prod-safe'] },
  async ({ page }) => {
    await page.goto(labPath('/catalog/WIDGET-001'));

    const addButton = page.getByRole('button', { name: 'Add to cart' });
    await addButton.click();

    await expect(page.getByRole('button', { name: /added/i })).toBeDisabled();
  },
);

test(
  'items added before visiting /cart are still there once it loads — the kernel EventBus replay crossing a remote boundary',
  { tag: ['@prod-safe'] },
  async ({ page }) => {
    await page.goto(labPath('/catalog'));

    await page
      .getByRole('listitem')
      .filter({ hasText: 'Power Gadget' })
      .getByRole('button', { name: 'Add to cart' })
      .click();
    await page
      .getByRole('listitem')
      .filter({ hasText: 'Deluxe Doohickey' })
      .getByRole('button', { name: 'Add to cart' })
      .click();

    await page.getByRole('link', { name: /cart/i }).click();

    await expect(page.getByText('Power Gadget')).toBeVisible();
    await expect(page.getByText('Deluxe Doohickey')).toBeVisible();
    await expect(page.getByText('Total: $64.98')).toBeVisible();
  },
);

test(
  'a direct navigation to /catalog renders the shell-routed page, not the remote bucket standalone entry',
  { tag: ['@prod-safe'] },
  async ({ page }) => {
    // Regression test: catalog/cart's CloudFront cache behaviors are scoped to
    // assets/* and remoteEntry.js only — a bare /labs/federation/catalog request
    // must fall through to the shell's own catch-all instead of hitting the
    // remote's bucket (which only has its own "view through the shell" entry).
    await page.goto(labPath('/catalog'));
    await expect(page.getByRole('heading', { name: 'Catalog' })).toBeVisible();
    await expect(page.getByText('view it through the shell')).toHaveCount(0);
  },
);
