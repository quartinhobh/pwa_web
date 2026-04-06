import { test, expect, type Page, type Route } from '@playwright/test';

/**
 * Real end-to-end flows (P6-S2/S3/S4) — the *deep* variants that exercise
 * the full stack: UI → api → Firebase emulator.
 *
 * Preconditions (see README.md Quickstart):
 *   1. `bun run emulators:up`           — Firebase emulator suite
 *   2. `bun run --filter=api dev`       — Express API in emulator mode
 *   3. `bun run seed`                   — creates the admin user in .env.seed
 *   4. Playwright browsers installed    — `bun run --filter=web e2e:install`
 *
 * MusicBrainz is the only external dependency we don't own, so we mock it
 * at the network layer via `page.route('**\/mb\/**')`. Everything else —
 * Auth, Firestore reads/writes, voting, chat — goes through the real API
 * and the emulator.
 */

const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? 'admin@quartinho.local';
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? 'quartinho-dev-local-2026';
const API_URL = process.env.E2E_API_URL ?? 'http://localhost:3001';
const AUTH_EMULATOR_HOST =
  process.env.E2E_AUTH_EMULATOR_HOST ?? 'http://localhost:9099';

/** Deterministic fake MusicBrainz release — 3 tracks, stable ids. */
const MOCK_MB_ID = 'e2e-mock-album';
const MOCK_RELEASE = {
  id: MOCK_MB_ID,
  title: 'E2E Mock Album',
  artistCredit: 'E2E Artists',
  date: '2020-01-01',
  tracks: [
    { id: 't1', title: 'Track One', position: 1, length: 180000 },
    { id: 't2', title: 'Track Two', position: 2, length: 200000 },
    { id: 't3', title: 'Track Three', position: 3, length: 240000 },
  ],
};

/** Installs network mocks for all MusicBrainz proxy endpoints. */
async function mockMusicBrainz(page: Page): Promise<void> {
  await page.route(/\/mb\/album\/.*/, (route: Route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ release: MOCK_RELEASE }),
    }),
  );
  await page.route(/\/mb\/release-groups\/.*\/tracks/, (route: Route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ tracks: MOCK_RELEASE.tracks }),
    }),
  );
  await page.route(/\/lyrics.*/, (route: Route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ lyrics: null }),
    }),
  );
}

/**
 * Mints an idToken straight from the Firebase Auth emulator's REST API.
 * Doesn't require any page — used for seeding data via the api.
 */
async function mintIdTokenViaRest(page: Page): Promise<string> {
  const url =
    `${AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword` +
    `?key=fake-e2e-key`;
  const res = await page.request.post(url, {
    data: {
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      returnSecureToken: true,
    },
  });
  if (!res.ok()) {
    throw new Error(
      `auth emulator signInWithPassword failed: ${res.status()} ${await res.text()}`,
    );
  }
  const body = (await res.json()) as { idToken: string };
  return body.idToken;
}

/** Walks through `/__dev-login` to establish a logged-in UI session. */
async function devLoginUi(page: Page, next: string): Promise<void> {
  const qs = new URLSearchParams({
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
    next,
  });
  await page.goto(`/__dev-login?${qs.toString()}`);
  await page.waitForURL((url) => url.pathname === next, { timeout: 15_000 });
}

/** Creates an event directly via the API. */
async function createEventViaApi(
  page: Page,
  idToken: string,
  overrides: Partial<{ mbAlbumId: string; title: string }> = {},
): Promise<{ id: string; title: string }> {
  const payload = {
    mbAlbumId: overrides.mbAlbumId ?? MOCK_MB_ID,
    title: overrides.title ?? `E2E Event ${Date.now()}`,
    date: new Date().toISOString().slice(0, 10),
    startTime: '20:00',
    endTime: '22:00',
    extras: { text: '', links: [], images: [] },
    spotifyPlaylistUrl: null,
  };
  const res = await page.request.post(`${API_URL}/events`, {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    data: payload,
  });
  expect(res.status(), 'POST /events').toBe(201);
  const body = (await res.json()) as { event: { id: string; title: string } };
  return body.event;
}

// ─────────────────────────────────────────────────────────────────────────

