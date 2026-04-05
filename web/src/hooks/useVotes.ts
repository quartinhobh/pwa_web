// useVotes — P3-D.
// Loads tallies + current user's vote for an event. Exposes an optimistic
// submitVote that rolls back on failure.

import { useCallback, useEffect, useState } from 'react';
import { fetchTallies, fetchUserVote, postVote } from '@/services/api';
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

export function useVotes(
  eventId: string | null,
  idToken: string | null,
  uid: string | null,
): UseVotesResult {
  const [tallies, setTallies] = useState<VoteTallies | null>(null);
  const [userVote, setUserVote] = useState<UserVote | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!eventId) {
      setTallies(null);
      setUserVote(null);
      setLoading(false);
      setError(null);
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
        setTallies(t);
        setUserVote(v);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'unknown_error');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [eventId, idToken]);

  const submitVote = useCallback(
    async (favoriteTrackId: string, leastLikedTrackId: string): Promise<void> => {
      if (!eventId || !idToken) {
        throw new Error('not_authenticated');
      }
      if (favoriteTrackId === leastLikedTrackId) {
        throw new Error('duplicate_track');
      }
      const priorTallies = tallies;
      const priorVote = userVote;
      if (priorTallies && uid) {
        const optimistic = applyOptimistic(
          priorTallies,
          priorVote,
          uid,
          favoriteTrackId,
          leastLikedTrackId,
        );
        setTallies(optimistic);
        setUserVote({
          favoriteTrackId,
          leastLikedTrackId,
          updatedAt: Date.now(),
        });
      }
      try {
        const next = await postVote(
          eventId,
          idToken,
          favoriteTrackId,
          leastLikedTrackId,
        );
        setTallies(next);
        setUserVote({
          favoriteTrackId,
          leastLikedTrackId,
          updatedAt: next.updatedAt,
        });
      } catch (err) {
        // Rollback
        setTallies(priorTallies);
        setUserVote(priorVote);
        setError(err instanceof Error ? err.message : 'vote_failed');
        throw err;
      }
    },
    [eventId, idToken, uid, tallies, userVote],
  );

  return { tallies, userVote, submitVote, loading, error };
}
