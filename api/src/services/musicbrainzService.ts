// MusicBrainz proxy service.
// Enforces 1 req/sec rate limit via a simple token bucket + User-Agent per
// MusicBrainz ToS.
// Owner: feature-builder.

import type {
  AggregatedCredits,
  AlbumCredits,
  MusicBrainzRelease,
  MusicBrainzTrack,
  TrackCredits,
  TrackPerformer,
  TrackWorkCredit,
} from '../types';
import type { CreditSource, CreditSourceResult } from './creditSource';
import { runCreditsPipeline } from './creditSource';
import { discogsAdapter } from './discogsService';
import { geniusAdapter } from './geniusService';
import { deezerAdapter } from './deezerService';

const MB_BASE = 'https://musicbrainz.org/ws/2';
export const MB_USER_AGENT = 'Quartinho/1.0 (https://quartinho.app)';

// ── In-memory LRU cache — avoids re-hitting MB for identical queries/ids ──
const cache = new Map<string, { data: unknown; expiresAt: number }>();
const CACHE_TTL_MS = 1000 * 60 * 60; // 1 hour
const CACHE_MAX_ENTRIES = 500;

function cacheGet(key: string): unknown | undefined {
  const entry = cache.get(key);
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) { cache.delete(key); return undefined; }
  return entry.data;
}

function cacheSet(key: string, data: unknown): void {
  if (cache.size >= CACHE_MAX_ENTRIES) {
    // Evict oldest entry.
    const first = cache.keys().next().value;
    if (first !== undefined) cache.delete(first);
  }
  cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
}

// ── Token bucket: 1 req/sec ────────────────────────────────────────────
let lastRequestAt = 0;
const MIN_INTERVAL_MS = 1000;

async function throttle(): Promise<void> {
  if (process.env.NODE_ENV === 'test') return;
  const now = Date.now();
  const delta = now - lastRequestAt;
  if (delta < MIN_INTERVAL_MS) {
    await new Promise((resolve) => setTimeout(resolve, MIN_INTERVAL_MS - delta));
  }
  lastRequestAt = Date.now();
}

async function mbFetch(path: string): Promise<unknown> {
  await throttle();
  const res = await fetch(`${MB_BASE}${path}`, {
    headers: {
      'User-Agent': MB_USER_AGENT,
      Accept: 'application/json',
    },
  });
  if (!res.ok) {
    throw new Error(`musicbrainz_${res.status}`);
  }
  return res.json();
}

interface MbTrackJson {
  id: string;
  title: string;
  position: number;
  length: number | null;
  recording?: { id: string; title: string };
}

interface MbMediaJson {
  tracks?: MbTrackJson[];
}

interface MbArtistCreditJson {
  name: string;
  joinphrase?: string;
}

interface MbReleaseJson {
  id: string;
  title: string;
  date?: string;
  country?: string;
  'artist-credit'?: MbArtistCreditJson[];
  media?: MbMediaJson[];
  'label-info'?: { label?: { name?: string }; 'catalog-number'?: string }[];
  genres?: { name: string }[];
  tags?: { name: string; count: number }[];
  'release-group'?: { 'primary-type'?: string; 'secondary-types'?: string[] };
}

interface MbRelationJson {
  type: string;
  'type-id'?: string;
  artist?: { id: string; name: string };
  work?: { id: string; title: string };
  'attribute-values'?: Record<string, unknown>;
  direction: string;
}

interface MbRecordingJson {
  id: string;
  title: string;
  relations?: MbRelationJson[];
}

interface MbWorkJson {
  id: string;
  title: string;
  relations?: MbRelationJson[];
}

function joinArtistCredit(credits?: MbArtistCreditJson[]): string {
  if (!credits || credits.length === 0) return '';
  return credits
    .map((c) => `${c.name}${c.joinphrase ?? ''}`)
    .join('')
    .trim();
}

function extractTracks(media?: MbMediaJson[]): MusicBrainzTrack[] {
  if (!media) return [];
  const out: MusicBrainzTrack[] = [];
  for (const m of media) {
    for (const t of m.tracks ?? []) {
      out.push({
        id: t.id,
        recordingId: t.recording?.id ?? t.id,
        title: t.title,
        position: t.position,
        length: t.length ?? 0,
      });
    }
  }
  return out;
}

export async function fetchAlbum(mbid: string): Promise<MusicBrainzRelease> {
  const cacheKey = `album:${mbid}`;
  const cached = cacheGet(cacheKey) as MusicBrainzRelease | undefined;
  if (cached) return cached;

  const json = (await mbFetch(
    `/release/${encodeURIComponent(mbid)}?inc=artist-credits+recordings&fmt=json`,
  )) as MbReleaseJson;
  const result: MusicBrainzRelease = {
    id: json.id,
    title: json.title,
    artistCredit: joinArtistCredit(json['artist-credit']),
    date: json.date ?? '',
    tracks: extractTracks(json.media),
  };
  cacheSet(cacheKey, result);
  return result;
}

export interface MbSearchResult {
  id: string;
  title: string;
  artistCredit: string;
  date: string;
  coverUrl: string | null;
}

