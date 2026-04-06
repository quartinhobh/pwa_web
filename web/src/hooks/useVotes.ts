import { useCallback, useEffect, useState } from 'react';
import { fetchTallies, fetchUserVote, postVote } from '@/services/api';
import { useApiCache } from '@/store/apiCache';
import type { UserVote, VoteBucket, VoteTallies } from '@/types';

export interface UseVotesResult {
  tallies: VoteTallies | null;
  userVote: UserVote | null;
  submitVote: (
    favoriteTrackId: string,
    leastLikedTrackId: string,
  ) => Promise<void>;
  loading: boolean;
  error: string | null;
}

interface VotesCacheData {
  tallies: VoteTallies | null;
  userVote: UserVote | null;
}

function cloneTallies(t: VoteTallies): VoteTallies {
  const clone = (bs: Record<string, VoteBucket>): Record<string, VoteBucket> => {
    const out: Record<string, VoteBucket> = {};
    for (const k of Object.keys(bs)) {
      const b = bs[k]!;
      out[k] = { count: b.count, voterIds: [...b.voterIds] };
    }
    return out;
  };
  return {
    favorites: clone(t.favorites),
    leastLiked: clone(t.leastLiked),
    updatedAt: t.updatedAt,
  };
}

function applyOptimistic(
  current: VoteTallies,
  prior: UserVote | null,
  uid: string,
  fav: string,
  least: string,
): VoteTallies {
  const next = cloneTallies(current);
  const dec = (buckets: Record<string, VoteBucket>, trackId: string): void => {
    const b = buckets[trackId];
    if (!b) return;
    b.voterIds = b.voterIds.filter((id) => id !== uid);
    b.count = Math.max(0, b.count - 1);
    if (b.count === 0 && b.voterIds.length === 0) delete buckets[trackId];
  };
  const inc = (buckets: Record<string, VoteBucket>, trackId: string): void => {
    const b = buckets[trackId] ?? { count: 0, voterIds: [] };
    if (!b.voterIds.includes(uid)) {
      b.voterIds = [...b.voterIds, uid];
      b.count += 1;
    }
    buckets[trackId] = b;
  };
  if (prior) {
    dec(next.favorites, prior.favoriteTrackId);
    dec(next.leastLiked, prior.leastLikedTrackId);
  }
  inc(next.favorites, fav);
  inc(next.leastLiked, least);
  next.updatedAt = Date.now();
  return next;
}

const VOTES_TTL = 30 * 1000; // 30 seconds

export function useVotes(
  eventId: string | null,
  idToken: string | null,
  uid: string | null,
): UseVotesResult {
  const cache = useApiCache();
  const cacheKey = eventId ? `votes:${eventId}` : null;

  const [data, setData] = useState<VotesCacheData | null>(() => {
    return cacheKey ? cache.get<VotesCacheData>(cacheKey, VOTES_TTL) ?? null : null;
  });
  const [loading, setLoading] = useState(!data && !!eventId);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!eventId) {
      setData(null);
      setLoading(false);
      return;
    }

    const cached = cache.get<VotesCacheData>(cacheKey!, VOTES_TTL);
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
        const [t, v] = await Promise.all([
          fetchTallies(eventId),
          fetchUserVote(eventId, idToken),
        ]);
        if (cancelled) return;
        const result = { tallies: t, userVote: v };
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
  }, [eventId, idToken, cache, cacheKey]);

  const submitVote = useCallback(
    async (favoriteTrackId: string, leastLikedTrackId: string): Promise<void> => {
      if (!eventId || !idToken) {
        throw new Error('not_authenticated');
      }
      if (favoriteTrackId === leastLikedTrackId) {
        throw new Error('duplicate_track');
      }
      const priorData = data;
      if (priorData?.tallies && uid) {
        const optimistic = applyOptimistic(
          priorData.tallies,
          priorData.userVote,
          uid,
          favoriteTrackId,
          leastLikedTrackId,
        );
        setData({
          tallies: optimistic,
          userVote: {
            favoriteTrackId,
            leastLikedTrackId,
            updatedAt: Date.now(),
          },
        });
      }
      try {
        const next = await postVote(
          eventId,
          idToken,
          favoriteTrackId,
          leastLikedTrackId,
        );
        const result = {
          tallies: next,
          userVote: {
            favoriteTrackId,
            leastLikedTrackId,
            updatedAt: next.updatedAt,
          },
        };
        cache.set(cacheKey!, result);
        setData(result);
      } catch (err) {
        setData(priorData);
        setError(err instanceof Error ? err.message : 'vote_failed');
        throw err;
      }
    },
    [eventId, idToken, uid, data, cache, cacheKey],
  );

  return {
    tallies: data?.tallies ?? null,
    userVote: data?.userVote ?? null,
    submitVote,
    loading,
    error,
  };
}
