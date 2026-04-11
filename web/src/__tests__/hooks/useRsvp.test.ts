import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';

vi.mock('@/services/api', () => ({
  fetchRsvpSummary: vi.fn(),
  fetchUserRsvp: vi.fn(),
  submitRsvp: vi.fn(),
  cancelRsvp: vi.fn(),
}));

vi.mock('@/store/apiCache', () => ({
  useApiCache: { getState: () => ({ get: () => null, set: vi.fn() }) },
}));

import { useRsvp } from '@/hooks/useRsvp';
import {
  fetchRsvpSummary,
  fetchUserRsvp,
  submitRsvp,
  cancelRsvp,
} from '@/services/api';
import type { RsvpSummary, RsvpEntry } from '@/types';

const baseSummary: RsvpSummary = {
  confirmedCount: 5,
  waitlistCount: 0,
  capacity: 30,
  confirmedAvatars: [],
};

const confirmedEntry: RsvpEntry = {
  status: 'confirmed',
  plusOne: false,
  plusOneName: null,
  email: 'a@test.com',
  displayName: 'A',
  authMode: 'firebase',
  createdAt: 1000,
  updatedAt: 1000,
};

function mocks() {
  return {
    fetchRsvpSummary: fetchRsvpSummary as Mock,
    fetchUserRsvp: fetchUserRsvp as Mock,
    submitRsvp: submitRsvp as Mock,
    cancelRsvp: cancelRsvp as Mock,
  };
}

beforeEach(() => {
  vi.resetAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useRsvp', () => {
  it('returns loading=true initially, then sets summary after fetch', async () => {
    const m = mocks();
    m.fetchRsvpSummary.mockResolvedValue(baseSummary);
    m.fetchUserRsvp.mockResolvedValue(null);

    const { result } = renderHook(() => useRsvp('evt1', 'tok'));

    expect(result.current.loading).toBe(true);

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.summary?.confirmedCount).toBe(5);
    expect(result.current.error).toBeNull();
  });

  it('returns null summary when eventId is null', async () => {
    const { result } = renderHook(() => useRsvp(null, 'tok'));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.summary).toBeNull();
    expect(result.current.userEntry).toBeNull();
  });

  it('submit() calls apiSubmit and refetches summary', async () => {
    const m = mocks();
    m.fetchRsvpSummary.mockResolvedValue(baseSummary);
    m.fetchUserRsvp.mockResolvedValue(null);
    m.submitRsvp.mockResolvedValue({ entry: confirmedEntry });

    const { result } = renderHook(() => useRsvp('evt1', 'tok'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    const updatedSummary: RsvpSummary = { ...baseSummary, confirmedCount: 6 };
    m.fetchRsvpSummary.mockResolvedValue(updatedSummary);

    await act(async () => {
      await result.current.submit();
    });

    expect(m.submitRsvp).toHaveBeenCalledWith('evt1', 'tok', undefined);
    expect(m.fetchRsvpSummary).toHaveBeenCalledTimes(2);
    expect(result.current.userEntry?.status).toBe('confirmed');
  });

  it('cancel() calls apiCancel and refetches summary', async () => {
    const m = mocks();
    m.fetchRsvpSummary.mockResolvedValue(baseSummary);
    m.fetchUserRsvp.mockResolvedValue(confirmedEntry);
    m.cancelRsvp.mockResolvedValue(undefined);

    const { result } = renderHook(() => useRsvp('evt1', 'tok'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    const updatedSummary: RsvpSummary = { ...baseSummary, confirmedCount: 4 };
    m.fetchRsvpSummary.mockResolvedValue(updatedSummary);

    await act(async () => {
      await result.current.cancel();
    });

    expect(m.cancelRsvp).toHaveBeenCalledWith('evt1', 'tok');
    expect(m.fetchRsvpSummary).toHaveBeenCalledTimes(2);
    expect(result.current.userEntry).toBeNull();
  });
});
