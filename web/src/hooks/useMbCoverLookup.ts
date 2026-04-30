import { useEffect, useState } from 'react';
import { searchMusicBrainz } from '@/services/api';

function normalize(s: string): string {
  return s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const moduleCache = new Map<string, string | null>();

/**
 * Lookup a cover URL on MusicBrainz using the suggestion's free-text title.
 * Suggestion forms have a single "name" input, so the title may include the
 * artist (e.g. "Cartola (1976) - Cartola"). We send the whole string as the
 * MB query and only return a cover if both MB's `title` and `artistCredit`
 * appear (normalized substring) in the original query — otherwise we don't
 * know if the top hit is the right release and prefer to show nothing.
 *
 * Returns null until lookup completes; null after completion means "no
 * confident match" and the caller should render its empty state.
 */
export function useMbCoverLookup(
  albumTitle: string | null | undefined,
  artistName: string | null | undefined,
  existingCoverUrl: string | null | undefined,
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
    const normQuery = normalize(query);
    if (!normQuery) {
      setCover(null);
      return;
    }

    if (moduleCache.has(normQuery)) {
      setCover(moduleCache.get(normQuery) ?? null);
      return;
    }

    let cancelled = false;
    setCover(null);
    searchMusicBrainz(query)
      .then((results) => {
        if (cancelled) return;
        const top = results[0];
        if (!top || !top.coverUrl) {
          moduleCache.set(normQuery, null);
          return;
        }
        const normTitle = normalize(top.title);
        const normArtist = normalize(top.artistCredit);
        const confident =
          normTitle.length > 0 &&
          normArtist.length > 0 &&
          normQuery.includes(normTitle) &&
          normQuery.includes(normArtist);
        const resolved = confident ? top.coverUrl : null;
        moduleCache.set(normQuery, resolved);
        setCover(resolved);
      })
      .catch(() => {
        if (cancelled) return;
        moduleCache.set(normQuery, null);
        setCover(null);
      });

    return () => {
      cancelled = true;
    };
  }, [albumTitle, artistName, existingCoverUrl]);

  return cover;
}
