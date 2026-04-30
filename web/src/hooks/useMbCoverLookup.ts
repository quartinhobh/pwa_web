import { useEffect, useState } from 'react';
import { enrichAlbumSuggestionCover, lookupCoverByName } from '@/services/api';

const moduleCache = new Map<string, string | null>();

/**
 * Resolve a verified cover URL for a free-text suggestion. Suggestion forms
 * have a single "name" field, so the title may pack album + artist together
 * (e.g. "Cartola (1976) - Cartola"). The backend runs the search + waterfall
 * (CAA → Deezer → Last.fm) and only returns a URL when confident.
 *
 * When `suggestionId` + `idToken` are passed, calls the admin-only enrich
 * endpoint instead — same lookup, but the result is persisted on the doc so
 * the next list read includes it inline. Without those args, falls back to
 * the public read-only endpoint.
 *
 * Returns the existing cover when one is already stored on the suggestion;
 * otherwise null until the lookup resolves. Null after lookup means "no
 * confident match found anywhere" — caller should render no media.
 */
export function useMbCoverLookup(
  albumTitle: string | null | undefined,
  artistName: string | null | undefined,
  existingCoverUrl: string | null | undefined,
  suggestionId?: string,
  idToken?: string | null,
): string | null {
  const [cover, setCover] = useState<string | null>(existingCoverUrl ?? null);

  useEffect(() => {
    if (existingCoverUrl) {
      setCover(existingCoverUrl);
      return;
    }
    const title = (albumTitle ?? '').trim();
    if (!title) {
      setCover(null);
      return;
    }
    const query = artistName?.trim() ? `${title} ${artistName.trim()}` : title;
    const cacheKey = query.toLowerCase();
    if (moduleCache.has(cacheKey)) {
      setCover(moduleCache.get(cacheKey) ?? null);
      return;
    }
    let cancelled = false;
    setCover(null);
    const lookup = suggestionId && idToken
      ? enrichAlbumSuggestionCover(suggestionId, idToken)
      : lookupCoverByName(query);
    lookup.then((url) => {
      if (cancelled) return;
      moduleCache.set(cacheKey, url);
      setCover(url);
    });
    return () => {
      cancelled = true;
    };
  }, [albumTitle, artistName, existingCoverUrl, suggestionId, idToken]);

  return cover;
}