export async function searchReleases(
  query: string,
  limit = 10,
  year = '',
): Promise<MbSearchResult[]> {
  const cacheKey = `search:${query.toLowerCase().trim()}:${year || 'no year'}:${limit}`;
  const cached = cacheGet(cacheKey) as MbSearchResult[] | undefined;
  if (cached) return cached;

  // Build query with optional year filter.
  let mbQuery = query;
  if (year && /^\d{4}$/.test(year)) {
    mbQuery = `${query} AND date:${year}`;
  }

  const json = (await mbFetch(
    `/release?query=${encodeURIComponent(mbQuery)}&limit=${limit}&fmt=json`,
  )) as { releases?: MbReleaseJson[] };
  const results = (json.releases ?? []).map((r) => ({
    id: r.id,
    title: r.title,
    artistCredit: joinArtistCredit(r['artist-credit']),
    date: r.date ?? '',
    coverUrl: `https://coverartarchive.org/release/${r.id}/front-250`,
  }));
  cacheSet(cacheKey, results);
  return results;
}

/**
 * Fetch tracks for a given MusicBrainz ID.
 * @param mbid A MusicBrainz release ID or release-group ID.
 * @returns Array of tracks from the release or release-group.
 */
export async function fetchTracks(
  mbid: string,
): Promise<MusicBrainzTrack[]> {
  const cacheKey = `tracks:${mbid}`;
  const cached = cacheGet(cacheKey) as MusicBrainzTrack[] | undefined;
  if (cached) return cached;

  // Try as release ID first (most common case from EventForm)
  try {
    const release = (await mbFetch(
      `/release/${encodeURIComponent(mbid)}?inc=recordings&fmt=json`,
    )) as MbReleaseJson;
    const tracks = extractTracks(release.media);
    cacheSet(cacheKey, tracks);
    return tracks;
  } catch {
    // If it fails, try as release-group ID
    const json = (await mbFetch(
      `/release-group/${encodeURIComponent(mbid)}?inc=releases+media+recordings&fmt=json`,
    )) as { releases?: MbReleaseJson[] };
    const first = json.releases?.[0];
    if (!first) return [];
    const release = (await mbFetch(
      `/release/${encodeURIComponent(first.id)}?inc=recordings&fmt=json`,
    )) as MbReleaseJson;
    const tracks = extractTracks(release.media);
    cacheSet(cacheKey, tracks);
    return tracks;
  }
}

// Exported for testing — clears the in-memory cache
export function __clearCache(): void {
  cache.clear();
}

// ── Credits (album + track-level) ─────────────────────────────────────

function extractAlbumCredits(json: MbReleaseJson): AlbumCredits {
  const labelInfo = json['label-info']?.[0];
  const genres = (json.genres ?? [])
    .slice(0, 3)
    .map((g) => g.name);
  const tags = (json.tags ?? [])
    .sort((a, b) => b.count - a.count)
    .slice(0, 3)
    .map((t) => t.name);
  const allGenres = [...new Set([...genres, ...tags])];
  const rg = json['release-group'];
  const releaseType = rg
    ? `${rg['primary-type'] ?? ''}${rg['secondary-types']?.length ? ` (${rg['secondary-types'].join(', ')})` : ''}`
    : undefined;

  return {
    label: labelInfo?.label?.name,
    catalogNumber: labelInfo?.['catalog-number'],
    country: json.country,
    releaseYear: json.date?.slice(0, 4),
    genres: allGenres.length > 0 ? allGenres : undefined,
    releaseType,
  };
}

const COMPOSER_ROLES = new Set([
  'composer', 'writer', 'arranger',
]);
const LYRICIST_ROLES = new Set([
  'lyricist', 'librettist', 'translator', 'text by',
]);
const WORK_RELATION_TYPES = new Set([
  'performance of',
  'performance',
  'is a recording of',
  'compilation',
  'medley of',
  'instrumental recording of',
  'karaoke recording of',
]);

function extractTrackPerformers(recording: MbRecordingJson): TrackPerformer[] {
  const performerMap = new Map<string, Set<string>>();
  for (const rel of recording.relations ?? []) {
    if (!rel.artist) continue;
    const artistName = rel.artist.name;
    if (!performerMap.has(artistName)) {
      performerMap.set(artistName, new Set());
    }
    const role = rel.type || 'performer';
    performerMap.get(artistName)!.add(role);
  }
  return [...performerMap.entries()].map(([name, instruments]) => ({
    name,
    instruments: [...instruments],
  }));
}

function extractRecordingComposers(recording: MbRecordingJson): { composers: string[]; lyricists: string[] } {
  const composers: string[] = [];
  const lyricists: string[] = [];
  for (const rel of recording.relations ?? []) {
    if (!rel.artist) continue;
    if (COMPOSER_ROLES.has(rel.type)) {
      composers.push(rel.artist.name);
    } else if (LYRICIST_ROLES.has(rel.type)) {
      lyricists.push(rel.artist.name);
    }
  }
  return { composers: [...new Set(composers)], lyricists: [...new Set(lyricists)] };
}

