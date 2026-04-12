import { useEffect, useRef, useState } from 'react';
import {
  GoogleAuthProvider,
  OAuthProvider,
  onAuthStateChanged,
  sendEmailVerification,
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

  // Guard: when afterSignIn is running, onAuthStateChanged must NOT call
  // /auth/me — otherwise it races and overwrites role with 'guest' before
  // postLinkSession has created the user doc.
  const signingIn = useRef(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (next) => {
      setUser(next);
      if (next && !signingIn.current) {
        // Re-hydrate on page refresh (not during active sign-in).
        setFirebaseUid(next.uid);
        try {
          const idToken = await next.getIdToken();
          const me = await fetchCurrentUser(idToken);
          setStoreUser(me);
        } catch {
          // API offline — keep whatever localStorage had.
        }
      }
    });
    return unsub;
  }, [setFirebaseUid, setStoreUser]);

  async function afterSignIn(result: UserCredential): Promise<void> {
    // signingIn.current already set to true by the caller BEFORE signInWithPopup
    try {
      const idToken = await result.user.getIdToken();
      try {
        const linked = await postLinkSession(idToken, sessionId);
        setFirebaseUid(linked.firebaseUid);
      } catch {
        setFirebaseUid(result.user.uid);
      }
      try {
        const me = await fetchCurrentUser(idToken);
        setStoreUser(me);
      } catch {
        // Leave defaults.
      }
    } finally {
      signingIn.current = false;
    }
  }

  const signInWithGoogle = async () => {
    signingIn.current = true;
    const result = await signInWithPopup(auth, new GoogleAuthProvider());
    await afterSignIn(result);
  };

  const signInWithApple = async () => {
    signingIn.current = true;
    const provider = new OAuthProvider('apple.com');
    provider.addScope('email');
    provider.addScope('name');
    const result = await signInWithPopup(auth, provider);
    await afterSignIn(result);
  };

  const signInWithEmail = async (email: string, password: string) => {
    signingIn.current = true;
    const result = await signInWithEmailAndPassword(auth, email, password);
    await afterSignIn(result);
  };

  const signUpWithEmail = async (email: string, password: string) => {
    signingIn.current = true;
    const result = await createUserWithEmailAndPassword(auth, email, password);
    // Fire verification email. Don't block signup flow on failure — logged
    // for diagnostics but swallowed so the caller still gets a success.
    try {
      await sendEmailVerification(result.user, {
        url: `${window.location.origin}/`,
        handleCodeInApp: false,
      });
    } catch (err) {
      console.error('[useAuth] sendEmailVerification failed', err);
    }
    await afterSignIn(result);
  };

  const resendVerificationEmail = async () => {
    if (!auth.currentUser) throw new Error('not_signed_in');
    await sendEmailVerification(auth.currentUser, {
      url: `${window.location.origin}/`,
      handleCodeInApp: false,
    });
  };

  const signOut = async () => {
    await firebaseSignOut(auth);
    setUser(null);
    setFirebaseUid(null);
    clear();
  };

  // OAuth providers (Google, Apple) always return verified emails.
  // For password provider, require Firebase-side verification.
  const isOAuthProvider =
    user?.providerData?.some(
      (p) => p.providerId === 'google.com' || p.providerId === 'apple.com',
    ) ?? false;
  const emailVerified = user?.emailVerified ?? false;

  return {
    user,
    emailVerified,
    isAuthenticated:
      firebaseUid !== null && (user?.emailVerified !== false || isOAuthProvider),
    signInWithGoogle,
    signInWithApple,
    signInWithEmail,
    signUpWithEmail,
    resendVerificationEmail,
    signOut,
  };
}
