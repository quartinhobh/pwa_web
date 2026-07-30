// Credit waterfall — declares the CreditSource adapter contract and the
// default pipeline. fetchCredits (in musicbrainzService) reduces over the
// pipeline to assemble AggregatedCredits from MB + Discogs + Genius + Deezer.
//
// Each adapter returns a CreditSourceResult or null. The reducer applies the
// deltas into a single aggregate: album metadata fills undefined gaps,
// performers union by name, and composers/lyricists merge into TrackWorkCredit
// entries matched against the running track list by titleMatches.

import type {
  AggregatedCredits,
  AggregatedPerformer,
  AlbumCredits,
  MusicBrainzTrack,
  TrackWorkCredit,
} from '../types';
import { normalizeName, titleMatches } from './textMatch';

export type CreditSourceName = 'musicbrainz' | 'discogs' | 'genius' | 'deezer';

/**
 * One source's contribution to an album's credits. Each field is optional
 * so adapters can fill only what they have. The reducer dedups and merges.
 *
 * Two shapes for track-level writer credits:
 *  - `trackWorks` (MusicBrainz): already-aggregated TrackWorkCredit entries
 *    carrying the recordingId from each per-track fetch.
 *  - `composers` / `lyricists` Maps keyed by work title (Discogs, Genius):
 *    raw entries that the reducer matches against `state.tracks` by
 *    titleMatches to stamp the recordingId.
 */
export interface CreditSourceResult {
  tracks: MusicBrainzTrack[];
  artistCredit?: string;
  albumTitle?: string;
  albumCredits?: AlbumCredits;
  performers?: Map<string, Set<string>>;
  trackWorks?: TrackWorkCredit[];
  composers?: Map<string, Set<string>>;
  lyricists?: Map<string, Set<string>>;
}

export interface CreditSource {
  readonly name: CreditSourceName;
  /** Reads env at call time so toggles can be flipped without re-import. */
  readonly enabled: () => boolean;
  /**
   * Fetch this source's contribution. `state` is the accumulated result from
   * earlier sources — adapters that fill gaps (Genius: skip tracks already
   * populated; Deezer: skip if performers exist) consume it. Returns null on
   * unrecoverable network error; throws on programmer errors.
   */
  fetchAlbumTracksAndCredits(
    mbAlbumId: string,
    state: CreditSourceResult,
  ): Promise<CreditSourceResult | null>;
}

/** Read CREDITS_ENABLE_<SOURCE> at call time. `false` disables a source. */
function envEnabled(name: CreditSourceName): boolean {
  return process.env[`CREDITS_ENABLE_${name.toUpperCase()}`] !== 'false';
}

/**
 * Reduce `pipeline` into a final FetchCreditsResult. The first source is
 * treated as critical — its error propagates so callers (e.g. eventService)
 * can surface it as `credits: null` and record the error in debug. Later
 * sources are best-effort fallbacks; their errors are logged and skipped.
 */
export async function runCreditsPipeline(
  pipeline: readonly CreditSource[],
  mbAlbumId: string,
): Promise<{ credits: AggregatedCredits; tracks: MusicBrainzTrack[] }> {
  let state: CreditSourceResult = { tracks: [] };

  const [primary, ...fallbacks] = pipeline;
  if (primary?.enabled()) {
    const delta = await primary.fetchAlbumTracksAndCredits(mbAlbumId, state);
    if (delta) state = mergeInto(state, delta);
  }

  for (const source of fallbacks) {
    if (!source.enabled()) continue;
    try {
      const delta = await source.fetchAlbumTracksAndCredits(mbAlbumId, state);
      if (delta) state = mergeInto(state, delta);
    } catch (err) {
      console.warn(`[credits] ${source.name} fallback failed:`, err);
    }
  }

  return { credits: toAggregated(state), tracks: state.tracks };
}

function mergeInto(
  state: CreditSourceResult,
  delta: CreditSourceResult,
): CreditSourceResult {
  const tracks = state.tracks.length > 0 ? state.tracks : delta.tracks;
  const artistCredit = state.artistCredit ?? delta.artistCredit;
  const albumTitle = state.albumTitle ?? delta.albumTitle;
  const albumCredits = mergeAlbum(state.albumCredits, delta.albumCredits);
  const performers = unionMaps(state.performers, delta.performers);
  const composers = unionMaps(state.composers, delta.composers);
  const lyricists = unionMaps(state.lyricists, delta.lyricists);
  const trackWorks = state.trackWorks ?? delta.trackWorks;
  return { tracks, artistCredit, albumTitle, albumCredits, performers, composers, lyricists, trackWorks };
}

