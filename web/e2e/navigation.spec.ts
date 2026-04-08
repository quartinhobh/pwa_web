import { test, expect } from '@playwright/test';

/**
 * Navigation smoke tests — verify core pages load without a running backend.
 * Pages should gracefully handle API errors or show loading/empty states.
 */

test('home page loads and shows content', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/quartinho/i);
  // Page renders either an event or a fallback empty state message
  const anyContent = page.locator('main, [role="main"], h1, h2').first();
  await expect(anyContent).toBeVisible();
});

test('archive page loads at /archive', async ({ page }) => {
  await page.goto('/archive');
  await expect(page).toHaveURL(/\/archive$/);
  // Should not show access denied — archive is public
  await expect(page.getByText(/acesso negado/i)).toHaveCount(0);
});

test('links page loads at /links', async ({ page }) => {
  await page.goto('/links');
  await expect(page).toHaveURL(/\/links$/);
  await expect(page.getByText(/acesso negado/i)).toHaveCount(0);
});

test('shop page loads at /lojinha', async ({ page }) => {
  await page.goto('/lojinha');
  await expect(page).toHaveURL(/\/lojinha$/);
  await expect(page.getByText(/acesso negado/i)).toHaveCount(0);
});

test('navigation from home to lojinha works', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: /lojinha/i }).click();
  await expect(page).toHaveURL(/\/lojinha$/);
});

test('unknown route redirects to /', async ({ page }) => {
  await page.goto('/this-route-does-not-exist');
  await expect(page).toHaveURL(/\/$/);
});
