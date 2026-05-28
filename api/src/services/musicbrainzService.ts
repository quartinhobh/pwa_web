// MusicBrainz proxy service.
// Enforces 1 req/sec rate limit via a simple token bucket + User-Agent per
// MusicBrainz ToS.
// Owner: feature-builder.

import type {
  AggregatedCredits,
  AggregatedPerformer,
  AlbumCredits,
  MusicBrainzRelease,
  MusicBrainzTrack,
  TrackCredits,
  TrackPerformer,
  TrackWorkCredit,
} from '../types';
import { fetchDiscogsCredits } from './discogsService';

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

async function fetchWorkCredits(workId: string): Promise<TrackWorkCredit | null> {
  try {
    const json = (await mbFetch(
      `/work/${encodeURIComponent(workId)}?inc=artist-rels&fmt=json`,
    )) as MbWorkJson;
    const composers: string[] = [];
    const lyricists: string[] = [];
    for (const rel of json.relations ?? []) {
      if (!rel.artist) continue;
      if (rel.type === 'composer' || rel.type === 'writer') {
        composers.push(rel.artist.name);
      } else if (rel.type === 'lyricist') {
        lyricists.push(rel.artist.name);
      }
    }
    return {
      recordingId: '',
      title: json.title,
      composers: [...new Set(composers)],
      lyricists: [...new Set(lyricists)],
    };
  } catch {
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

    // Collect work IDs and fetch composer/lyricist info for each
    const workCredits: TrackWorkCredit[] = [];
    for (const rel of json.relations ?? []) {
      if (rel.type === 'performance of' || rel.type === 'performance') {
        if (rel.work?.id) {
          const wc = await fetchWorkCredits(rel.work.id);
          if (wc) workCredits.push(wc);
        }
      }
    }

    return {
      recordingId,
      performers,
      works: workCredits,
    };
  } catch {
    return { recordingId, performers: [], works: [] };
  }
}

export interface FetchCreditsResult {
  credits: AggregatedCredits;
}