async function fetchWorkCredits(workId: string): Promise<TrackWorkCredit | null> {
  try {
    const json = (await mbFetch(
      `/work/${encodeURIComponent(workId)}?inc=artist-rels&fmt=json`,
    )) as MbWorkJson;
    const composers: string[] = [];
    const lyricists: string[] = [];
    for (const rel of json.relations ?? []) {
      if (!rel.artist) continue;
      if (COMPOSER_ROLES.has(rel.type)) {
        composers.push(rel.artist.name);
      } else if (LYRICIST_ROLES.has(rel.type)) {
        lyricists.push(rel.artist.name);
      }
    }
    return {
      recordingId: '',
      title: json.title,
      composers: [...new Set(composers)],
      lyricists: [...new Set(lyricists)],
    };
  } catch (err) {
    console.warn(`[musicbrainz] failed to fetch work credits for work ${workId}:`, err);
    return null;
  }
}

async function fetchRecordingCredits(
  recordingId: string,
): Promise<TrackCredits> {
  try {
    const json = (await mbFetch(
      `/recording/${encodeURIComponent(recordingId)}?inc=artist-rels+work-rels&fmt=json`,
    )) as MbRecordingJson;

    const performers = extractTrackPerformers(json);

    const workCredits: TrackWorkCredit[] = [];
    for (const rel of json.relations ?? []) {
      if (WORK_RELATION_TYPES.has(rel.type)) {
        if (rel.work?.id) {
          const wc = await fetchWorkCredits(rel.work.id);
          if (wc) workCredits.push(wc);
        }
      }
    }

    // Bug 1 fix: include recording-level composers/lyricists as a work entry
    const { composers: recComposers, lyricists: recLyricists } = extractRecordingComposers(json);
    if (recComposers.length > 0 || recLyricists.length > 0) {
      workCredits.push({
        recordingId,
        title: json.title,
        composers: recComposers,
        lyricists: recLyricists,
      });
    }

    return {
      recordingId,
      performers,
      works: workCredits,
    };
  } catch (err) {
    console.warn(`[musicbrainz] failed to fetch recording credits for ${recordingId}:`, err);
    return { recordingId, performers: [], works: [] };
  }
}

export interface FetchCreditsResult {
  credits: AggregatedCredits;
  tracks: MusicBrainzTrack[];
}

// ── MB-only credit fetch (used by musicbrainzAdapter) ─────────────────

async function fetchMbCreditsRaw(mbid: string): Promise<CreditSourceResult> {
  const json = (await mbFetch(
    `/release/${encodeURIComponent(mbid)}?inc=artist-credits+recordings+labels+genres+tags+release-groups&fmt=json`,
  )) as MbReleaseJson;

  const tracks = extractTracks(json.media);

  const trackCredits: TrackCredits[] = [];
  for (const track of tracks) {
    trackCredits.push(await fetchRecordingCredits(track.recordingId));
  }

  const performers = new Map<string, Set<string>>();
  const trackWorks: TrackWorkCredit[] = [];
  const workSeen = new Set<string>();
  for (const tc of trackCredits) {
    for (const p of tc.performers) {
      if (!performers.has(p.name)) performers.set(p.name, new Set(p.instruments));
      else for (const inst of p.instruments) performers.get(p.name)!.add(inst);
    }
    for (const w of tc.works) {
      const key = `${tc.recordingId}|${w.title}|${w.composers.join(',')}|${w.lyricists.join(',')}`;
      // Bug 1 fix: recording-level composers/lyricists are surfaced as a work
      // entry too — fetchRecordingCredits pushes one in when found.
      if (!workSeen.has(key)) {
        workSeen.add(key);
        trackWorks.push({ ...w, recordingId: tc.recordingId });
      }
    }
  }

  return {
    tracks,
    artistCredit: joinArtistCredit(json['artist-credit']) || undefined,
    albumTitle: json.title,
    albumCredits: extractAlbumCredits(json),
    performers,
    trackWorks,
    // totalTracks flows through performers shape; AggregatedPerformer.trackCount
    // is set by the reducer from totalTracks.
  };
}

// CREDIT ADAPTER — exposed via creditSource.ts
export const musicbrainzAdapter: CreditSource = {
  name: 'musicbrainz',
  enabled: () => true,
  fetchAlbumTracksAndCredits: fetchMbCreditsRaw,
};

// Pipeline assembled once. Co-located with fetchCredits because the MB adapter
// is defined here; the Discogs/Genius/Deezer adapters live in their own
// service files.
export const defaultPipeline: readonly CreditSource[] = [
  musicbrainzAdapter,
  discogsAdapter,
  geniusAdapter,
  deezerAdapter,
];

export async function fetchCredits(mbid: string, forceRefresh = false): Promise<FetchCreditsResult> {
  const cacheKey = `credits:${mbid}`;
  if (!forceRefresh) {
    const cached = cacheGet(cacheKey) as FetchCreditsResult | undefined;
    if (cached) return cached;
  }
  const result = await runCreditsPipeline(defaultPipeline, mbid);
  cacheSet(cacheKey, result);
  return result;
}
