import type { LocalSession, FirebaseUidStore } from '../types';

const SESSION_KEY = 'quartinho_session';
const UID_KEY = 'quartinho_firebase_uid';

function safeParse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function getSession(): LocalSession | null {
  if (typeof window === 'undefined') return null;
  return safeParse<LocalSession>(window.localStorage.getItem(SESSION_KEY));
}

export function setSession(s: LocalSession): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(SESSION_KEY, JSON.stringify(s));
}

export function clearSession(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(SESSION_KEY);
}

export function getFirebaseUid(): FirebaseUidStore | null {
  if (typeof window === 'undefined') return null;
  return safeParse<FirebaseUidStore>(window.localStorage.getItem(UID_KEY));
}

export function setFirebaseUid(u: FirebaseUidStore): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(UID_KEY, JSON.stringify(u));
}
