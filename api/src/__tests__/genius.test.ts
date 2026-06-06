// Genius credit service tests — mock global fetch at the HTTP boundary.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchGeniusTrackCredits } from '../services/geniusService';

interface MockCall {
  url: string;
}

const calls: MockCall[] = [];

// Responds with `searchBody` for /search and `songBody` for /songs/:id.
function mockGenius(searchBody: unknown, songBody: unknown): void {
  globalThis.fetch = vi.fn(async (url: string | URL) => {
    const u = String(url);
    calls.push({ url: u });
    const body = u.includes('/search') ? searchBody : songBody;
    return { ok: true, status: 200, json: async () => body } as unknown as Response;
  }) as unknown as typeof fetch;
}

beforeEach(() => {
  calls.length = 0;
  process.env.GENIUS_ACCESS_TOKEN = 'test-token';
});

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.GENIUS_ACCESS_TOKEN;
});

describe('fetchGeniusTrackCredits', () => {
  it('returns null when no token is configured (no-op, no HTTP call)', async () => {
    delete process.env.GENIUS_ACCESS_TOKEN;
    const spy = vi.fn();
    globalThis.fetch = spy as unknown as typeof fetch;
    const res = await fetchGeniusTrackCredits('Chico Buarque', 'Construção');
    expect(res).toBeNull();
    expect(spy).not.toHaveBeenCalled();
  });

  it('extracts composers from writer_artists and lyricists from custom_performances', async () => {
    mockGenius(
      {
        response: {
          hits: [
            {
              type: 'song',
              result: { id: 42, title: 'Construção', primary_artist: { name: 'Chico Buarque' } },
            },
          ],
        },
      },
      {
        response: {
          song: {
            id: 42,
            title: 'Construção',
            writer_artists: [{ name: 'Chico Buarque' }],
            custom_performances: [
              { label: 'Lyricist', artists: [{ name: 'Vinicius de Moraes' }] },
              { label: 'Composer', artists: [{ name: 'Tom Jobim' }] },
            ],
          },
        },
      },
    );

    const res = await fetchGeniusTrackCredits('Chico Buarque', 'Construção');
    expect(res).not.toBeNull();
    expect(res!.composers).toContain('Chico Buarque');
    expect(res!.composers).toContain('Tom Jobim');
    expect(res!.lyricists).toContain('Vinicius de Moraes');
    expect(calls[0]!.url).toContain('/search');
    expect(calls[1]!.url).toContain('/songs/42');
  });

  it('rejects a hit whose title does not match the requested track', async () => {
    mockGenius(
      {
        response: {
          hits: [
            {
              type: 'song',
              result: { id: 99, title: 'Totally Different Song', primary_artist: { name: 'Chico Buarque' } },
            },
          ],
        },
      },
      { response: { song: { id: 99, writer_artists: [{ name: 'Someone' }] } } },
    );

    const res = await fetchGeniusTrackCredits('Chico Buarque', 'Construção');
    expect(res).toBeNull();
  });

  it('rejects a hit by a different artist (cover/mismatch guard)', async () => {
    mockGenius(
      {
        response: {
          hits: [
            {
              type: 'song',
              result: { id: 7, title: 'Construção', primary_artist: { name: 'Some Cover Band' } },
            },
          ],
        },
      },
      { response: { song: { id: 7, writer_artists: [{ name: 'X' }] } } },
    );

    const res = await fetchGeniusTrackCredits('Chico Buarque', 'Construção');
    expect(res).toBeNull();
  });

  it('returns null when the matched song carries no songwriter data', async () => {
    mockGenius(
      {
        response: {
          hits: [
            { type: 'song', result: { id: 5, title: 'Construção', primary_artist: { name: 'Chico Buarque' } } },
          ],
        },
      },
      { response: { song: { id: 5, writer_artists: [], custom_performances: [] } } },
    );

    const res = await fetchGeniusTrackCredits('Chico Buarque', 'Construção');
    expect(res).toBeNull();
  });
});
