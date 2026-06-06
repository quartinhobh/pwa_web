// Deezer credits service — last-resort fallback for album performers.
// Deezer's public API requires no key (already used for cover art) but only
// exposes `contributors` (performing artists with role "Main"/"Featured") —
// it does NOT carry composer/lyricist data. So this fills the *performers* gap
// only, for streaming-only albums the other sources miss.
// Owner: feature-builder.

const DEEZER_BASE = 'https://api.deezer.com';

interface DeezerSearchAlbum {
  id: number;
  title?: string;
  artist?: { name?: string };
}

interface DeezerContributor {
  name?: string;
  role?: string;
}

interface DeezerAlbum {
  id: number;
  title?: string;
  contributors?: DeezerContributor[];
}

async function deezerFetch(path: string): Promise<unknown> {
  const res = await fetch(`${DEEZER_BASE}${path}`, {
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`deezer_${res.status}`);
  return res.json();
}

async function searchDeezerAlbum(
  artist: string,
  album: string,
): Promise<number | null> {
  const q = `${artist} ${album}`.trim();
  const json = (await deezerFetch(
    `/search/album?q=${encodeURIComponent(q)}`,
  )) as { data?: DeezerSearchAlbum[] };
  return json.data?.[0]?.id ?? null;
}

/**
 * Fetch album-level performers from Deezer.
 * Returns a name → roles map (mirrors the Discogs performers shape so the
 * caller can merge identically), or null when nothing is found / on error.
 */
export async function fetchDeezerPerformers(
  artist: string,
  album: string,
): Promise<Map<string, Set<string>> | null> {
  try {
    const albumId = await searchDeezerAlbum(artist, album);
    if (albumId == null) return null;

    const detail = (await deezerFetch(`/album/${albumId}`)) as DeezerAlbum;
    const performers = new Map<string, Set<string>>();
    for (const c of detail.contributors ?? []) {
      if (!c.name) continue;
      if (!performers.has(c.name)) performers.set(c.name, new Set());
      performers.get(c.name)!.add(c.role || 'performer');
    }
    return performers.size > 0 ? performers : null;
  } catch (err) {
    console.warn(`[deezer] performer lookup failed for ${artist} — ${album}:`, err);
    return null;
  }
}
