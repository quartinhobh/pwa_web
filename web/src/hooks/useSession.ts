import { useEffect, useState } from 'react';
import { postGuestSession } from '@/services/api';
import { useSessionStore } from '@/store/sessionStore';

const STORAGE_KEY = 'quartinho.session';

interface StoredSession {
  sessionId: string;
  guestName: string;
}

export function useSession() {
  const { sessionId, guestName, setSession } = useSessionStore();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        try {
          const parsed = JSON.parse(raw) as StoredSession;
          if (parsed.sessionId && parsed.guestName) {
            setSession(parsed);
            if (!cancelled) setLoading(false);
            return;
          }
        } catch {
          // fall through to create a new session
        }
      }

      try {
        const created = await postGuestSession();
        if (cancelled) return;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(created));
        setSession(created);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void init();
    return () => {
      cancelled = true;
    };
  }, [setSession]);

  return { sessionId, guestName, loading };
}
