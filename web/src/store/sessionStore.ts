import { create } from 'zustand';

export interface SessionState {
  sessionId: string | null;
  guestName: string | null;
  firebaseUid: string | null;
  setSession: (s: { sessionId: string; guestName: string }) => void;
  setFirebaseUid: (uid: string | null) => void;
  clear: () => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  sessionId: null,
  guestName: null,
  firebaseUid: null,
  setSession: ({ sessionId, guestName }) => set({ sessionId, guestName }),
  setFirebaseUid: (firebaseUid) => set({ firebaseUid }),
  clear: () => set({ sessionId: null, guestName: null, firebaseUid: null }),
}));
