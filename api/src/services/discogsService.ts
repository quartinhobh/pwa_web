// Discogs credits service — fallback/additional source for album credits.
// Rate limit: 25 req/min anonymous, 60 req/min with token.
// Owner: feature-builder.

import type { AlbumCredits } from '../types';

const DISCOGS_BASE = 'https://api.discogs.com';
const USER_AGENT = 'Quartinho/1.0 (https://quartinho.app)';

// ── Rate limiting (token bucket, 4 req/sec conservative) ──────────────
let lastRequestAt = 0;
const MIN_INTERVAL = 250;

async function throttle(): Promise<void> {
  if (process.env.NODE_ENV === 'test') return;
  const now = Date.now();
  const delta = now - lastRequestAt;
  if (delta < MIN_INTERVAL) {
    await new Promise((r) => setTimeout(r, MIN_INTERVAL - delta));
  }
  lastRequestAt = Date.now();
}

async function discogsFetch(path: string): Promise<unknown> {
  await throttle();
  const token = process.env.DISCOGS_TOKEN;
  const headers: Record<string, string> = {
    'User-Agent': USER_AGENT,
    Accept: 'application/json',
  };
  if (token) {
    headers.Authorization = `Discogs token=${token}`;
  }
  const res = await fetch(`${DISCOGS_BASE}${path}`, { headers });
  if (!res.ok) {
    throw new Error(`discogs_${res.status}`);
  }
  return res.json();
}

// ── Types ────────────────────────────────────────────────────────────

interface DiscogsSearchResult {
  id: number;
  title: string;
  resource_url: string;
  year?: string;
  label?: string[];
  genre?: string[];
  style?: string[];
  country?: string;
  format?: string[];
  cover_image?: string;
}

interface DiscogsArtist {
  name: string;
  role?: string;
  tracks?: string;
}

interface DiscogsTrack {
  position: string;
  title: string;
  duration?: string;
  extraartists?: DiscogsArtist[];
}

interface DiscogsRelease {
  id: number;
  title: string;
  year?: number;
  genres?: string[];
  styles?: string[];
  labels?: { name: string; catno: string }[];
  country?: string;
  artists?: { name: string }[];
  extraartists?: DiscogsArtist[];
  tracklist?: DiscogsTrack[];
}

// ── Role mapping: Discogs free-text → our taxonomy ──────────────────

function isComposerRole(role: string): boolean {
  const r = role.toLowerCase();
  return (
    r.includes('written-by') ||
    r.includes('composed by') ||
    r.includes('songwriter') ||
    r.includes('writer') ||
    r === 'music by'
  );
}

function isLyricistRole(role: string): boolean {
  const r = role.toLowerCase();
  return (
    r.includes('lyrics by') ||
    r.includes('words by') ||
    r === 'text by'
  );
}

// ── Search + fetch ──────────────────────────────────────────────────

export async function searchDiscogsRelease(
  artist: string,
  album: string,
): Promise<DiscogsSearchResult | null> {
  try {
    const q = `${artist} ${album}`.trim().replace(/\s+/g, '+');
    const json = (await discogsFetch(
      `/database/search?q=${encodeURIComponent(q)}&type=release&per_page=1`,
    )) as { results?: DiscogsSearchResult[] };
    const results = json.results ?? [];
    return results.length > 0 ? results[0]! : null;
  } catch {
    return null;
  }
}

async function fetchDiscogsRelease(releaseId: number): Promise<DiscogsRelease | null> {
  try {
    return (await discogsFetch(`/releases/${releaseId}`)) as DiscogsRelease;
  } catch {
    return null;
  }
}

// ── Credit extraction ──────────────────────────────────────────────

export interface DiscogsCredits {
  albumCredits: AlbumCredits;
  composers: Map<string, Set<string>>;   // work title → composer names
  lyricists: Map<string, Set<string>>;   // work title → lyricist names
  performers: Map<string, Set<string>>;  // artist name → instruments
}

export function extractDiscogsCredits(release: DiscogsRelease): DiscogsCredits {
  const genres = [
    ...(release.genres ?? []),
    ...(release.styles ?? []),
  ];
  const label = release.labels?.[0];

  const albumCredits: AlbumCredits = {
    label: label?.name,
    catalogNumber: label?.catno,
    country: release.country,
    releaseYear: release.year?.toString(),
    genres: genres.length > 0 ? genres : undefined,
  };

  const composers = new Map<string, Set<string>>();
  const lyricists = new Map<string, Set<string>>();
  const performers = new Map<string, Set<string>>();

  function addToMap(map: Map<string, Set<string>>, key: string, value: string) {
    if (!map.has(key)) map.set(key, new Set());
    // Strip Discogs disambiguation numbers like "Toninho (7)"
    const clean = value.replace(/\s*\(\d+\)$/, '');
    map.get(key)!.add(clean);
  }

  // Process release-level extraartists
  for (const a of release.extraartists ?? []) {
    if (!a.role || !a.name) continue;
    if (isComposerRole(a.role)) {
      addToMap(composers, 'album', a.name);
    } else if (isLyricistRole(a.role)) {
      addToMap(lyricists, 'album', a.name);
    } else {
      addToMap(performers, a.name, a.role);
    }
  }

  // Process per-track extraartists
  for (const track of release.tracklist ?? []) {
    const workTitle = track.title || track.position;
    for (const a of track.extraartists ?? []) {
      if (!a.role || !a.name) continue;
      if (isComposerRole(a.role)) {
        addToMap(composers, workTitle, a.name);
      } else if (isLyricistRole(a.role)) {
        addToMap(lyricists, workTitle, a.name);
      } else {
        addToMap(performers, a.name, a.role);
      }
    }
  }

  return { albumCredits, composers, lyricists, performers };
}

export async function fetchDiscogsCredits(
  artist: string,
  album: string,
): Promise<DiscogsCredits | null> {
  const searchResult = await searchDiscogsRelease(artist, album);
  if (!searchResult) return null;

  const release = await fetchDiscogsRelease(searchResult.id);
  if (!release) return null;

  return extractDiscogsCredits(release);
}
