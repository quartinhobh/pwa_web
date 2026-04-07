import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { fetchActiveBanner, dismissBannerServer, checkBannerDismissal } from '@/services/api';
import { useAuth } from '@/hooks/useAuth';
import type { Banner, BannerRoute } from '@/types';

const STORAGE_KEY = 'quartinho:banner-dismiss';
const COOLDOWN_MS = 2 * 60 * 60 * 1000; // 2 hours

const ROUTE_MAP: Record<BannerRoute, (path: string) => boolean> = {
  home: (p) => p === '/',
  profile: (p) => p.startsWith('/u/'),
  lojinha: (p) => p === '/lojinha',
  chat: (p) => p.startsWith('/chat'),
};

interface DismissState {
  bannerId: string;
  version: number;
  expiresAt: number;
}

function readDismissLocal(): DismissState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as DismissState;
  } catch { return null; }
}

function writeDismissLocal(state: DismissState) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {}
}

export interface UseBannerResult {
  banner: Banner | null;
  visible: boolean;
  dismiss: () => void;
}

export function useBanner(): UseBannerResult {
  const [banner, setBanner] = useState<Banner | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const { user, isAuthenticated } = useAuth();
  const location = useLocation();
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  // Fetch active banner on mount + re-fetch every 5 min
  useEffect(() => {
    const load = () => fetchActiveBanner().then(setBanner).catch(() => setBanner(null));
    void load();
    const interval = setInterval(load, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // Check dismissal state when banner loads
  useEffect(() => {
    if (!banner) return;
    const local = readDismissLocal();
    if (local && local.bannerId === banner.id && local.version === banner.version && local.expiresAt > Date.now()) {
      setDismissed(true);
      return;
    }
    // Version mismatch or expired — reset
    setDismissed(false);

    // Check server-side for authenticated users
    if (isAuthenticated && user) {
      user.getIdToken().then((token) =>
        checkBannerDismissal(banner.id, banner.version, token)
      ).then((serverDismissed) => {
        if (serverDismissed) {
          setDismissed(true);
          writeDismissLocal({ bannerId: banner.id, version: banner.version, expiresAt: Date.now() + COOLDOWN_MS });
        }
      }).catch(() => {});
    }
  }, [banner, isAuthenticated, user]);

  const handleDismiss = useCallback(() => {
    if (!banner) return;
    const state: DismissState = { bannerId: banner.id, version: banner.version, expiresAt: Date.now() + COOLDOWN_MS };
    writeDismissLocal(state);
    setDismissed(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    if (isAuthenticated && user) {
      user.getIdToken().then((token) =>
        dismissBannerServer(banner.id, banner.version, token)
      ).catch(() => {});
    }
  }, [banner, isAuthenticated, user]);

  // Auto-dismiss timer
  useEffect(() => {
    if (!banner || dismissed || !banner.autoDismissSeconds) return;
    timerRef.current = setTimeout(() => {
      handleDismiss();
    }, banner.autoDismissSeconds * 1000);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [banner, dismissed, handleDismiss]);

  // Cross-tab sync
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY || !banner) return;
      const state = e.newValue ? JSON.parse(e.newValue) as DismissState : null;
      if (state && state.bannerId === banner.id && state.version === banner.version && state.expiresAt > Date.now()) {
        setDismissed(true);
      }
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, [banner]);

  // Route matching
  const routeMatch = banner ? banner.routes.some((r) => ROUTE_MAP[r]?.(location.pathname)) : false;
  const visible = !!banner && routeMatch && !dismissed;

  return { banner, visible, dismiss: handleDismiss };
}
