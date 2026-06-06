// Deezer credit service tests — mock global fetch at the HTTP boundary.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchDeezerPerformers } from '../services/deezerService';

const calls: string[] = [];

function mockDeezer(searchBody: unknown, albumBody: unknown): void {
  globalThis.fetch = vi.fn(async (url: string | URL) => {
    const u = String(url);
    calls.push(u);
    const body = u.includes('/search/album') ? searchBody : albumBody;
    return { ok: true, status: 200, json: async () => body } as unknown as Response;
  }) as unknown as typeof fetch;
}

beforeEach(() => {
  calls.length = 0;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('fetchDeezerPerformers', () => {
  it('returns album contributors as a name → roles map', async () => {
    mockDeezer(
      { data: [{ id: 123, title: 'Clube da Esquina', artist: { name: 'Milton Nascimento' } }] },
      {
        id: 123,
        title: 'Clube da Esquina',
        contributors: [
          { name: 'Milton Nascimento', role: 'Main' },
          { name: 'Lô Borges', role: 'Featured' },
        ],
      },
    );

    const res = await fetchDeezerPerformers('Milton Nascimento', 'Clube da Esquina');
    expect(res).not.toBeNull();
    expect([...res!.keys()]).toEqual(['Milton Nascimento', 'Lô Borges']);
    expect([...res!.get('Milton Nascimento')!]).toContain('Main');
    expect(calls[0]).toContain('/search/album');
    expect(calls[1]).toContain('/album/123');
  });

  it('returns null when the album is not found on Deezer', async () => {
    mockDeezer({ data: [] }, {});
    const res = await fetchDeezerPerformers('Unknown', 'Nope');
    expect(res).toBeNull();
    expect(calls).toHaveLength(1);
  });

  it('returns null when the album has no contributors', async () => {
    mockDeezer({ data: [{ id: 9 }] }, { id: 9, contributors: [] });
    const res = await fetchDeezerPerformers('Some', 'Album');
    expect(res).toBeNull();
  });
});
