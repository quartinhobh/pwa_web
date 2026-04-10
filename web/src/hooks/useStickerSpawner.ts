import { useCallback, useEffect, useRef, useState } from 'react';
import { stickerAssets, type StickerAsset } from '@/data/stickers';
import { usePrefersReducedMotion } from './usePrefersReducedMotion';

export interface SpawnedSticker {
  id: number;
  asset: StickerAsset;
  topPct: number;
  leftPct: number;
  rotationDeg: number;
  falling: boolean;
}

const MAX_CONCURRENT = 5;
const SPAWN_MIN_MS = 15_000;
const SPAWN_MAX_MS = 30_000;
const FALL_DURATION_MS = 1200;
const EDGE_PAD_PCT = 12;

function randInRange(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

function pickAsset(): StickerAsset {
  const idx = Math.floor(Math.random() * stickerAssets.length);
  return stickerAssets[idx]!;
}

/**
 * useStickerSpawner — drives the sticker population shown by `<StickerLayer>`.
 *
 * Behaviour:
 *   - Every 15-30 seconds a new sticker pops in at a random viewport position
 *     with a slight random rotation, up to `MAX_CONCURRENT` at once.
 *   - Callers dismiss stickers via the returned `dismiss(id)`; dismissed
 *     stickers enter a `falling` state, the CSS keyframe animates them off,
 *     and they're removed from state after `FALL_DURATION_MS`.
 *   - When the user prefers reduced motion, no timer runs at all and
 *     dismissals remove stickers synchronously.
 */
export function useStickerSpawner(): {
  stickers: SpawnedSticker[];
  dismiss: (id: number) => void;
} {
  const reduced = usePrefersReducedMotion();
  const [stickers, setStickers] = useState<SpawnedSticker[]>([]);
  const nextIdRef = useRef<number>(1);

  useEffect(() => {
    if (reduced) return;
    let timeout: ReturnType<typeof setTimeout>;
    const schedule = () => {
      const delay = randInRange(SPAWN_MIN_MS, SPAWN_MAX_MS);
      timeout = setTimeout(() => {
        setStickers((curr) => {
          if (curr.length >= MAX_CONCURRENT) return curr;
          const next: SpawnedSticker = {
            id: nextIdRef.current++,
            asset: pickAsset(),
            topPct: randInRange(EDGE_PAD_PCT, 100 - EDGE_PAD_PCT),
            leftPct: randInRange(EDGE_PAD_PCT, 100 - EDGE_PAD_PCT),
            rotationDeg: randInRange(-18, 18),
            falling: false,
          };
          return [...curr, next];
        });
        schedule();
      }, delay);
    };
    schedule();
    return () => { clearTimeout(timeout); };
  }, [reduced]);

  const dismiss = useCallback(
    (id: number) => {
      if (reduced) {
        setStickers((curr) => curr.filter((s) => s.id !== id));
        return;
      }
      setStickers((curr) =>
        curr.map((s) => (s.id === id ? { ...s, falling: true } : s)),
      );
      setTimeout(() => {
        setStickers((curr) => curr.filter((s) => s.id !== id));
      }, FALL_DURATION_MS);
    },
    [reduced],
  );

  return { stickers, dismiss };
}
