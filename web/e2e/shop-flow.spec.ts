import { test, expect, type Page } from '@playwright/test';

const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? 'admin@quartinho.local';
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? 'quartinho-dev-local-2026';
const API_URL = process.env.E2E_API_URL ?? 'http://localhost:3001';
const AUTH_EMULATOR = process.env.E2E_AUTH_EMULATOR_HOST ?? 'http://localhost:9099';

async function mintToken(page: Page): Promise<string> {
  const res = await page.request.post(
    `${AUTH_EMULATOR}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake`,
    { data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD, returnSecureToken: true } },
  );
  return ((await res.json()) as { idToken: string }).idToken;
}

async function devLogin(page: Page, next = '/admin') {
  const qs = new URLSearchParams({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD, next });
  await page.goto(`/__dev-login?${qs}`);
  await page.waitForURL((u) => u.pathname === next, { timeout: 15_000 });
}

test.describe('shop — admin CRUD + public page', () => {
  test('admin configures PIX, adds product, public page shows both', async ({ page }) => {
    const token = await mintToken(page);

    // 1. Configure PIX via API
    const pixRes = await page.request.put(`${API_URL}/shop/pix`, {
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      data: { key: 'e2e@pix.test', beneficiary: 'E2E Quartinho', city: 'BH' },
    });
    expect(pixRes.status()).toBe(200);

    // 2. Add product via API
    const prodRes = await page.request.post(`${API_URL}/shop/products`, {
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      data: { emoji: '🧪', name: `E2E Product ${Date.now()}`, description: 'test item', price: 999 },
    });
    expect(prodRes.status()).toBe(201);
    const { product } = (await prodRes.json()) as { product: { id: string; name: string } };

    // 3. Public /lojinha shows product + PIX
    await page.goto('/lojinha');
    await expect(page.getByText(product.name)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('🧪')).toBeVisible();
    await expect(page.getByText(/pagar com pix/i)).toBeVisible();
    await expect(page.getByText('e2e@pix.test')).toBeVisible();

    // 4. Cleanup
    await page.request.delete(`${API_URL}/shop/products/${product.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  });

  test('admin adds product via UI form', async ({ page }) => {
    await devLogin(page, '/admin');

    // Navigate to Lojinha tab
    await page.getByRole('tab', { name: /lojinha/i }).click();
    await expect(page.getByText(/adicionar produto/i)).toBeVisible({ timeout: 10_000 });

    const uniqueName = `UI Product ${Date.now()}`;
    await page.getByPlaceholder('emoji').fill('📦');
    await page.getByPlaceholder('Nome').fill(uniqueName);
    await page.getByPlaceholder('Descrição').fill('criado pelo E2E');
    await page.getByPlaceholder('Preço').fill('15,00');
    await page.getByRole('button', { name: /^adicionar$/ }).click();

    // Product appears in admin list
    await expect(page.getByText(uniqueName)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('📦')).toBeVisible();

    // Product appears on public page
    await page.goto('/lojinha');
    await expect(page.getByText(uniqueName)).toBeVisible({ timeout: 10_000 });
  });

  test('/lojinha shows "em breve" when no products and no PIX', async ({ page }) => {
    const token = await mintToken(page);
    // Clear all products
    const listRes = await page.request.get(`${API_URL}/shop/products`);
    const { products } = (await listRes.json()) as { products: { id: string }[] };
    for (const p of products) {
      await page.request.delete(`${API_URL}/shop/products/${p.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
    }
    // Clear PIX config
    await page.request.put(`${API_URL}/shop/pix`, {
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      data: { key: '', beneficiary: '', city: '' },
    });

    await page.goto('/lojinha');
    await expect(page.getByText(/em breve/i)).toBeVisible({ timeout: 10_000 });
  });
});
