// MusicBrainz proxy service.
// Enforces 1 req/sec rate limit via a simple token bucket + User-Agent per
// MusicBrainz ToS.
// Owner: feature-builder.

import type { MusicBrainzRelease, MusicBrainzTrack } from '../types';

const MB_BASE = 'https://musicbrainz.org/ws/2';
export const MB_USER_AGENT = 'Quartinho/1.0 (https://quartinho.app)';

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
  const json = (await mbFetch(
    `/release/${encodeURIComponent(mbid)}?inc=artist-credits+recordings&fmt=json`,
  )) as MbReleaseJson;
  return {
    id: json.id,
    title: json.title,
    artistCredit: joinArtistCredit(json['artist-credit']),
    date: json.date ?? '',
    tracks: extractTracks(json.media),
  };
}

export async function fetchReleaseGroupTracks(
  mbid: string,
): Promise<MusicBrainzTrack[]> {
  const json = (await mbFetch(
    `/release-group/${encodeURIComponent(mbid)}?inc=releases+media+recordings&fmt=json`,
  )) as { releases?: MbReleaseJson[] };
  const first = json.releases?.[0];
  if (!first) return [];
  // Need media on the actual release — re-fetch the release by id.
  const release = (await mbFetch(
    `/release/${encodeURIComponent(first.id)}?inc=recordings&fmt=json`,
  )) as MbReleaseJson;
  return extractTracks(release.media);
}
