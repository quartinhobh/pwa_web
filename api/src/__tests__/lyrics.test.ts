// Lyrics proxy tests — P3-C.
// Fetch/fallback logic is exercised via direct service calls with an
// in-memory cache so these tests run without the Firestore emulator.
// HTTP-level tests that hit the real router (and thus Firestore via the
// default cache store) are guarded behind FIRESTORE_EMULATOR_HOST.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import app from '../index';
import {
  fetchLyrics,
  normalizeKey,
  type LyricsCacheStore,
} from '../services/lyricsService';
import type { LyricsCache } from '../types';

interface MockFetchCall {
  url: string;
}

const calls: MockFetchCall[] = [];

function mockFetchByUrl(
  handlers: Array<{
    match: string;
    ok?: boolean;
    status?: number;
    body: unknown;
  }>,
): void {
  globalThis.fetch = vi.fn(async (url: string | URL) => {
    const u = String(url);
    calls.push({ url: u });
    for (const h of handlers) {
      if (u.includes(h.match)) {
        return {
          ok: h.ok ?? true,
          status: h.status ?? 200,
          json: async () => h.body,
        } as unknown as Response;
      }
    }
    return {
      ok: false,
      status: 404,
      json: async () => ({}),
    } as unknown as Response;
  }) as unknown as typeof fetch;
}

function memoryCache(): LyricsCacheStore & { store: Map<string, LyricsCache> } {
  const store = new Map<string, LyricsCache>();
  return {
    store,
    async get(key) {
      const hit = store.get(key);
      if (!hit) return null;
      if (hit.expiresAt <= Date.now()) return null;
      return hit;
    },
    async set(key, entry) {
      store.set(key, entry);
    },
  };
}

beforeEach(() => {
  calls.length = 0;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('normalizeKey', () => {
  it('lowercases, strips diacritics, collapses whitespace', () => {
    expect(normalizeKey('  Café   Tacvba  ', 'María')).toBe('cafe tacvba-maria');
  });
});

describe('fetchLyrics (fetch + fallback, in-memory cache)', () => {
  it('cache miss: calls lyrics.ovh and caches result', async () => {
    mockFetchByUrl([
      { match: 'api.lyrics.ovh', body: { lyrics: 'la la la' } },
    ]);
    const cache = memoryCache();

    const out = await fetchLyrics('Artist', 'Title', { cache });

    expect(out.lyrics).toBe('la la la');
    expect(out.source).toBe('lyrics.ovh');
    expect(out.cached).toBe(false);
    expect(cache.store.size).toBe(1);
    const key = normalizeKey('Artist', 'Title');
    expect(cache.store.get(key)?.source).toBe('lyrics.ovh');
    expect(cache.store.get(key)?.expiresAt).toBeGreaterThan(Date.now());
  });

  it('cache hit: returns cached value without calling external APIs', async () => {
    const cache = memoryCache();
    const key = normalizeKey('A', 'T');
    const now = Date.now();
    cache.store.set(key, {
      id: key,
      trackId: key,
      trackTitle: 'T',
      artistName: 'A',
      lyrics: 'cached',
      source: 'lrclib',
      cachedAt: now,
      expiresAt: now + 1000000,
    });
    globalThis.fetch = vi.fn(async () => {
      throw new Error('should not be called');
    }) as unknown as typeof fetch;

    const out = await fetchLyrics('A', 'T', { cache });

    expect(out.lyrics).toBe('cached');
    expect(out.cached).toBe(true);
    expect(out.source).toBe('lrclib');
  });

  it('lyrics.ovh fails → falls back to LRCLIB', async () => {
    mockFetchByUrl([
      { match: 'api.lyrics.ovh', ok: false, status: 404, body: {} },
      { match: 'lrclib.net', body: { plainLyrics: 'from lrclib' } },
    ]);
    const cache = memoryCache();

    const out = await fetchLyrics('Artist', 'Title', { cache });

    expect(out.lyrics).toBe('from lrclib');
    expect(out.source).toBe('lrclib');
    expect(out.cached).toBe(false);
    expect(calls.some((c) => c.url.includes('lyrics.ovh'))).toBe(true);
    expect(calls.some((c) => c.url.includes('lrclib.net'))).toBe(true);
  });

  it('both providers fail → returns null without caching', async () => {
    mockFetchByUrl([
      { match: 'api.lyrics.ovh', ok: false, status: 404, body: {} },
      { match: 'lrclib.net', ok: false, status: 404, body: {} },
    ]);
    const cache = memoryCache();

    const out = await fetchLyrics('X', 'Y', { cache });

    expect(out.lyrics).toBeNull();
    expect(out.source).toBeNull();
    expect(out.cached).toBe(false);
    expect(cache.store.size).toBe(0);
  });

  it('lyrics.ovh returns empty string → falls back to LRCLIB', async () => {
    mockFetchByUrl([
      { match: 'api.lyrics.ovh', body: { lyrics: '   ' } },
      { match: 'lrclib.net', body: { plainLyrics: 'real lyrics' } },
    ]);
    const cache = memoryCache();

    const out = await fetchLyrics('A', 'T', { cache });
    expect(out.source).toBe('lrclib');
    expect(out.lyrics).toBe('real lyrics');
  });

  it('skipCache bypasses a fresh cache entry', async () => {
    const cache = memoryCache();
    const key = normalizeKey('A', 'T');
    const now = Date.now();
    cache.store.set(key, {
      id: key,
      trackId: key,
      trackTitle: 'T',
      artistName: 'A',
      lyrics: 'stale',
      source: 'lyrics.ovh',
      cachedAt: now,
      expiresAt: now + 1000000,
    });
    mockFetchByUrl([
      { match: 'api.lyrics.ovh', body: { lyrics: 'fresh' } },
    ]);

    const out = await fetchLyrics('A', 'T', { cache, skipCache: true });
    expect(out.lyrics).toBe('fresh');
    expect(out.cached).toBe(false);
  });
});

// ── HTTP-level tests (emulator-gated) ─────────────────────────────────

const EMULATOR = !!process.env.FIRESTORE_EMULATOR_HOST;

describe.skipIf(!EMULATOR)('GET /lyrics/:artist/:title (HTTP)', () => {
  it('returns 200 with null lyrics when both providers fail', async () => {
    mockFetchByUrl([
      { match: 'api.lyrics.ovh', ok: false, status: 404, body: {} },
      { match: 'lrclib.net', ok: false, status: 404, body: {} },
    ]);
    const res = await request(app).get('/lyrics/nobody/nothing');
    expect(res.status).toBe(200);
    expect(res.body.lyrics).toBeNull();
    expect(res.body.source).toBeNull();
  });
});

describe.skipIf(!EMULATOR)('POST /lyrics/refresh (HTTP)', () => {
  it('rejects unauthenticated with 401', async () => {
    const res = await request(app)
      .post('/lyrics/refresh')
      .send({ artist: 'A', title: 'T' });
    expect(res.status).toBe(401);
  });
});
