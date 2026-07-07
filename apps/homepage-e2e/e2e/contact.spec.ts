import { test, expect } from '@playwright/test';

test('contact form renders required fields', { tag: ['@prod-safe'] }, async ({ page }) => {
  await page.goto('/contact');
  await expect(page.locator('.contact-form')).toBeVisible();
  await expect(page.locator('textarea[name="message"]')).toHaveAttribute('required');
  await expect(page.locator('button.submit')).toBeVisible();
  // Non-stubbed interactivity check: the monitor confirms the real page is
  // usable without sending mail or depending on Google's reCAPTCHA uptime.
  await expect(page.locator('button.submit')).toBeEnabled();
  await expect(page.locator('textarea[name="message"]')).toBeEditable();
});

// @dev-only: this test stubs both reCAPTCHA and /api/contact, so it never
// exercises the real contact pipeline — running it against prod would be a
// false confidence check, not a real one. It also races main.js's flags.json
// re-render (see below), which only localhost's fixed dev-server latency
// makes reliably reproducible; on prod the race is a coin flip per request.
test(
  'contact form submit sends request and shows success',
  { tag: ['@dev-only'] },
  async ({ page }) => {
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

    // main.js re-renders #app once /flags.json resolves, tearing down and
    // rebuilding the form (and its listeners) in the process. Waiting for that
    // response before interacting avoids racing the click against a form that
    // is mid-teardown — see main.js's isFormSubmitting() comment for the same
    // concern from the submit side.
    const flagsSettled = page.waitForResponse('**/flags.json');
    await page.goto('/contact');
    await flagsSettled;

    await page.fill('textarea[name="message"]', 'Playwright smoke test — safe to ignore.');
    await page.click('button.submit');

    // setStatus() sets data-state="ok" on the status paragraph on success
    await expect(page.locator('.form-status[data-state="ok"]')).toBeVisible({ timeout: 8_000 });
  },
);
