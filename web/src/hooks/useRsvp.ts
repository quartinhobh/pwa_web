import { useCallback, useEffect, useState } from 'react';
import {
  fetchRsvpSummary,
  fetchUserRsvp,
  submitRsvp as apiSubmit,
  cancelRsvp as apiCancel,
} from '@/services/api';
import { useApiCache } from '@/store/apiCache';
import type { RsvpEntry, RsvpSummary } from '@/types';

export interface UseRsvpResult {
  summary: RsvpSummary | null;
  userEntry: RsvpEntry | null;
  submit: (opts?: { plusOne?: boolean; plusOneName?: string }) => Promise<void>;
  cancel: () => Promise<void>;
  loading: boolean;
  error: string | null;
}

interface RsvpCacheData {
  summary: RsvpSummary | null;
  userEntry: RsvpEntry | null;
}

const RSVP_TTL = 30 * 1000; // 30s

export function useRsvp(
  eventId: string | null,
  idToken: string | null,
): UseRsvpResult {
  const cacheKey = eventId ? `rsvp:${eventId}` : null;
  const cached = cacheKey ? useApiCache.getState().get<RsvpCacheData>(cacheKey, RSVP_TTL) : null;

  const [data, setData] = useState<RsvpCacheData | null>(cached ?? null);
  const [loading, setLoading] = useState(!cached && !!eventId);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!eventId || !cacheKey) {
      setData(null);
      setLoading(false);
      return;
    }

    let cancelled = false;

    const run = async () => {
      try {
        const [summary, userEntry] = await Promise.all([
          fetchRsvpSummary(eventId),
          fetchUserRsvp(eventId, idToken),
        ]);
        if (cancelled) return;
        const result = { summary, userEntry };
        useApiCache.getState().set(cacheKey, result);
        setData(result);
        setLoading(false);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'rsvp_load_failed');
        setLoading(false);
      }
    };

    void run();
    return () => { cancelled = true; };
  }, [eventId, idToken, cacheKey]);

  const submit = useCallback(
    async (opts?: { plusOne?: boolean; plusOneName?: string }) => {
      if (!eventId || !idToken) throw new Error('not_authenticated');

      const prior = data;

      try {
        const { entry } = await apiSubmit(eventId, idToken, opts);
        // Refetch summary for accurate counts
        const summary = await fetchRsvpSummary(eventId);
        const result = { summary, userEntry: entry };
        useApiCache.getState().set(cacheKey!, result);
        setData(result);
      } catch (err) {
        setData(prior);
        const msg = err instanceof Error ? err.message : 'rsvp_failed';
        setError(msg);
        throw err;
      }
    },
    [eventId, idToken, data, cacheKey],
  );

  const cancel = useCallback(async () => {
    if (!eventId || !idToken) throw new Error('not_authenticated');

    const prior = data;
    // Optimistic: decrement + clear user entry
    if (prior?.summary) {
      setData({
        summary: {
          ...prior.summary,
          confirmedCount: Math.max(0, prior.summary.confirmedCount - 1),
        },
        userEntry: null,
      });
    }

    try {
      await apiCancel(eventId, idToken);
      const summary = await fetchRsvpSummary(eventId);
      const result = { summary, userEntry: null };
      useApiCache.getState().set(cacheKey!, result);
      setData(result);
    } catch (err) {
      setData(prior);
      setError(err instanceof Error ? err.message : 'cancel_failed');
      throw err;
    }
  }, [eventId, idToken, data, cacheKey]);

  return {
    summary: data?.summary ?? null,
    userEntry: data?.userEntry ?? null,
    submit,
    cancel,
    loading,
    error,
  };
}
