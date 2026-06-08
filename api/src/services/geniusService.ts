// Genius credits service — digital-first fallback for per-track composers/lyricists.
// Unlike MusicBrainz/Discogs (physical-release centric), Genius indexes songs
// regardless of whether a physical disc exists, so it covers streaming-only albums.
//
// Requires GENIUS_ACCESS_TOKEN (free client access token from
// https://genius.com/api-clients). Without it, this service is a no-op.
// Owner: feature-builder.

const GENIUS_BASE = 'https://api.genius.com';
const USER_AGENT = 'Quartinho/1.0 (https://quartinho.app)';

// ── Rate limiting (token bucket, ~2 req/sec conservative) ─────────────
let lastRequestAt = 0;
const MIN_INTERVAL = 500;

async function throttle(): Promise<void> {
  if (process.env.NODE_ENV === 'test') return;
  const now = Date.now();
  const delta = now - lastRequestAt;
  if (delta < MIN_INTERVAL) {
    await new Promise((r) => setTimeout(r, MIN_INTERVAL - delta));
  }
  lastRequestAt = Date.now();
}

async function geniusFetch(path: string): Promise<unknown> {
  await throttle();
  const token = process.env.GENIUS_ACCESS_TOKEN;
  if (!token) throw new Error('genius_no_token');
  const res = await fetch(`${GENIUS_BASE}${path}`, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });
  if (!res.ok) {
    throw new Error(`genius_${res.status}`);
  }
  return res.json();
}

// ── Types ────────────────────────────────────────────────────────────

interface GeniusArtist {
  name?: string;
}

interface GeniusSearchHit {
  type: string;
  result: {
    id: number;
    title?: string;
    primary_artist?: GeniusArtist;
  };
}

interface GeniusCustomPerformance {
  label?: string;
  artists?: GeniusArtist[];
}

interface GeniusSong {
  id: number;
  title?: string;
  url?: string;
  primary_artist?: GeniusArtist;
  writer_artists?: GeniusArtist[];
  custom_performances?: GeniusCustomPerformance[];
}

// ── Normalization + matching ──────────────────────────────────────────

function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s*[-–(].*$/, '') // drop "(ao vivo)", "- remaster", "feat." tails
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// True when the two strings overlap strongly (equal or one contains the other).
function titlesMatch(a: string, b: string): boolean {
  const na = normalize(a);
  const nb = normalize(b);
  if (!na || !nb) return false;
  return na === nb || na.includes(nb) || nb.includes(na);
}

// True when artist names share at least one meaningful token.
function artistsMatch(a: string, b: string): boolean {
  const ta = new Set(normalize(a).split(' ').filter((t) => t.length > 2));
  const tb = normalize(b).split(' ').filter((t) => t.length > 2);
  if (ta.size === 0 || tb.length === 0) return false;
  return tb.some((t) => ta.has(t));
}

// ── Role mapping: Genius free-text labels → our taxonomy ──────────────

function isLyricistLabel(label: string): boolean {
  const l = label.toLowerCase();
  return l.includes('lyric') || l.includes('letra') || l === 'written by';
}

function isComposerLabel(label: string): boolean {
  const l = label.toLowerCase();
  return (
    l.includes('compos') ||
    l.includes('music') ||
    l.includes('arrang') ||
    l === 'writer'
  );
}

// ── Search + fetch ────────────────────────────────────────────────────

export interface GeniusTrack {
  id: string;
  recordingId: string;
  title: string;
  position: number;
  length: number;
}

async function searchGeniusSong(
  artist: string,
  title: string,
): Promise<number | null> {
  const q = `${artist} ${title}`.trim();
  const json = (await geniusFetch(
    `/search?q=${encodeURIComponent(q)}`,
  )) as { response?: { hits?: GeniusSearchHit[] } };
  const hits = (json.response?.hits ?? []).filter((h) => h.type === 'song');

  for (const hit of hits) {
    const r = hit.result;
    if (!r?.title) continue;
    if (!titlesMatch(r.title, title)) continue;
    // If we know the artist, require a token overlap to avoid covers/mismatches.
    if (artist && r.primary_artist?.name && !artistsMatch(r.primary_artist.name, artist)) {
      continue;
    }
    return r.id;
  }
  return null;
}

