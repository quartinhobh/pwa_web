import { test, expect } from '@playwright/test';

/**
 * Admin flow (P6-S4) — logs in via /__dev-login then verifies the admin
 * surfaces are reachable. Full create/moderate/upload round-trips require
 * a live API + emulators; this suite pins the UI gating and navigation.
 */

const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? 'admin@quartinho.local';
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? 'quartinho-dev-local-2026';

async function devLogin(page: import('@playwright/test').Page, next = '/admin') {
  const qs = new URLSearchParams({
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
    next,
  });
  await page.goto(`/__dev-login?${qs.toString()}`);
  await expect(page).toHaveURL(new RegExp(next.replace(/\//g, '\\/') + '$'), {
    timeout: 15_000,
  });
}

test.describe('admin gating', () => {
  test('non-admin cannot reach admin panel UI', async ({ page }) => {
    await page.goto('/admin');
    await expect(page.getByRole('heading', { name: /acesso negado/i })).toBeVisible();
  });

  test('logged-in admin escapes the gate', async ({ page }) => {
    await devLogin(page, '/admin');
    await expect(page.getByRole('heading', { name: /acesso negado/i })).toHaveCount(0);
  });
});
