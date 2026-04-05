// MusicBrainz proxy tests — mock global fetch at module level.
// The external HTTP API boundary is explicitly allowed to mock per P3-B contract.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import app from '../index';
import { MB_USER_AGENT } from '../services/musicbrainzService';

interface MockFetchCall {
  url: string;
  init: RequestInit | undefined;
}

const calls: MockFetchCall[] = [];

function mockFetchJson(body: unknown, ok = true, status = 200): void {
  globalThis.fetch = vi.fn(async (url: string | URL, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    return {
      ok,
      status,
      json: async () => body,
    } as unknown as Response;
  }) as unknown as typeof fetch;
}

beforeEach(() => {
  calls.length = 0;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('GET /mb/album/:mbid', () => {
  it('proxies to musicbrainz.org with the Quartinho User-Agent and returns a release', async () => {
    mockFetchJson({
      id: 'abc-123',
      title: 'Test Album',
      date: '2020-01-01',
      'artist-credit': [{ name: 'Foo', joinphrase: ' & ' }, { name: 'Bar' }],
      media: [
        {
          tracks: [
            { id: 't1', title: 'One', position: 1, length: 180000 },
            { id: 't2', title: 'Two', position: 2, length: 200000 },
          ],
        },
      ],
    });

    const res = await request(app).get('/mb/album/abc-123');
    expect(res.status).toBe(200);
    expect(res.body.release.id).toBe('abc-123');
    expect(res.body.release.title).toBe('Test Album');
    expect(res.body.release.artistCredit).toBe('Foo & Bar');
    expect(res.body.release.tracks).toHaveLength(2);
    expect(res.body.release.tracks[0].title).toBe('One');

    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toContain('https://musicbrainz.org/ws/2/release/abc-123');
    const headers = calls[0]!.init?.headers as Record<string, string>;
    expect(headers['User-Agent']).toBe(MB_USER_AGENT);
  });

  it('returns 502 on upstream error', async () => {
    mockFetchJson({}, false, 500);
    const res = await request(app).get('/mb/album/xxx');
    expect(res.status).toBe(502);
  });
});

describe('GET /mb/release-groups/:mbid/tracks', () => {
  it('resolves release group -> release -> tracks', async () => {
    let callCount = 0;
    globalThis.fetch = vi.fn(async (url: string | URL) => {
      callCount++;
      const u = String(url);
      if (u.includes('/release-group/')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ releases: [{ id: 'rel-1', title: 'X' }] }),
        } as unknown as Response;
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({
          id: 'rel-1',
          title: 'X',
          media: [
            {
              tracks: [{ id: 't1', title: 'Alpha', position: 1, length: 100000 }],
            },
          ],
        }),
      } as unknown as Response;
    }) as unknown as typeof fetch;

    const res = await request(app).get('/mb/release-groups/rg-1/tracks');
    expect(res.status).toBe(200);
    expect(res.body.tracks).toHaveLength(1);
    expect(res.body.tracks[0].title).toBe('Alpha');
    expect(callCount).toBe(2);
  });
});
