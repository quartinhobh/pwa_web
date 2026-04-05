// Lyrics service — P3-C.
// Fetches from lyrics.ovh (primary) → LRCLIB (fallback) with a Firestore
// cache (30-day TTL). Cache access is behind a pluggable interface so the
// fetch/fallback logic can be unit-tested without the Firestore emulator.
// Owner: feature-builder.

import { adminDb } from '../config/firebase';
import type { LyricsCache, LyricsSource } from '../types';

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const COLLECTION = 'lyrics_cache';

export interface LyricsResult {
  lyrics: string | null;
  source: LyricsSource | null;
  cached: boolean;
}

// ── Cache layer ────────────────────────────────────────────────────────

export interface LyricsCacheStore {
  get(key: string): Promise<LyricsCache | null>;
  set(key: string, entry: LyricsCache): Promise<void>;
}

export function normalizeKey(artist: string, title: string): string {
  const norm = (s: string): string =>
    s
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
  return `${norm(artist)}-${norm(title)}`;
}

export const firestoreLyricsCache: LyricsCacheStore = {
  async get(key) {
    const snap = await adminDb.collection(COLLECTION).doc(key).get();
    if (!snap.exists) return null;
    const data = snap.data() as LyricsCache;
    if (data.expiresAt <= Date.now()) return null;
    return data;
  },
  async set(key, entry) {
    await adminDb.collection(COLLECTION).doc(key).set(entry);
  },
};

// ── External fetchers ──────────────────────────────────────────────────

async function fetchFromLyricsOvh(
  artist: string,
  title: string,
): Promise<string | null> {
  try {
    const res = await fetch(
      `https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`,
    );
    if (!res.ok) return null;
    const body = (await res.json()) as { lyrics?: string };
    const l = body.lyrics?.trim();
    return l && l.length > 0 ? l : null;
  } catch {
    return null;
  }
}

async function fetchFromLrclib(
  artist: string,
  title: string,
): Promise<string | null> {
  try {
    const res = await fetch(
      `https://lrclib.net/api/get?artist_name=${encodeURIComponent(artist)}&track_name=${encodeURIComponent(title)}`,
    );
    if (!res.ok) return null;
    const body = (await res.json()) as {
      plainLyrics?: string | null;
      syncedLyrics?: string | null;
    };
    const l = (body.plainLyrics ?? body.syncedLyrics ?? '').trim();
    return l.length > 0 ? l : null;
  } catch {
    return null;
  }
}

// ── Core ───────────────────────────────────────────────────────────────

export interface FetchLyricsOptions {
  cache?: LyricsCacheStore;
  skipCache?: boolean;
}

export async function fetchLyrics(
  artist: string,
  title: string,
  opts: FetchLyricsOptions = {},
): Promise<LyricsResult> {
  const cache = opts.cache ?? firestoreLyricsCache;
  const key = normalizeKey(artist, title);

  if (!opts.skipCache) {
    const hit = await cache.get(key).catch(() => null);
    if (hit) {
      return { lyrics: hit.lyrics, source: hit.source, cached: true };
    }
  }

  let lyrics = await fetchFromLyricsOvh(artist, title);
  let source: LyricsSource | null = lyrics ? 'lyrics.ovh' : null;

  if (!lyrics) {
    lyrics = await fetchFromLrclib(artist, title);
    source = lyrics ? 'lrclib' : null;
  }

  if (lyrics && source) {
    const now = Date.now();
    const entry: LyricsCache = {
      id: key,
      trackId: key,
      trackTitle: title,
      artistName: artist,
      lyrics,
      source,
      cachedAt: now,
      expiresAt: now + THIRTY_DAYS_MS,
    };
    await cache.set(key, entry).catch(() => undefined);
    return { lyrics, source, cached: false };
  }

  return { lyrics: null, source: null, cached: false };
}
