import { useEffect, useState } from 'react';
import { fetchBarFeedback } from '@/services/api';

const moduleCache = new Map<string, { liked: number; disliked: number }>();

/**
 * Read-only liked/disliked counts for a bar. Light alternative to
 * useBarFeedback when the caller doesn't need voting actions or the user's
 * own vote — used by the admin panel to surface community sentiment.
 */
export function useBarFeedbackCounts(
  barId: string,
): { liked: number; disliked: number } | null {
  const [counts, setCounts] = useState<{ liked: number; disliked: number } | null>(
    () => moduleCache.get(barId) ?? null,
  );

  useEffect(() => {
    const cached = moduleCache.get(barId);
    if (cached) {
      setCounts(cached);
      return;
    }
    let cancelled = false;
    fetchBarFeedback(barId)
      .then((data) => {
        if (cancelled) return;
        const next = { liked: data.liked, disliked: data.disliked };
        moduleCache.set(barId, next);
        setCounts(next);
      })
      .catch(() => {
        if (cancelled) return;
        setCounts(null);
      });
    return () => {
      cancelled = true;
    };
  }, [barId]);

  return counts;
}