function mergeAlbum(a?: AlbumCredits, b?: AlbumCredits): AlbumCredits | undefined {
  if (!a && !b) return undefined;
  if (!a) return { ...b! };
  if (!b) return a;
  return { ...a, ...b };
}

function unionMaps<K, V>(
  a: Map<K, Set<V>> | undefined,
  b: Map<K, Set<V>> | undefined,
): Map<K, Set<V>> | undefined {
  if (!a && !b) return undefined;
  const out = new Map<K, Set<V>>(a ?? []);
  for (const [k, v] of b ?? []) {
    const existing = out.get(k);
    if (existing) for (const item of v) existing.add(item);
    else out.set(k, new Set(v));
  }
  return out;
}

function toAggregated(state: CreditSourceResult): AggregatedCredits {
  const totalTracks = state.tracks.length;
  return {
    label: state.albumCredits?.label,
    catalogNumber: state.albumCredits?.catalogNumber,
    country: state.albumCredits?.country,
    releaseYear: state.albumCredits?.releaseYear,
    genres: state.albumCredits?.genres,
    releaseType: state.albumCredits?.releaseType,
    performers: buildPerformers(state.performers, totalTracks),
    trackWorks: buildTrackWorks(state),
  };
}

function buildPerformers(
  performers: Map<string, Set<string>> | undefined,
  totalTracks: number,
): AggregatedPerformer[] {
  if (!performers || performers.size === 0) return [];
  return [...performers.entries()]
    .map(([name, roles]) => ({
      name,
      instruments: [...roles],
      trackCount: 0,
      totalTracks,
    }))
    .sort((a, b) => b.trackCount - a.trackCount || a.name.localeCompare(b.name));
}

function buildTrackWorks(state: CreditSourceResult): TrackWorkCredit[] {
  const tracks = state.tracks;
  // Map keyed by (recordingId + normalized title) so two work entries with
  // the same title but different recordingIds (multi-version tracks) stay
  // distinct; raw composers/lyricists (Discogs/Genius) fold into the entry
  // whose title matches.
  const works = new Map<string, TrackWorkCredit>();

  function key(recordingId: string, title: string): string {
    return `${recordingId}|${normalizeName(title)}`;
  }

  function add(recordingId: string, title: string): TrackWorkCredit {
    const k = key(recordingId, title);
    let w = works.get(k);
    if (!w) {
      w = { recordingId, title, composers: [], lyricists: [] };
      works.set(k, w);
    }
    return w;
  }

  // Seed from MB-style pre-aggregated trackWorks if present.
  for (const tw of state.trackWorks ?? []) {
    const w = add(tw.recordingId, tw.title);
    for (const c of tw.composers) if (!w.composers.some((e) => normalizeName(e) === normalizeName(c))) w.composers.push(c);
    for (const l of tw.lyricists) if (!w.lyricists.some((e) => normalizeName(e) === normalizeName(l))) w.lyricists.push(l);
  }

  // Then merge raw composers/lyricists (Discogs, Genius). Match by titleMatches
  // against the running track list so the right recordingId is stamped.
  // Discogs uses the literal key 'album' for album-level writers — drop it
  // (those credits don't belong to a specific track).
  const trackByTitle = new Map<string, MusicBrainzTrack>();
  for (const t of tracks) trackByTitle.set(t.title, t);

  function findTrack(workTitle: string): MusicBrainzTrack | undefined {
    if (workTitle === 'album') return undefined;
    if (trackByTitle.has(workTitle)) return trackByTitle.get(workTitle);
    return tracks.find((t) => titleMatches(t.title, workTitle));
  }

  for (const [workTitle, names] of state.composers ?? []) {
    const track = findTrack(workTitle);
    if (!track) continue;
    const w = add(track.recordingId, track.title);
    for (const n of names) if (!w.composers.some((e) => normalizeName(e) === normalizeName(n))) w.composers.push(n);
  }

  for (const [workTitle, names] of state.lyricists ?? []) {
    const track = findTrack(workTitle);
    if (!track) continue;
    const w = add(track.recordingId, track.title);
    for (const n of names) if (!w.lyricists.some((e) => normalizeName(e) === normalizeName(n))) w.lyricists.push(n);
  }

  return [...works.values()];
}

export function isDiscogsEnabled(): boolean { return envEnabled('discogs'); }
export function isGeniusEnabled(): boolean { return envEnabled('genius'); }
export function isDeezerEnabled(): boolean { return envEnabled('deezer'); }