import { useEffect, useState } from 'react';
import {
  GoogleAuthProvider,
  OAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  type User,
  type UserCredential,
} from 'firebase/auth';
import { auth } from '@/services/firebase';
import { fetchCurrentUser, postLinkSession } from '@/services/api';
import { useSessionStore } from '@/store/sessionStore';

export function useAuth() {
  const { sessionId, firebaseUid, setFirebaseUid, setUser: setStoreUser, clear } =
    useSessionStore();
  const [user, setUser] = useState<User | null>(auth.currentUser ?? null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (next) => setUser(next));
    return unsub;
  }, []);

  /** Shared post-sign-in: link session + pull profile. */
  async function afterSignIn(result: UserCredential): Promise<void> {
    const idToken = await result.user.getIdToken();
    try {
      const linked = await postLinkSession(idToken, sessionId);
      setFirebaseUid(linked.firebaseUid);
    } catch {
      // API unreachable (offline, emulator not running) — tolerate.
      setFirebaseUid(result.user.uid);
    }
    try {
      const me = await fetchCurrentUser(idToken);
      setStoreUser(me);
    } catch {
      // Leave defaults.
    }
  }

  const signInWithGoogle = async () => {
    const result = await signInWithPopup(auth, new GoogleAuthProvider());
    await afterSignIn(result);
  };

  const signInWithApple = async () => {
    const provider = new OAuthProvider('apple.com');
    provider.addScope('email');
    provider.addScope('name');
    const result = await signInWithPopup(auth, provider);
    await afterSignIn(result);
  };

  const signInWithEmail = async (email: string, password: string) => {
    const result = await signInWithEmailAndPassword(auth, email, password);
    await afterSignIn(result);
  };

  const signUpWithEmail = async (email: string, password: string) => {
    const result = await createUserWithEmailAndPassword(auth, email, password);
    await afterSignIn(result);
  };

  const signOut = async () => {
    await firebaseSignOut(auth);
    setUser(null);
    setFirebaseUid(null);
    clear();
  };

  return {
    user,
    isAuthenticated: firebaseUid !== null || !!user,
    signInWithGoogle,
    signInWithApple,
    signInWithEmail,
    signUpWithEmail,
    signOut,
  };
}
