import { test, expect } from '@playwright/test';

/**
 * Smoke — shell loads, header + tab nav render, routing works without auth.
 * Backend-dependent assertions (event list, vote tallies) live in the
 * guest/auth/admin spec files and require the emulator suite to be running.
 */

test('shell renders with zine header and tab nav', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/quartinho/i);
  await expect(page.getByRole('heading', { name: /quartinho/i }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: /ouvir/i })).toBeVisible();
  await expect(page.getByRole('link', { name: /arquivo/i })).toBeVisible();
  await expect(page.getByRole('link', { name: /admin/i })).toBeVisible();
});

test('navigates to /archive and back', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: /arquivo/i }).click();
  await expect(page).toHaveURL(/\/archive$/);
  await page.getByRole('link', { name: /ouvir/i }).click();
  await expect(page).toHaveURL(/\/$/);
});

test('unknown route redirects to /', async ({ page }) => {
  await page.goto('/does-not-exist');
  await expect(page).toHaveURL(/\/$/);
});

test('admin page without auth shows acesso negado', async ({ page }) => {
  await page.goto('/admin');
  await expect(page.getByRole('heading', { name: /acesso negado/i })).toBeVisible();
});
