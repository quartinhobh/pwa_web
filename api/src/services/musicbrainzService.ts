// MusicBrainz proxy service.
// Enforces 1 req/sec rate limit via a simple token bucket + User-Agent per
// MusicBrainz ToS.
// Owner: feature-builder.

import type { MusicBrainzRelease, MusicBrainzTrack } from '../types';

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
  'artist-credit'?: MbArtistCreditJson[];
  media?: MbMediaJson[];
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
): Promise<MbSearchResult[]> {
  const cacheKey = `search:${query.toLowerCase().trim()}:${limit}`;
  const cached = cacheGet(cacheKey) as MbSearchResult[] | undefined;
  if (cached) return cached;

  const json = (await mbFetch(
    `/release?query=${encodeURIComponent(query)}&limit=${limit}&fmt=json`,
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

export async function fetchReleaseGroupTracks(
  mbid: string,
): Promise<MusicBrainzTrack[]> {
  const cacheKey = `rg-tracks:${mbid}`;
  const cached = cacheGet(cacheKey) as MusicBrainzTrack[] | undefined;
  if (cached) return cached;

  const json = (await mbFetch(
    `/release-group/${encodeURIComponent(mbid)}?inc=releases+media+recordings&fmt=json`,
  )) as { releases?: MbReleaseJson[] };
  const first = json.releases?.[0];
  if (!first) return [];
  // Need media on the actual release — re-fetch the release by id.
  const release = (await mbFetch(
    `/release/${encodeURIComponent(first.id)}?inc=recordings&fmt=json`,
  )) as MbReleaseJson;
  const tracks = extractTracks(release.media);
  cacheSet(cacheKey, tracks);
  return tracks;
}
