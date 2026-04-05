import { useEffect, useState } from 'react';
import { fetchLyrics } from '@/services/api';

export interface UseLyricsResult {
  lyrics: string | null;
  source: string | null;
  loading: boolean;
  error: string | null;
}

/**
 * useLyrics — loads lyrics for an (artist, title) pair via the api proxy.
 * Handles the "not found" state (lyrics = null) as a valid result, not an
 * error.
 */
export function useLyrics(
  artist: string | null,
  title: string | null,
): UseLyricsResult {
  const [lyrics, setLyrics] = useState<string | null>(null);
  const [source, setSource] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!artist || !title) {
      setLyrics(null);
      setSource(null);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    const run = async (): Promise<void> => {
      try {
        const res = await fetchLyrics(artist, title);
        if (cancelled) return;
        setLyrics(res.lyrics);
        setSource(res.source);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'unknown_error');
        setLyrics(null);
        setSource(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [artist, title]);

  return { lyrics, source, loading, error };
}
