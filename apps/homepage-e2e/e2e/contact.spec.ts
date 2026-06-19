import { test, expect } from '@playwright/test';

test('contact form renders required fields', { tag: ['@prod-safe'] }, async ({ page }) => {
  await page.goto('/contact');
  await expect(page.locator('.contact-form')).toBeVisible();
  await expect(page.locator('textarea[name="message"]')).toHaveAttribute('required');
  await expect(page.locator('button.submit')).toBeVisible();
});

test('contact form submit sends request and shows success', { tag: ['@prod-safe'] }, async ({ page }) => {

  // Intercept the reCAPTCHA v3 script; return a stub that sets window.grecaptcha.
  // Must be registered before navigation so it catches the warmup load in contact-form.js.
  await page.route('**/recaptcha/api.js**', async (route) => {
    await route.fulfill({
      contentType: 'text/javascript',
      body: 'window.grecaptcha={ready:function(cb){cb();},execute:function(){return Promise.resolve("test-token");}};',
    });
  });

  // Stub the Lambda endpoint — no real SES email sent during tests.
  await page.route('**/api/contact', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true }),
    });
  });

  await page.goto('/contact');
  await page.fill('textarea[name="message"]', 'Playwright smoke test — safe to ignore.');
  await page.click('button.submit');

  // setStatus() sets data-state="ok" on the status paragraph on success
  await expect(page.locator('.form-status[data-state="ok"]')).toBeVisible({ timeout: 8_000 });
});
