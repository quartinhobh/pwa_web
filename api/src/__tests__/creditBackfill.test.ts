import { beforeEach, describe, expect, it, vi } from 'vitest';

const { get, update, fetchCredits, searchGeniusTracks, fetchLyrics } = vi.hoisted(() => ({
  get: vi.fn(),
  update: vi.fn(),
  fetchCredits: vi.fn(),
  searchGeniusTracks: vi.fn(),
  fetchLyrics: vi.fn(),
}));

vi.mock('../config/firebase', () => ({
  adminDb: {
    collection: vi.fn(() => ({
      doc: vi.fn(() => ({ get, update })),
    })),
  },
}));
vi.mock('../services/musicbrainzService', () => ({ fetchCredits }));
vi.mock('../services/geniusService', () => ({ searchGeniusTracks }));
vi.mock('../services/lyricsService', () => ({ fetchLyrics }));

import { backfillEventCredits } from '../services/creditBackfill';

const event = {
  id: 'event-1',
  mbAlbumId: 'release-1',
  album: { albumTitle: 'Album', artistCredit: 'Artist', tracks: [] },
};

beforeEach(() => {
  vi.clearAllMocks();
  get.mockResolvedValue({ exists: true, data: () => event });
  update.mockResolvedValue(undefined);
  searchGeniusTracks.mockResolvedValue([]);
  fetchLyrics.mockResolvedValue(null);
});

describe('backfillEventCredits', () => {
  it('returns counts and warms lyrics on success', async () => {
    fetchCredits.mockResolvedValue({
      credits: { performers: [{ name: 'Artist', instruments: [], trackCount: 1, totalTracks: 1 }], trackWorks: [] },
      tracks: [{ id: 'track-1', title: 'Song', position: 1, durationMs: null }],
    });

    const report = await backfillEventCredits('event-1', { await: true });

    expect(report).toEqual({
      eventId: 'event-1',
      creditsAttempted: true,
      tracksCount: 1,
      creditsCount: 1,
      lyricsWarmed: true,
    });
    expect(update).toHaveBeenCalledWith({
      'album.credits': { performers: [{ name: 'Artist', instruments: [], trackCount: 1, totalTracks: 1 }], trackWorks: [] },
      'album.tracks': [{ id: 'track-1', title: 'Song', position: 1, durationMs: null }],
      'album.creditsAttempted': true,
    });
    expect(fetchLyrics).toHaveBeenCalledWith('Artist', 'Song', { skipCache: true });
  });

  it('does not fetch credits after an earlier attempt', async () => {
    get.mockResolvedValue({
      exists: true,
      data: () => ({ ...event, album: { ...event.album, creditsAttempted: true } }),
    });

    const report = await backfillEventCredits('event-1');

    expect(report.creditsAttempted).toBe(true);
    expect(fetchCredits).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it('reports a fetch failure and preserves the attempted marker', async () => {
    fetchCredits.mockRejectedValue(new Error('MusicBrainz unavailable'));

    const report = await backfillEventCredits('event-1', { await: true });

    expect(report.error).toBe('MusicBrainz unavailable');
    expect(report.creditsAttempted).toBe(true);
    expect(update).toHaveBeenCalledWith({ 'album.creditsAttempted': true });
  });
});