test.describe('real flows — vote round-trip', () => {
  test('logged-in user votes on the current event and tally reflects the choice', async ({ page }) => {
    // VotePanel lives on the Listen page (`/`), and only for the "current"
    // event (earliest upcoming/live). We create a fresh event with an
    // ancient date so it becomes the "current" one, guaranteeing a clean
    // userVote state (voting is one-shot and the UI disables radios after
    // a prior submission).
    const favId = `t1-${Date.now()}`;
    const leastId = `t3-${Date.now()}`;

    const restToken = await mintIdTokenViaRest(page);

    // Clean up any prior vote-test events so the "current" query picks OUR
    // fresh event with no prior userVote state (voting is one-shot).
    const list = await page.request.get(`${API_URL}/events`);
    const listBody = (await list.json()) as { events: { id: string; title: string }[] };
    for (const ev of listBody.events) {
      if (/^Vote Event /.test(ev.title)) {
        await page.request.delete(`${API_URL}/events/${ev.id}`, {
          headers: { Authorization: `Bearer ${restToken}` },
        });
      }
    }

    const fresh = await createEventViaApi(page, restToken, {
      title: `Vote Event ${Date.now()}`,
    });
    // Directly bump its date back via the admin PUT endpoint so it wins the
    // `status in [live,upcoming] order by date asc limit 1` query.
    const put = await page.request.put(`${API_URL}/events/${fresh.id}`, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${restToken}`,
      },
      data: { date: '1900-01-01', status: 'live' },
    });
    expect(put.status(), 'PUT /events/:id').toBe(200);
    await page.route(/\/mb\/album\/.*/, (route: Route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          release: {
            ...MOCK_RELEASE,
            tracks: [
              { id: favId, title: 'Fav Track', position: 1, length: 180000 },
              { id: 'mid', title: 'Mid Track', position: 2, length: 200000 },
              { id: leastId, title: 'Least Track', position: 3, length: 240000 },
            ],
          },
        }),
      }),
    );
    await page.route(/\/mb\/release-groups\/.*\/tracks/, (route: Route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ tracks: [] }),
      }),
    );
    await page.route(/\/lyrics.*/, (route: Route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ lyrics: null }),
      }),
    );
    await devLoginUi(page, '/');
    const event = fresh;

    await expect(page.getByText('Fav Track').first()).toBeVisible({
      timeout: 15_000,
    });
    // Emoji voting: click heart on Fav Track, skull on Least Track.
    const favRow = page.locator('li').filter({ hasText: 'Fav Track' });
    const leastRow = page.locator('li').filter({ hasText: 'Least Track' });
    await favRow.getByTitle('favorita').click();
    await leastRow.getByTitle('menos gostei').click();
    // Auto-submits when both selected — wait for API round-trip.
    await page.waitForTimeout(1000);

    const tally = await page.request.get(`${API_URL}/votes/${event.id}`);
    expect(tally.status()).toBe(200);
    const body = (await tally.json()) as {
      favorites: Record<string, { count: number }>;
      leastLiked: Record<string, { count: number }>;
    };
    expect(body.favorites[favId]?.count).toBe(1);
    expect(body.leastLiked[leastId]?.count).toBe(1);
  });
});

test.describe('real flows — admin event CRUD', () => {
  test('admin creates an event via the form and sees it in the list', async ({ page }) => {
    await mockMusicBrainz(page);
    await devLoginUi(page, '/admin');

    // Wait for the AdminPanel's EventsTab to hydrate (store role=admin must
    // propagate and fetchEvents() must resolve before the list renders).
    await expect(page.getByRole('heading', { name: /^eventos$/i })).toBeVisible({
      timeout: 15_000,
    });
    await page.getByRole('button', { name: /novo evento/i }).click();

    const uniqueTitle = `Form Event ${Date.now()}`;
    // EventForm now uses album search instead of raw mbAlbumId input.
    // Fill title + date/time fields directly (mbAlbumId can be empty for test).
    await page.getByLabel('title').fill(uniqueTitle);
    await page.getByLabel('date').fill(new Date().toISOString().slice(0, 10));
    await page.getByLabel('startTime').fill('20:00');
    await page.getByLabel('endTime').fill('22:00');

    await page.getByRole('button', { name: /^criar$/ }).click();

    await expect(page.getByText(uniqueTitle)).toBeVisible({ timeout: 10_000 });
  });
});

test.describe('real flows — admin photo upload', () => {
  test('admin uploads a photo and it appears in the list', async ({ page }) => {
    await mockMusicBrainz(page);
    const idToken = await mintIdTokenViaRest(page);
    await createEventViaApi(page, idToken, {
      title: `Photo Event ${Date.now()}`,
    });

    await devLoginUi(page, '/admin');

    // Open the Fotos tab.
    await page.getByRole('tab', { name: /fotos/i }).click();

    // PhotosTab auto-selects the first event; wait for the upload form.
    const fileInput = page.getByLabel('photo-file');
    await expect(fileInput).toBeVisible({ timeout: 15_000 });

    // Use an existing PNG asset from public/ as the upload payload.
    await fileInput.setInputFiles({
      name: 'e2e-test.png',
      mimeType: 'image/png',
      buffer: Buffer.from(
        // 1x1 transparent PNG
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkAAIAAAgAAUivebwAAAAASUVORK5CYII=',
        'base64',
      ),
    });

    await page.getByRole('button', { name: /^enviar$/i }).click();

    // Photo list row uses data-testid="photo-row-<id>"; wait for one to exist.
    await expect(page.locator('[data-testid^="photo-row-"]').first()).toBeVisible({
      timeout: 15_000,
    });
  });
});

test.describe('real flows — chat', () => {
  test('logged-in user sends a chat message and it appears in the room', async ({ page }) => {
    await mockMusicBrainz(page);
    const idToken = await mintIdTokenViaRest(page);
    const event = await createEventViaApi(page, idToken);

    await devLoginUi(page, '/');
    await page.goto(`/chat/${event.id}`);

    const msg = `hello from e2e ${Date.now()}`;
    await page.getByPlaceholder(/escreva uma mensagem/i).fill(msg);
    await page.getByRole('button', { name: /^send$/i }).click();

    await expect(page.getByText(msg)).toBeVisible({ timeout: 10_000 });
  });
});
