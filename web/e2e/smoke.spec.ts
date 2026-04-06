import { test, expect } from '@playwright/test';

test('shell renders with header + logo + lojinha link', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/quartinho/i);
  await expect(page.getByRole('heading', { name: /quartinho/i }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: /lojinha/i })).toBeVisible();
});

test('navigates to /lojinha and back', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: /lojinha/i }).click();
  await expect(page).toHaveURL(/\/lojinha$/);
  await page.getByRole('link', { name: /quartinho/i }).first().click();
  await expect(page).toHaveURL(/\/$/);
});

test('navigates to /archive via "eventos passados" link', async ({ page }) => {
  await page.goto('/');
  const link = page.getByRole('link', { name: /eventos passados/i });
  if (await link.isVisible()) {
    await link.click();
    await expect(page).toHaveURL(/\/archive$/);
  }
});

test('unknown route redirects to /', async ({ page }) => {
  await page.goto('/does-not-exist');
  await expect(page).toHaveURL(/\/$/);
});

test('admin page without auth shows acesso negado', async ({ page }) => {
  await page.goto('/admin');
  await expect(page.getByRole('heading', { name: /acesso negado/i })).toBeVisible();
});
