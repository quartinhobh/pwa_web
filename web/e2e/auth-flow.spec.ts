import { test, expect } from '@playwright/test';

/**
 * Auth flow (P6-S3) — exercises the dev-login route (`/__dev-login`) which
 * is mounted only when `import.meta.env.DEV` is true. The route hits the
 * Auth emulator via `signInWithEmailAndPassword`, no Google popup needed.
 *
 * Requires:
 *   - Firebase emulator suite running: `bun run emulators:up`
 *   - API running in emulator mode: `bun run --filter=api dev`
 *   - Seed executed:                 `bun run seed`
 *   - `.env.seed` with SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD
 */

const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? 'admin@quartinho.local';
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? 'quartinho-dev-local-2026';

test.describe('auth', () => {
  test('admin gate is enforced for logged-out users', async ({ page }) => {
    await page.goto('/admin');
    await expect(page.getByRole('heading', { name: /acesso negado/i })).toBeVisible();
  });

  test('dev-login lands on /admin and reveals AdminPanel', async ({ page }) => {
    const qs = new URLSearchParams({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      next: '/admin',
    });
    await page.goto(`/__dev-login?${qs.toString()}`);
    await expect(page).toHaveURL(/\/admin$/, { timeout: 15_000 });
    // AdminPanel exposes an "events" section heading in P3-H. If the API isn't
    // running, the store still updates role=admin and we escape the gate.
    await expect(page.getByText(/acesso negado/i)).toHaveCount(0);
  });

  test('dev-login without params shows error', async ({ page }) => {
    await page.goto('/__dev-login');
    await expect(page.getByTestId('dev-login-status')).toContainText(
      /missing email or password/i,
    );
  });
});
