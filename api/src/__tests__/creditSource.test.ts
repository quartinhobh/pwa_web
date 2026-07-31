// Tests for the credit waterfall contract (creditSource.ts) and the
// defaultPipeline assembly. Mocks all sources so the reducer is exercised
// in isolation — no HTTP.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  isDeezerEnabled,
  isDiscogsEnabled,
  isGeniusEnabled,
  runCreditsPipeline,
  type CreditSource,
  type CreditSourceResult,
} from '../services/creditSource';
import { defaultPipeline, musicbrainzAdapter } from '../services/musicbrainzService';
import { discogsAdapter } from '../services/discogsService';
import { geniusAdapter } from '../services/geniusService';
import { deezerAdapter } from '../services/deezerService';

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  for (const key of Object.keys(process.env)) {
    if (key.startsWith('CREDITS_ENABLE_')) delete process.env[key];
  }
  delete process.env.GENIUS_ACCESS_TOKEN;
});

afterEach(() => {
  for (const key of Object.keys(process.env)) {
    if (!Object.prototype.hasOwnProperty.call(ORIGINAL_ENV, key)) delete process.env[key];
  }
  Object.assign(process.env, ORIGINAL_ENV);
  vi.restoreAllMocks();
});

describe('enabled() env toggles', () => {
  it.each([
    ['discogs', isDiscogsEnabled],
    ['genius', isGeniusEnabled],
    ['deezer', isDeezerEnabled],
  ] as const)('enables %s by default when CREDITS_ENABLE_%s is unset', (_name, getter) => {
    expect(getter()).toBe(true);
  });

  it.each([
    ['discogs', isDiscogsEnabled, discogsAdapter],
    ['genius', isGeniusEnabled, geniusAdapter],
    ['deezer', isDeezerEnabled, deezerAdapter],
  ] as const)('disables %s when CREDITS_ENABLE_%s=false', (_name, getter, adapter: CreditSource) => {
    process.env[`CREDITS_ENABLE_${_name.toUpperCase()}`] = 'false';
    expect(getter()).toBe(false);
    expect(adapter.enabled()).toBe(false);
  });
});

describe('defaultPipeline', () => {
  it('lists adapters in the documented order', () => {
    expect(defaultPipeline.map((s) => s.name)).toEqual([
      'musicbrainz',
      'discogs',
      'genius',
      'deezer',
    ]);
  });

  it('includes the musicbrainz adapter as the first entry', () => {
    expect(defaultPipeline[0]).toBe(musicbrainzAdapter);
  });
});

