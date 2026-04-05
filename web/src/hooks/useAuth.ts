import { useState } from 'react';
import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut as firebaseSignOut,
  type User,
} from 'firebase/auth';
import { auth } from '@/services/firebase';
import { fetchCurrentUser, postLinkSession } from '@/services/api';
import { useSessionStore } from '@/store/sessionStore';

export function useAuth() {
  const { sessionId, firebaseUid, setFirebaseUid, setUser: setStoreUser, clear } =
    useSessionStore();
  const [user, setUser] = useState<User | null>(null);

  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(auth, provider);
    const idToken = await result.user.getIdToken();
    const linked = await postLinkSession(idToken, sessionId);
    setUser(result.user);
    setFirebaseUid(linked.firebaseUid);
    // P3-H: pull canonical profile (role/email/displayName) from /auth/me.
    try {
      const me = await fetchCurrentUser(idToken);
      setStoreUser(me);
    } catch {
      // Leave defaults; /me failing should not break login.
    }
  };

  const signOut = async () => {
    await firebaseSignOut(auth);
    setUser(null);
    setFirebaseUid(null);
    clear();
  };

  return {
    user,
    isAuthenticated: firebaseUid !== null,
    signInWithGoogle,
    signOut,
  };
}
