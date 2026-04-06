import { useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/services/firebase';

/**
 * useIdToken — returns the current Firebase ID token, reactively.
 * Updates when auth state changes (login, logout, token refresh).
 * Returns null while Firebase Auth is still rehydrating from IndexedDB.
 */
export function useIdToken(): string | null {
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setToken(user ? await user.getIdToken() : null);
    });
    return unsub;
  }, []);

  return token;
}