export async function fetchCredits(mbid: string, forceRefresh = false): Promise<FetchCreditsResult> {
  const cacheKey = `credits:${mbid}`;
  if (!forceRefresh) {
    const cached = cacheGet(cacheKey) as FetchCreditsResult | undefined;
    if (cached) return cached;
  }

  const json = (await mbFetch(
    `/release/${encodeURIComponent(mbid)}?inc=artist-credits+recordings+labels+genres+tags+release-groups&fmt=json`,
  )) as MbReleaseJson;

  const albumCredits = extractAlbumCredits(json);
  const tracks = extractTracks(json.media);
  const totalTracks = tracks.length;

  const trackCredits: TrackCredits[] = [];
  for (const track of tracks) {
    const tc = await fetchRecordingCredits(track.recordingId);
    trackCredits.push(tc);
  }

  // Aggregate performers at album level
  const performerMap = new Map<string, { instruments: Set<string>; tracks: Set<string> }>();
  for (const tc of trackCredits) {
    for (const p of tc.performers) {
      if (!performerMap.has(p.name)) {
        performerMap.set(p.name, { instruments: new Set(), tracks: new Set() });
      }
      const entry = performerMap.get(p.name)!;
      for (const inst of p.instruments) entry.instruments.add(inst);
      entry.tracks.add(tc.recordingId);
    }
  }

  const performers: AggregatedPerformer[] = [...performerMap.entries()]
    .map(([name, entry]) => ({
      name,
      instruments: [...entry.instruments],
      trackCount: entry.tracks.size,
      totalTracks,
    }))
    .sort((a, b) => b.trackCount - a.trackCount || a.name.localeCompare(b.name));

  // Collect all unique work credits across tracks, preserving recordingId
  const workSeen = new Set<string>();
  const trackWorks: TrackWorkCredit[] = [];
  for (const tc of trackCredits) {
    for (const w of tc.works) {
      const key = `${tc.recordingId}|${w.title}|${w.composers.join(',')}|${w.lyricists.join(',')}`;
      if (!workSeen.has(key)) {
        workSeen.add(key);
        trackWorks.push({ ...w, recordingId: tc.recordingId });
      }
    }
  }

  const credits: AggregatedCredits = {
    label: albumCredits.label,
    catalogNumber: albumCredits.catalogNumber,
    country: albumCredits.country,
    releaseYear: albumCredits.releaseYear,
    genres: albumCredits.genres,
    releaseType: albumCredits.releaseType,
    performers,
    trackWorks,
  };

  // Merge Discogs credits (always fetch, fills gaps and adds missing data)
  const artistName = joinArtistCredit(json['artist-credit']);
  if (artistName) {
    try {
      const dg = await fetchDiscogsCredits(artistName, json.title);
      if (dg) {
        // Fill album info gaps
        if (!credits.label && dg.albumCredits.label) credits.label = dg.albumCredits.label;
        if (!credits.catalogNumber && dg.albumCredits.catalogNumber) credits.catalogNumber = dg.albumCredits.catalogNumber;
        if (!credits.country && dg.albumCredits.country) credits.country = dg.albumCredits.country;
        if (!credits.releaseYear && dg.albumCredits.releaseYear) credits.releaseYear = dg.albumCredits.releaseYear;
        if (!credits.genres || credits.genres.length === 0) {
          credits.genres = dg.albumCredits.genres;
        } else if (dg.albumCredits.genres) {
          credits.genres = [...new Set([...credits.genres, ...dg.albumCredits.genres])];
        }

        // Merge performers from Discogs (only add if not already in MB)
        const existingNames = new Set(credits.performers.map((p) => p.name));
        const existingInstruments = new Map(credits.performers.map((p) => [p.name, p.instruments]));
        for (const [name, instruments] of dg.performers) {
          if (!existingNames.has(name)) {
            credits.performers.push({
              name,
              instruments: [...instruments],
              trackCount: 0,
              totalTracks,
            });
          } else {
            const current = existingInstruments.get(name) ?? [];
            for (const inst of instruments) {
              if (!current.includes(inst)) {
                const idx = credits.performers.findIndex((p) => p.name === name);
                if (idx >= 0) credits.performers[idx]!.instruments.push(inst);
              }
            }
          }
        }

        // Merge composers/lyricists from Discogs (fuzzy title match: accent + case insensitive)
        const normalizeTitle = (s: string): string =>
          s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
        const normalizeName = (s: string): string =>
          s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

        for (const [workTitle, composerSet] of dg.composers) {
          if (workTitle === 'album') continue;
          const normTitle = normalizeTitle(workTitle);
          const existing = trackWorks.find(
            (w) => normalizeTitle(w.title) === normTitle,
          );
          if (existing) {
            for (const c of composerSet) {
              if (!existing.composers.some((e) => normalizeName(e) === normalizeName(c))) {
                existing.composers.push(c);
              }
            }
          } else {
            trackWorks.push({
              recordingId:
                tracks.find(
                  (t) => normalizeTitle(t.title) === normTitle,
                )?.recordingId ?? '',
              title: workTitle,
              composers: [...composerSet],
              lyricists: [],
            });
          }
        }
        for (const [workTitle, lyricistSet] of dg.lyricists) {
          if (workTitle === 'album') continue;
          const normTitle = normalizeTitle(workTitle);
          const existing = trackWorks.find(
            (w) => normalizeTitle(w.title) === normTitle,
          );
          if (existing) {
            for (const l of lyricistSet) {
              if (!existing.lyricists.some((e) => normalizeName(e) === normalizeName(l))) {
                existing.lyricists.push(l);
              }
            }
          } else {
            trackWorks.push({
              recordingId:
                tracks.find(
                  (t) => normalizeTitle(t.title) === normTitle,
                )?.recordingId ?? '',
              title: workTitle,
              composers: [],
              lyricists: [...lyricistSet],
            });
          }
        }
      }
    } catch {
      // Discogs fallback failed — non-blocking
    }
  }

  const result: FetchCreditsResult = { credits };
  cacheSet(cacheKey, result);
  return result;
}
