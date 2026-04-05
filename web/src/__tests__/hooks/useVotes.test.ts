import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useVotes } from '@/hooks/useVotes';
import type { VoteTallies } from '@/types';

const initialTallies: VoteTallies = {
  favorites: {},
  leastLiked: {},
  updatedAt: 0,
};

function queueJson(responses: Array<{ ok?: boolean; body: unknown; status?: number }>) {
  const queue = [...responses];
  globalThis.fetch = vi.fn(async () => {
    const next = queue.shift();
    if (!next) throw new Error('unexpected extra fetch');
    return {
      ok: next.ok ?? true,
      status: next.status ?? 200,
      json: async () => next.body,
    } as unknown as Response;
  }) as unknown as typeof fetch;
}

beforeEach(() => {
  vi.restoreAllMocks();
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe('useVotes', () => {
  it('fetches tallies + user vote on mount', async () => {
    queueJson([
      { body: initialTallies },
      { body: { vote: null } },
    ]);
    const { result } = renderHook(() => useVotes('evt1', 'tok', 'uid1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.tallies).not.toBeNull();
    expect(result.current.userVote).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('submitVote performs optimistic update and persists on success', async () => {
    const serverTallies: VoteTallies = {
      favorites: { tA: { count: 1, voterIds: ['uid1'] } },
      leastLiked: { tB: { count: 1, voterIds: ['uid1'] } },
      updatedAt: 123,
    };
    queueJson([
      { body: initialTallies },
      { body: { vote: null } },
      { body: serverTallies },
    ]);
    const { result } = renderHook(() => useVotes('evt1', 'tok', 'uid1'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.submitVote('tA', 'tB');
    });

    expect(result.current.tallies?.favorites.tA?.count).toBe(1);
    expect(result.current.tallies?.leastLiked.tB?.count).toBe(1);
    expect(result.current.userVote?.favoriteTrackId).toBe('tA');
    expect(result.current.userVote?.leastLikedTrackId).toBe('tB');
  });

  it('submitVote rolls back on failure', async () => {
    queueJson([
      { body: initialTallies },
      { body: { vote: null } },
      { ok: false, status: 500, body: { error: 'boom' } },
    ]);
    const { result } = renderHook(() => useVotes('evt1', 'tok', 'uid1'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await expect(result.current.submitVote('tA', 'tB')).rejects.toThrow();
    });

    // Rolled back to empty
    expect(result.current.tallies?.favorites.tA).toBeUndefined();
    expect(result.current.userVote).toBeNull();
    expect(result.current.error).not.toBeNull();
  });

  it('rejects submitVote when favorite === least', async () => {
    queueJson([
      { body: initialTallies },
      { body: { vote: null } },
    ]);
    const { result } = renderHook(() => useVotes('evt1', 'tok', 'uid1'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await expect(result.current.submitVote('tX', 'tX')).rejects.toThrow(
        'duplicate_track',
      );
    });
  });
});
