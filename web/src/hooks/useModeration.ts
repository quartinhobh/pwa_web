// useModeration — P3-F.
// Thin wrapper around moderation API endpoints. Refetches bans after any
// mutation so ModerationPanel stays in sync.

import { useCallback, useEffect, useState } from 'react';
import {
  banUser as apiBanUser,
  deleteChatMessage as apiDeleteMessage,
  fetchBans,
  fetchModerationLogs,
  unbanUser as apiUnbanUser,
} from '@/services/api';
import { useApiCache } from '@/store/apiCache';
import type { Ban, ModerationLog } from '@/types';

export interface UseModerationResult {
  bans: Ban[];
  logs: ModerationLog[];
  loading: boolean;
  error: string | null;
  deleteMessage: (
    eventId: string,
    messageId: string,
    reason?: string,
  ) => Promise<void>;
  banUser: (userId: string, eventId?: string, reason?: string) => Promise<void>;
  unbanUser: (userId: string) => Promise<void>;
}

interface ModerationCacheData {
  bans: Ban[];
  logs: ModerationLog[];
}

const MODERATION_TTL = 60 * 1000; // 1 minute

async function fetchModerationData(
  idToken: string,
): Promise<ModerationCacheData> {
  const b = await fetchBans(idToken);
  let l: ModerationLog[] = [];
  try {
    l = await fetchModerationLogs(idToken);
  } catch {
    // logs are admin-only; moderator gets 403 — not an error for UI.
  }
  return { bans: b, logs: l };
}

export function useModeration(idToken: string | null): UseModerationResult {
  const cacheKey = 'moderation:bans';

  const cached = useApiCache.getState().get<ModerationCacheData>(cacheKey, MODERATION_TTL);
  const [data, setData] = useState<ModerationCacheData | null>(cached ?? null);
  const [loading, setLoading] = useState(!cached);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!idToken) {
      setData(null);
      setLoading(false);
      return;
    }

    let cancelled = false;

    const run = async () => {
      try {
        const result = await fetchModerationData(idToken);
        if (cancelled) return;
        useApiCache.getState().set(cacheKey, result);
        setData(result);
        setLoading(false);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'moderation_fetch_failed');
        setLoading(false);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [idToken, cacheKey]);

  const refetch = useCallback(async () => {
    if (!idToken) return;
    useApiCache.getState().invalidate(cacheKey);
    setLoading(true);
    setError(null);
    try {
      const result = await fetchModerationData(idToken);
      useApiCache.getState().set(cacheKey, result);
      setData(result);
      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'moderation_fetch_failed');
      setLoading(false);
    }
  }, [idToken, cacheKey]);

  const deleteMessage = useCallback(
    async (eventId: string, messageId: string, reason?: string) => {
      if (!idToken) throw new Error('not_authenticated');
      await apiDeleteMessage(eventId, messageId, idToken, reason);
      await refetch();
    },
    [idToken, refetch],
  );

  const banUser = useCallback(
    async (userId: string, eventId?: string, reason?: string) => {
      if (!idToken) throw new Error('not_authenticated');
      await apiBanUser(userId, idToken, eventId, reason);
      await refetch();
    },
    [idToken, refetch],
  );

  const unbanUser = useCallback(
    async (userId: string) => {
      if (!idToken) throw new Error('not_authenticated');
      await apiUnbanUser(userId, idToken);
      await refetch();
    },
    [idToken, refetch],
  );

  return {
    bans: data?.bans ?? [],
    logs: data?.logs ?? [],
    loading,
    error,
    deleteMessage,
    banUser,
    unbanUser,
  };
}