/**
 * Search Genius for tracks of an album by artist + album title.
 * Used as a fallback when MusicBrainz returns zero tracks.
 * Strategy: search for the artist → find any song → get album ID → fetch album tracks.
 * Falls back to artist-only search if the album tracks endpoint is empty.
 * Throws on API/auth errors so callers can surface the cause.
 */
export async function searchGeniusTracks(
  artist: string,
  albumTitle: string,
): Promise<GeniusTrack[]> {
  if (!process.env.GENIUS_ACCESS_TOKEN) {
    throw new Error('genius_no_token');
  }

  // Step 1: search for just the artist to find any song
  const json = (await geniusFetch(
    `/search?q=${encodeURIComponent(artist)}&per_page=10`,
  )) as { response?: { hits?: GeniusSearchHit[] } };
  const hits = (json.response?.hits ?? []).filter((h) => h.type === 'song');

  const normTitle = normalize(albumTitle);

  for (const hit of hits) {
    const r = hit.result;
    if (!r?.id) continue;
    if (r.primary_artist?.name && !artistsMatch(r.primary_artist.name, artist)) continue;

    // Step 2: fetch song details to get album info
    try {
      const songJson = (await geniusFetch(`/songs/${r.id}`)) as {
        response?: { song?: { album?: { id?: number; name?: string } } };
      };
      const album = songJson.response?.song?.album;
      if (!album?.id) continue;

      // Match album name (normalized containment)
      const albumName = album.name ?? '';
      const normName = normalize(albumName);
      if (normName !== normTitle && !normName.includes(normTitle) && !normTitle.includes(normName)) {
        continue;
      }

      // Step 3: fetch album tracks
      const albumJson = (await geniusFetch(
        `/albums/${album.id}/tracks?per_page=50`,
      )) as { response?: { tracks?: Array<{ number: number; song?: { id: number; title?: string } }> } };
      const albumTracks = albumJson.response?.tracks ?? [];
      if (albumTracks.length === 0) continue;

      const tracks: GeniusTrack[] = [];
      for (const t of albumTracks) {
        const song = t.song;
        if (!song?.title) continue;
        tracks.push({
          id: String(song.id),
          recordingId: String(song.id),
          title: song.title,
          position: t.number,
          length: 0,
        });
      }
      return tracks;
    } catch {
      continue;
    }
  }

  // Last resort: return all songs by the artist (from initial search)
  return hitsToTracks(hits);
}

function hitsToTracks(hits: GeniusSearchHit[]): GeniusTrack[] {
  const tracks: GeniusTrack[] = [];
  let position = 0;
  const seen = new Set<string>();
  for (const hit of hits) {
    const r = hit.result;
    if (!r?.title) continue;
    const norm = normalize(r.title);
    if (seen.has(norm)) continue;
    seen.add(norm);
    position++;
    tracks.push({
      id: String(r.id),
      recordingId: String(r.id),
      title: r.title,
      position,
      length: 0,
    });
  }
  return tracks;
}

async function fetchGeniusSong(songId: number): Promise<GeniusSong | null> {
  try {
    const json = (await geniusFetch(`/songs/${songId}`)) as {
      response?: { song?: GeniusSong };
    };
    return json.response?.song ?? null;
  } catch {
    return null;
  }
}

function extractSongCredits(song: GeniusSong): {
  composers: string[];
  lyricists: string[];
} {
  const composers = new Set<string>();
  const lyricists = new Set<string>();

  // writer_artists is Genius's primary songwriter list → treat as composers.
  for (const w of song.writer_artists ?? []) {
    if (w.name) composers.add(w.name.trim());
  }

  // custom_performances carries finer-grained roles when available.
  for (const perf of song.custom_performances ?? []) {
    if (!perf.label) continue;
    const names = (perf.artists ?? []).map((a) => a.name?.trim()).filter(Boolean) as string[];
    if (isLyricistLabel(perf.label)) {
      for (const n of names) lyricists.add(n);
    } else if (isComposerLabel(perf.label)) {
      for (const n of names) composers.add(n);
    }
  }

  return { composers: [...composers], lyricists: [...lyricists] };
}

