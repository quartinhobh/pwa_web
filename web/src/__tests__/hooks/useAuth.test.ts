import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

vi.mock('firebase/auth', () => {
  return {
    getAuth: vi.fn(() => ({})),
    GoogleAuthProvider: vi.fn(),
    OAuthProvider: vi.fn(() => ({ addScope: vi.fn() })),
    signInWithPopup: vi.fn(),
    signInWithEmailAndPassword: vi.fn(),
    createUserWithEmailAndPassword: vi.fn(),
    signOut: vi.fn(),
    connectAuthEmulator: vi.fn(),
    onAuthStateChanged: vi.fn(() => () => {}),
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
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, firebaseUid: 'uid-999' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          userId: 'uid-999',
          email: 'a@b.com',
          displayName: 'A',
          role: 'user',
        }),
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

  it('signInWithGoogle fetches /auth/me and stores role/email/displayName', async () => {
    signInWithPopupMock.mockResolvedValue({
      user: { uid: 'uid-admin', getIdToken: vi.fn().mockResolvedValue('idtok-admin') },
    });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, firebaseUid: 'uid-admin' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          userId: 'uid-admin',
          email: 'admin@quartinho.test',
          displayName: 'Gustavo',
          role: 'admin',
        }),
      });
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useAuth());
    await act(async () => {
      await result.current.signInWithGoogle();
    });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/auth/me'),
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer idtok-admin' }),
      }),
    );
    await waitFor(() => {
      const state = useSessionStore.getState();
      expect(state.role).toBe('admin');
      expect(state.email).toBe('admin@quartinho.test');
      expect(state.displayName).toBe('Gustavo');
    });
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
