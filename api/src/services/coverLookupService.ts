// Free-text cover lookup. Used by the admin suggestions panel: callers pass
// the suggestion's free-text title (which often packs "album - artist" into
// a single string). We search MusicBrainz, accept the top hit only when both
// its title and artistCredit match (token-set, robust to "&" vs "e" and to
// "Title - Artist" vs "Artist - Title" inversions), then run the cover
// waterfall (CAA → Deezer → Last.fm) on that release. Returns null when not
// confident or no cover anywhere.

import { searchReleases } from './musicbrainzService';
import { fetchCoverArt } from './coverArtService';

function normalizeForMatch(s: string): string {
  return s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Connectors that vary across sources (MB joins artists with "&", users type
// "e"/"and"/etc.) and 1-char fragments from punctuation collapse — both are
// excluded so they don't artificially fail the match.
const TOKEN_STOPWORDS = new Set(['e', 'y', 'and', 'the', 'de', 'da', 'do']);

function tokenize(s: string): string[] {
  return normalizeForMatch(s)
    .split(' ')
    .filter((t) => t.length > 1 && !TOKEN_STOPWORDS.has(t));
}

export interface CoverLookupResult {
  mbid: string;
  coverUrl: string;
}

export async function lookupCoverByText(
  query: string,
): Promise<CoverLookupResult | null> {
  const trimmed = query.trim();
  if (!trimmed) return null;

  const results = await searchReleases(trimmed, 5, '');
  const top = results[0];
  if (!top) return null;

  const queryTokens = new Set(tokenize(trimmed));
  const titleTokens = tokenize(top.title);
  const artistTokens = tokenize(top.artistCredit);
  const confident =
    titleTokens.length > 0 &&
    artistTokens.length > 0 &&
    titleTokens.every((t) => queryTokens.has(t)) &&
    artistTokens.every((t) => queryTokens.has(t));
  if (!confident) return null;

  const { coverUrl } = await fetchCoverArt({
    mbid: top.id,
    artistCredit: top.artistCredit,
    albumTitle: top.title,
  });
  if (!coverUrl) return null;

  return { mbid: top.id, coverUrl };
}
