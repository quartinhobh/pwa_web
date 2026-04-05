import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

vi.mock('firebase/auth', () => {
  return {
    getAuth: vi.fn(() => ({})),
    GoogleAuthProvider: vi.fn(),
    signInWithPopup: vi.fn(),
    signOut: vi.fn(),
    connectAuthEmulator: vi.fn(),
  };
});

import * as firebaseAuth from 'firebase/auth';
const signInWithPopupMock = firebaseAuth.signInWithPopup as unknown as ReturnType<typeof vi.fn>;
const signOutMock = firebaseAuth.signOut as unknown as ReturnType<typeof vi.fn>;

vi.mock('@/services/firebase', () => ({
  firebaseApp: {},
  auth: {},
  firestore: {},
  realtimeDb: {},
  storage: {},
}));

import { useAuth } from '@/hooks/useAuth';
import { useSessionStore } from '@/store/sessionStore';

describe('useAuth', () => {
  beforeEach(() => {
    localStorage.clear();
    useSessionStore.setState({
      sessionId: 'sess-123',
      guestName: 'Coelho Curioso',
      firebaseUid: null,
    });
    signInWithPopupMock.mockReset();
    signOutMock.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('starts in anonymous state', () => {
    const { result } = renderHook(() => useAuth());
    expect(result.current.user).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
  });

  it('signInWithGoogle calls firebase popup then links session via /auth/link', async () => {
    signInWithPopupMock.mockResolvedValue({
      user: { uid: 'uid-999', getIdToken: vi.fn().mockResolvedValue('idtok-abc') },
    });
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, firebaseUid: 'uid-999' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useAuth());
    await act(async () => {
      await result.current.signInWithGoogle();
    });

    expect(signInWithPopupMock).toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/auth/link'),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer idtok-abc' }),
      }),
    );
    await waitFor(() => expect(useSessionStore.getState().firebaseUid).toBe('uid-999'));
  });

  it('signOut clears firebaseUid in the store', async () => {
    useSessionStore.setState({
      sessionId: 'sess-123',
      guestName: 'Coelho',
      firebaseUid: 'uid-999',
    });
    signOutMock.mockResolvedValue(undefined);

    const { result } = renderHook(() => useAuth());
    await act(async () => {
      await result.current.signOut();
    });

    expect(signOutMock).toHaveBeenCalled();
    expect(useSessionStore.getState().firebaseUid).toBeNull();
  });
});
