import { useEffect, useState } from 'react';
import { fetchLyrics } from '@/services/api';
import { useApiCache } from '@/store/apiCache';

export interface UseLyricsResult {
  lyrics: string | null;
  source: string | null;
  loading: boolean;
  error: string | null;
}

interface LyricsCacheData {
  lyrics: string | null;
  source: string | null;
}

export function useLyrics(
  artist: string | null,
  title: string | null,
): UseLyricsResult {
  const cache = useApiCache();
  const cacheKey = artist && title ? `lyrics:${artist}:${title}` : null;

  const [data, setData] = useState<LyricsCacheData | null>(() => {
    return cacheKey ? cache.get<LyricsCacheData>(cacheKey) ?? null : null;
  });
  const [loading, setLoading] = useState(!data && !!artist && !!title);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!artist || !title) {
      setData(null);
      setLoading(false);
      return;
    }

    const cached = cache.get<LyricsCacheData>(cacheKey!);
    if (cached) {
      setData(cached);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    const run = async (): Promise<void> => {
      try {
        const res = await fetchLyrics(artist, title);
        if (cancelled) return;
        const result = { lyrics: res.lyrics, source: res.source };
        cache.set(cacheKey!, result);
        if (!cancelled) {
          setData(result);
          setLoading(false);
        }
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'unknown_error');
        setLoading(false);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [artist, title, cache, cacheKey]);

  if (!artist || !title) {
    return { lyrics: null, source: null, loading: false, error: null };
  }

  return {
    lyrics: data?.lyrics ?? null,
    source: data?.source ?? null,
    loading,
    error,
  };
}
