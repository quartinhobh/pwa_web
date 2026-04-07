import { create } from 'zustand';
import { persist, type PersistStorage, type StorageValue } from 'zustand/middleware';
import type { UserRole } from '@/types';

const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

interface PersistedWithTimestamp<T> {
  state: T;
  version?: number;
  savedAt: number;
}

const expiringStorage: PersistStorage<unknown> = {
  getItem(name: string) {
    const raw = localStorage.getItem(name);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as PersistedWithTimestamp<unknown>;
      if (parsed.savedAt && Date.now() - parsed.savedAt > SESSION_MAX_AGE_MS) {
        localStorage.removeItem(name);
        return null;
      }
      return parsed as unknown as StorageValue<unknown>;
    } catch {
      return null;
    }
  },
  setItem(name: string, value: StorageValue<unknown>) {
    localStorage.setItem(name, JSON.stringify({ ...value, savedAt: Date.now() }));
  },
  removeItem(name: string) {
    localStorage.removeItem(name);
  },
};

export interface SessionUser {
  userId: string;
  email: string | null;
  displayName: string;
  username?: string | null;
  role: UserRole;
  avatarUrl?: string | null;
}

export interface SessionState {
  sessionId: string | null;
  guestName: string | null;
  firebaseUid: string | null;
  role: UserRole;
  email: string | null;
  displayName: string | null;
  username: string | null;
  avatarUrl: string | null;
  setSession: (s: { sessionId: string; guestName: string }) => void;
  setFirebaseUid: (uid: string | null) => void;
  setRole: (role: UserRole) => void;
  setUser: (user: SessionUser) => void;
  clear: () => void;
}

export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      sessionId: null,
      guestName: null,
      firebaseUid: null,
      role: 'guest',
      email: null,
      displayName: null,
      username: null,
      avatarUrl: null,
      setSession: ({ sessionId, guestName }) => set({ sessionId, guestName }),
      setFirebaseUid: (firebaseUid) => set({ firebaseUid }),
      setRole: (role) => set({ role }),
      setUser: (user) =>
        set({
          firebaseUid: user.userId,
          role: user.role,
          email: user.email,
          displayName: user.displayName,
          username: user.username ?? null,
          avatarUrl: user.avatarUrl ?? null,
        }),
      clear: () =>
        set({
          sessionId: null,
          guestName: null,
          firebaseUid: null,
          role: 'guest',
          email: null,
          displayName: null,
          username: null,
          avatarUrl: null,
        }),
    }),
    {
      name: 'quartinho:session',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      storage: expiringStorage as any,
      // Only persist identity fields, not actions.
      partialize: (s) => ({
        sessionId: s.sessionId,
        guestName: s.guestName,
        firebaseUid: s.firebaseUid,
        role: s.role,
        email: s.email,
        displayName: s.displayName,
        username: s.username,
        avatarUrl: s.avatarUrl,
      }),
    },
  ),
);
