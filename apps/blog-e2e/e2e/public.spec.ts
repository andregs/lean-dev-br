import { test, expect } from '@playwright/test';
import { blogPath } from '../playwright.config';

test('blog index lists posts', { tag: ['@prod-safe'] }, async ({ page }) => {
  await page.goto(blogPath('/'));
  await expect(page.locator('ul.post-list')).toBeVisible();
  await expect(page.locator('a.post-title').first()).toBeVisible();
});

test('post page loads from list link', { tag: ['@prod-safe'] }, async ({ page }) => {
  await page.goto(blogPath('/'));
  const firstPost = page.locator('a.post-title').first();
  const href = await firstPost.getAttribute('href');
  await firstPost.click();
  await expect(page).toHaveURL(new RegExp(href ?? '/'));
  await expect(page.locator('h1')).toBeVisible();
});

test('hello-world post loads directly', { tag: ['@prod-safe'] }, async ({ page }) => {
  await page.goto(blogPath('/hello-world/'));
  await expect(page.locator('h1')).toBeVisible();
});

test('tags page lists posts', { tag: ['@prod-safe'] }, async ({ page }) => {
  // Navigate from post to its tag page
  await page.goto(blogPath('/hello-world/'));
  const tagLink = page.locator('a[href*="/tags/"]').first();
  await expect(tagLink).toBeVisible();
  await tagLink.click();
  await expect(page.locator('ul.post-list')).toBeVisible();
});

test('feed.xml returns XML content', { tag: ['@prod-safe'] }, async ({ page }) => {
  const res = await page.request.get(blogPath('/feed.xml'));
  expect(res.status()).toBe(200);
  expect(res.headers()['content-type']).toMatch(/xml/);
  const body = await res.text();
  expect(body).toContain('<rss');
});

test('pt-BR index renders Portuguese heading', { tag: ['@prod-safe'] }, async ({ page }) => {
  await page.goto(blogPath('/pt-BR'));
  await expect(page.locator('ul.post-list')).toBeVisible();
  // html lang attribute should be pt-BR
  await expect(page.locator('html')).toHaveAttribute('lang', 'pt-BR');
});
