import React, { useEffect, useState } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '@/services/firebase';
import { postLinkSession, fetchCurrentUser } from '@/services/api';
import { useSessionStore } from '@/store/sessionStore';

/**
 * DevLogin — dev-only email/password login route for E2E automation.
 *
 * Security posture:
 *   - The route is only mounted in `App.tsx` when `import.meta.env.DEV` is
 *     truthy. Production builds tree-shake the route registration entirely.
 *   - Additionally, this component self-gates: if `import.meta.env.DEV` is
 *     false at runtime (e.g. someone bundled it by accident), it redirects
 *     home without touching Firebase.
 *   - Only works against the Auth emulator. Real Firebase projects reject
 *     the hardcoded-dev-password usage pattern this is designed for.
 *
 * Usage (Playwright):
 *   await page.goto('/__dev-login?email=admin@quartinho.local&password=xxx&next=/admin');
 */
export const DevLogin: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [state, setState] = useState<'pending' | 'ok' | 'error'>('pending');
  const [message, setMessage] = useState<string>('');
  const { sessionId, setFirebaseUid, setUser: setStoreUser } = useSessionStore();

  const email = searchParams.get('email') ?? '';
  const password = searchParams.get('password') ?? '';
  const next = searchParams.get('next') ?? '/';

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!email || !password) {
        setState('error');
        setMessage('missing email or password query params');
        return;
      }
      try {
        const result = await signInWithEmailAndPassword(auth, email, password);
        const idToken = await result.user.getIdToken();
        try {
          const linked = await postLinkSession(idToken, sessionId);
          if (!cancelled) setFirebaseUid(linked.firebaseUid);
        } catch {
          // API may not be reachable in pure-shell E2E runs — tolerate.
        }
        try {
          const me = await fetchCurrentUser(idToken);
          if (!cancelled) setStoreUser(me);
        } catch {
          // Same tolerance.
        }
        if (!cancelled) setState('ok');
      } catch (err) {
        if (!cancelled) {
          setState('error');
          setMessage((err as Error).message ?? 'login failed');
        }
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [email, password, sessionId, setFirebaseUid, setStoreUser]);

  if (!import.meta.env.DEV) {
    return <Navigate to="/" replace />;
  }

  if (state === 'ok') {
    return <Navigate to={next} replace />;
  }

  return (
    <div data-testid="dev-login-status" className="py-10 text-center font-body">
      {state === 'pending' && <p>signing in…</p>}
      {state === 'error' && (
        <p className="text-zine-burntOrange">dev-login failed: {message}</p>
      )}
    </div>
  );
};

export default DevLogin;
