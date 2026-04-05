import { useState } from 'react';
import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut as firebaseSignOut,
  type User,
} from 'firebase/auth';
import { auth } from '@/services/firebase';
import { postLinkSession } from '@/services/api';
import { useSessionStore } from '@/store/sessionStore';

export function useAuth() {
  const { sessionId, firebaseUid, setFirebaseUid } = useSessionStore();
  const [user, setUser] = useState<User | null>(null);

  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(auth, provider);
    const idToken = await result.user.getIdToken();
    const linked = await postLinkSession(idToken, sessionId);
    setUser(result.user);
    setFirebaseUid(linked.firebaseUid);
  };

  const signOut = async () => {
    await firebaseSignOut(auth);
    setUser(null);
    setFirebaseUid(null);
  };

  return {
    user,
    isAuthenticated: firebaseUid !== null,
    signInWithGoogle,
    signOut,
  };
}
