import { useEffect, useState } from 'react';

/**
 * Tracks the user's `prefers-reduced-motion` setting. Returns `true` when the
 * OS/browser is configured to reduce motion and animations should be disabled.
 *
 * Replaces the need for a third-party hook — kept as a tiny local utility so
 * any component can gate its animations behind a single import.
 */
export function usePrefersReducedMotion(): boolean {
  const [prefers, setPrefers] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = (e: MediaQueryListEvent) => { setPrefers(e.matches); };
    mq.addEventListener('change', onChange);
    return () => { mq.removeEventListener('change', onChange); };
  }, []);

  return prefers;
}
