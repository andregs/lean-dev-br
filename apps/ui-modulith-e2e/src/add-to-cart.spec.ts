import { test, expect } from '@playwright/test';
import { labPath } from '../playwright.config';

test('catalog renders products from the mocked API', { tag: ['@prod-safe'] }, async ({ page }) => {
  await page.goto(labPath('/catalog'));
  await expect(page.getByRole('link', { name: 'Super Widget' })).toBeVisible();
  await expect(page.getByText('$29.99')).toBeVisible();
});

test(
  'add to cart from the catalog list updates the badge and cart page',
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
  'items added before visiting /cart are still there once it loads',
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
