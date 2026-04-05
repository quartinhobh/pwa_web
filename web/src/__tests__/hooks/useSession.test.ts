import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useSession } from '@/hooks/useSession';
import { useSessionStore } from '@/store/sessionStore';

describe('useSession', () => {
  beforeEach(() => {
    localStorage.clear();
    useSessionStore.setState({ sessionId: null, guestName: null, firebaseUid: null });
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('creates a guest session via POST /auth/guest when localStorage is empty', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ sessionId: 'sess-123', guestName: 'Coelho Curioso' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useSession());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/auth/guest'),
      expect.objectContaining({ method: 'POST' }),
    );
    expect(result.current.sessionId).toBe('sess-123');
    expect(result.current.guestName).toBe('Coelho Curioso');
    const stored = JSON.parse(localStorage.getItem('quartinho.session') || '{}');
    expect(stored.sessionId).toBe('sess-123');
  });

  it('loads existing session from localStorage without calling API', async () => {
    localStorage.setItem(
      'quartinho.session',
      JSON.stringify({ sessionId: 'sess-existing', guestName: 'Gato Quieto' }),
    );
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useSession());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.current.sessionId).toBe('sess-existing');
    expect(result.current.guestName).toBe('Gato Quieto');
  });
});
