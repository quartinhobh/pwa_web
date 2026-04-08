import { useEffect, useRef, useCallback } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

const UPDATE_INTERVAL_MS = 60 * 60 * 1000; // 60 min

/**
 * Thin wrapper around vite-plugin-pwa's useRegisterSW.
 * Polls for SW updates every 60 min, but only while the tab is visible.
 */
export function useServiceWorker() {
  const intervalRef = useRef<ReturnType<typeof setInterval>>();
  const registrationRef = useRef<ServiceWorkerRegistration>();

  const startPolling = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (!registrationRef.current) return;
    const reg = registrationRef.current;
    intervalRef.current = setInterval(() => reg.update(), UPDATE_INTERVAL_MS);
  }, []);

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = undefined;
    }
  }, []);

  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      if (registration) {
        registrationRef.current = registration;
        startPolling();
      }
    },
  });

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Check immediately when tab becomes visible, then resume polling
        registrationRef.current?.update();
        startPolling();
      } else {
        stopPolling();
      }
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      stopPolling();
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [startPolling, stopPolling]);

  return { needRefresh, updateServiceWorker };
}
