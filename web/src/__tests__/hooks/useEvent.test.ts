import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useEvent } from '@/hooks/useEvent';
import { useApiCache } from '@/store/apiCache';

const sampleEvent = {
  id: 'e1',
  mbAlbumId: 'mb-1',
  title: 'Evt',
  date: '2025-01-15',
  startTime: '20:00',
  endTime: '22:00',
  location: null,
  album: null,
  status: 'live',
  extras: { text: '', links: [], images: [] },
  spotifyPlaylistUrl: null,
  createdBy: 'admin',
  createdAt: 0,
  updatedAt: 0,
};

const sampleAlbum = {
  id: 'mb-1',
  title: 'Album',
  artistCredit: 'Artist',
  date: '2020-01-01',
  tracks: [
    { id: 't1', title: 'One', position: 1, length: 100000 },
  ],
};

function mockFetchByUrl(map: Record<string, unknown>): void {
  globalThis.fetch = vi.fn(async (url: string | URL) => {
    const u = String(url);
    for (const key of Object.keys(map)) {
      if (u.includes(key)) {
        return {
          ok: true,
          status: 200,
          json: async () => map[key],
        } as unknown as Response;
      }
    }
    return { ok: false, status: 404, json: async () => ({}) } as unknown as Response;
  }) as unknown as typeof fetch;
}

beforeEach(() => {
  vi.restoreAllMocks();
  useApiCache.getState().cache = {};
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useEvent', () => {
  it('fetches current event when id is null, then album + tracks', async () => {
    mockFetchByUrl({
      '/events/current': { event: sampleEvent },
      '/mb/album/': { release: sampleAlbum },
      '/mb/release-groups/': { tracks: sampleAlbum.tracks },
    });

    const { result } = renderHook(() => useEvent(null));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.event?.id).toBe('e1');
    expect(result.current.album?.title).toBe('Album');
    expect(result.current.tracks).toHaveLength(1);
    expect(result.current.error).toBeNull();
  });

  it('fetches by id when id provided', async () => {
    mockFetchByUrl({
      '/events/e1': { event: sampleEvent },
      '/mb/album/': { release: sampleAlbum },
      '/mb/release-groups/': { tracks: sampleAlbum.tracks },
    });

    const { result } = renderHook(() => useEvent('e1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.event?.id).toBe('e1');
  });

  it('returns null event and empty tracks when 404', async () => {
    globalThis.fetch = vi.fn(async () => ({
      ok: false,
      status: 404,
      json: async () => ({}),
    })) as unknown as typeof fetch;

    const { result } = renderHook(() => useEvent(null));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.event).toBeNull();
    expect(result.current.tracks).toHaveLength(0);
  });
});
