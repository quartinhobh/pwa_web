import { useEffect, useState } from 'react';
import { searchMusicBrainz, type MbSearchResult } from '@/services/api';

interface UseMusicBrainzSearchOptions {
  debounceMs?: number;
  minLength?: number;
}

export interface UseMusicBrainzSearchReturn {
  query: string;
  setQuery: (value: string) => void;
  results: MbSearchResult[];
  searching: boolean;
  reset: () => void;
}

/**
 * Debounced MusicBrainz album search. Owns query/results/loading state so
 * callsites only worry about rendering the input and the result list.
 * Used by admin EventForm (pick album for event) and Profile (pick favorite
 * albums), and designed to be reused by future discovery features.
 */
export function useMusicBrainzSearch(
  opts: UseMusicBrainzSearchOptions = {},
): UseMusicBrainzSearchReturn {
  const debounceMs = opts.debounceMs ?? 400;
  const minLength = opts.minLength ?? 2;

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<MbSearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (query.length < minLength) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    let cancelled = false;
    const timer = setTimeout(() => {
      searchMusicBrainz(query)
        .then((r) => { if (!cancelled) setResults(r); })
        .catch(() => { if (!cancelled) setResults([]); })
        .finally(() => { if (!cancelled) setSearching(false); });
    }, debounceMs);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, debounceMs, minLength]);

  const reset = () => {
    setQuery('');
    setResults([]);
    setSearching(false);
  };

  return { query, setQuery, results, searching, reset };
}
