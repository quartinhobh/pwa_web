import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { UserRole } from '@/types';

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