/**
 * Look up per-track composer/lyricist credits on Genius.
 * Returns null when no token is configured, no confident match is found, or
 * the matched song carries no songwriter data.
 */
export async function fetchGeniusTrackCredits(
  artist: string,
  title: string,
): Promise<{ composers: string[]; lyricists: string[] } | null> {
  if (!process.env.GENIUS_ACCESS_TOKEN) return null;
  try {
    const songId = await searchGeniusSong(artist, title);
    if (songId == null) return null;
    const song = await fetchGeniusSong(songId);
    if (!song) return null;
    const credits = extractSongCredits(song);
    if (credits.composers.length === 0 && credits.lyricists.length === 0) {
      return null;
    }
    return credits;
  } catch (err) {
    console.warn(`[genius] credit lookup failed for ${artist} — ${title}:`, err);
    return null;
  }
}

// ── Lyrics extraction via page scraping ────────────────────────────────

function cleanHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/')
    .replace(/&#(\d+);/g, (_: string, d: string) => String.fromCharCode(Number(d)));
}

function stripHtml(text: string): string {
  return text
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]*>/g, '');
}

function extractLyricsFromHtml(html: string): string | null {
  const parts: string[] = [];
  const marker = 'data-lyrics-container="true"';
  let searchFrom = 0;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const markerIdx = html.indexOf(marker, searchFrom);
    if (markerIdx === -1) break;

    const tagStart = html.lastIndexOf('<div', markerIdx);
    const tagEnd = html.indexOf('>', markerIdx) + 1;

    if (tagStart === -1 || tagEnd === 0) {
      searchFrom = markerIdx + marker.length;
      continue;
    }

    // Count nested divs to find the matching closing tag
    let depth = 1;
    let pos = tagEnd;
    let found = false;

    while (depth > 0 && pos < html.length) {
      const nextOpen = html.indexOf('<div', pos);
      const nextClose = html.indexOf('</div>', pos);

      if (nextClose === -1) break;

      if (nextOpen !== -1 && nextOpen < nextClose) {
        depth++;
        pos = nextOpen + 4;
      } else {
        depth--;
        if (depth === 0) {
          const raw = html.substring(tagEnd, nextClose);
          const text = cleanHtmlEntities(stripHtml(raw)).trim();
          // Skip Genius metadata headers like "3 Contributors" or "TITLE Lyrics"
          const cleaned = text
            .replace(/^\d+\s*Contributors?/i, '')
            .replace(/^[A-ZÃÕÁÉÍÓÚÂÊÔÇ\s]+\s+Lyrics/i, '')
            .trim();
          if (cleaned) parts.push(cleaned);
          found = true;
          pos = nextClose + 6;
          break;
        }
        pos = nextClose + 6;
      }
    }

    searchFrom = found ? pos : markerIdx + marker.length;
  }

  return parts.length > 0 ? parts.join('\n\n') : null;
}

/**
 * Fetch song lyrics from Genius by scraping the song page.
 * Uses the API to search and find the song URL, then extracts lyrics from the HTML.
 * Returns null when no token is configured, no match is found, or scraping fails.
 */
export async function fetchGeniusLyrics(
  artist: string,
  title: string,
): Promise<string | null> {
  if (!process.env.GENIUS_ACCESS_TOKEN) return null;
  try {
    const songId = await searchGeniusSong(artist, title);
    if (songId == null) return null;
    const song = await fetchGeniusSong(songId);
    if (!song?.url) return null;

    await throttle();
    const res = await fetch(song.url, {
      headers: { 'User-Agent': USER_AGENT },
    });
    if (!res.ok) return null;
    const html = await res.text();

    return extractLyricsFromHtml(html);
  } catch (err) {
    console.warn(`[genius] lyrics fetch failed for ${artist} — ${title}:`, err);
    return null;
  }
}