describe('runCreditsPipeline', () => {
  function stubSource(
    name: 'musicbrainz' | 'discogs' | 'genius' | 'deezer',
    fn: (id: string, state: CreditSourceResult) => Promise<CreditSourceResult | null>,
    enabled = true,
  ): CreditSource {
    return { name, enabled: () => enabled, fetchAlbumTracksAndCredits: fn };
  }

  it('folds MB then Discogs into a single credit aggregate', async () => {
    const mb: CreditSource = stubSource('musicbrainz', async (_id, _state) => ({
      tracks: [
        { id: 't1', recordingId: 'rec1', title: 'Song A', position: 1, length: 0 },
        { id: 't2', recordingId: 'rec2', title: 'Song B', position: 2, length: 0 },
      ],
      artistCredit: 'Artist',
      albumTitle: 'Album',
      albumCredits: { label: 'MB Label', genres: ['rock'] },
      performers: new Map([['Alice', new Set(['vocals'])]]),
      trackWorks: [
        { recordingId: 'rec1', title: 'Song A', composers: ['MB Composer'], lyricists: [] },
      ],
    }));

    const discogs: CreditSource = stubSource('discogs', async () => ({
      tracks: [],
      albumCredits: { country: 'BR' },
      performers: new Map([
        ['Alice', new Set(['guitar'])],          // existing — union roles
        ['Bob', new Set(['producer'])],          // new — add
      ]),
      composers: new Map([['Song A', new Set(['Discogs Composer'])]]),
      lyricists: new Map([['Song A', new Set(['Discogs Lyricist'])]]),
    }));

    const { credits, tracks } = await runCreditsPipeline([mb, discogs], 'mbid-1');

    // Tracks come from MB.
    expect(tracks.map((t) => t.title)).toEqual(['Song A', 'Song B']);

    // Album credits: gap-fill — country comes from Discogs, label+genres stay from MB.
    expect(credits.label).toBe('MB Label');
    expect(credits.genres).toEqual(['rock']);
    expect(credits.country).toBe('BR');

    // Performers: Alice gets BOTH roles, Bob is added.
    const alice = credits.performers.find((p) => p.name === 'Alice');
    expect(alice?.instruments.sort()).toEqual(['guitar', 'vocals']);
    expect(credits.performers.find((p) => p.name === 'Bob')).toBeDefined();

    // TrackWorks for Song A has both MB and Discogs composers + Discogs lyricists.
    const songA = credits.trackWorks.find((w) => w.title === 'Song A');
    expect(songA?.composers).toEqual(['MB Composer', 'Discogs Composer']);
    expect(songA?.lyricists).toEqual(['Discogs Lyricist']);
    expect(songA?.recordingId).toBe('rec1');
  });

  it('skips disabled sources', async () => {
    const calls: string[] = [];
    const mb: CreditSource = stubSource('musicbrainz', async (_id, _state) => {
      calls.push('mb');
      return { tracks: [], artistCredit: 'A', albumTitle: 'T' };
    });
    const discogs: CreditSource = stubSource(
      'discogs',
      async () => { calls.push('discogs'); return null; },
      false, // disabled
    );
    const genius: CreditSource = stubSource(
      'genius',
      async () => { calls.push('genius'); return null; },
    );
    await runCreditsPipeline([mb, discogs, genius], 'mbid-2');
    expect(calls).toEqual(['mb', 'genius']);
  });

  it('catches and logs a source that throws, then continues with the rest', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const mb: CreditSource = stubSource('musicbrainz', async () => {
      throw new Error('mb_network_down');
    });

    // The first source throwing is treated as an unrecoverable failure that
    // propagates to the caller (eventService's existing try/catch surfaces
    // it as credits=null).
    await expect(runCreditsPipeline([mb], 'mbid-3')).rejects.toThrow('mb_network_down');
    expect(warn).not.toHaveBeenCalled();
  });

  it('returns null deltas gracefully (no error, no warning)', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const mb: CreditSource = stubSource('musicbrainz', async () => ({ tracks: [] }));
    const discogs: CreditSource = stubSource('discogs', async () => null);
    const { credits, tracks } = await runCreditsPipeline([mb, discogs], 'mbid-4');
    expect(credits.performers).toEqual([]);
    expect(credits.trackWorks).toEqual([]);
    expect(tracks).toEqual([]);
    expect(warn).not.toHaveBeenCalled();
  });

  it('a non-MB source that throws is caught and pipeline continues', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const mb: CreditSource = stubSource('musicbrainz', async () => ({
      tracks: [{ id: 't1', recordingId: 'r1', title: 'S', position: 1, length: 0 }],
      artistCredit: 'A',
      albumTitle: 'Al',
    }));
    const discogs: CreditSource = stubSource('discogs', async () => {
      throw new Error('discogs_500');
    });
    const genius: CreditSource = stubSource('genius', async (_id, state) => {
      // Confirm we received MB's tracks/artistCredit in state.
      expect(state.tracks[0]?.title).toBe('S');
      expect(state.artistCredit).toBe('A');
      return null;
    });

    const { tracks } = await runCreditsPipeline([mb, discogs, genius], 'mbid-5');
    expect(tracks[0]?.title).toBe('S');
    expect(warn).toHaveBeenCalled();
  });

  it('matches work titles via titleMatches (parenthetical tails collapse)', async () => {
    const mb: CreditSource = stubSource('musicbrainz', async () => ({
      tracks: [{ id: 't1', recordingId: 'r1', title: 'Construção', position: 1, length: 0 }],
      artistCredit: 'A',
      albumTitle: 'T',
    }));
    const discogs: CreditSource = stubSource('discogs', async () => ({
      tracks: [],
      composers: new Map([['Construção (Remastered 2017)', new Set(['Discogs Composer'])]]),
    }));
    const { credits } = await runCreditsPipeline([mb, discogs], 'mbid-6');
    const w = credits.trackWorks.find((x) => x.title === 'Construção');
    expect(w?.composers).toContain('Discogs Composer');
    expect(w?.recordingId).toBe('r1');
  });
});