import { useCallback, useEffect, useRef, useState } from 'react';
import { stickerAssets, type StickerAsset } from '@/data/stickers';
import { fetchStickerConfig, trackStickerClick } from '@/services/api';
import { auth } from '@/services/firebase';
import { useApiCache } from '@/store/apiCache';
import type { StickerConfig } from '@/types';
import { usePrefersReducedMotion } from './usePrefersReducedMotion';

const STICKER_CONFIG_CACHE_KEY = 'stickerConfig:global';
const STICKER_CONFIG_TTL = 60 * 60 * 1000; // 1h — admin rarely edits

export interface SpawnedSticker {
  id: number;
  asset: StickerAsset;
  topPct: number;
  leftPct: number;
  rotationDeg: number;
  falling: boolean;
}

const FALL_DURATION_MS = 1200;
const EDGE_PAD_PCT = 12;
const COOLDOWN_STORAGE_KEY = 'qbh:stickerCooldown';

const FALLBACK_CONFIG: StickerConfig = {
  enabled: true,
  maxConcurrent: 2,
  spawnMinSeconds: 60,
  spawnMaxSeconds: 180,
  maxBeforeCooldown: 8,
  cooldownHours: 4,
  enabledAssets: [...stickerAssets],
  updatedAt: 0,
};

interface CooldownState {
  spawnedCount: number;
  cooldownUntil: number | null;
}

function readCooldown(): CooldownState {
  try {
    const raw = localStorage.getItem(COOLDOWN_STORAGE_KEY);
    if (!raw) return { spawnedCount: 0, cooldownUntil: null };
    const parsed = JSON.parse(raw) as CooldownState;
    if (parsed.cooldownUntil && parsed.cooldownUntil < Date.now()) {
      return { spawnedCount: 0, cooldownUntil: null };
    }
    return parsed;
  } catch {
    return { spawnedCount: 0, cooldownUntil: null };
  }
}

function writeCooldown(state: CooldownState): void {
  try {
    localStorage.setItem(COOLDOWN_STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* storage disabled — fail open */
  }
}

function randInRange(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

function pickAsset(allowed: string[]): StickerAsset | null {
  const valid = allowed.filter((a): a is StickerAsset =>
    (stickerAssets as readonly string[]).includes(a),
  );
  if (valid.length === 0) return null;
  return valid[Math.floor(Math.random() * valid.length)]!;
}

/**
 * useStickerSpawner — drives the sticker population shown by `<StickerLayer>`.
 * Config is fetched once from the API; until it loads, no spawn runs. After
 * `maxBeforeCooldown` stickers have appeared on this device, spawning pauses
 * for `cooldownHours` (persisted in localStorage so a refresh doesn't reset).
 */
export function useStickerSpawner(): {
  stickers: SpawnedSticker[];
  dismiss: (id: number) => void;
} {
  const reduced = usePrefersReducedMotion();
  const [stickers, setStickers] = useState<SpawnedSticker[]>([]);
  const [config, setConfig] = useState<StickerConfig | null>(null);
  const nextIdRef = useRef<number>(1);
  const cooldownRef = useRef<CooldownState>(readCooldown());

  useEffect(() => {
    let cancelled = false;
    // Try the persisted cache first — it survives refreshes via zustand
    // persist, so repeat visits skip the network call entirely.
    const cached = useApiCache.getState().get<StickerConfig>(
      STICKER_CONFIG_CACHE_KEY,
      STICKER_CONFIG_TTL,
    );
    if (cached) {
      setConfig(cached);
      return () => {
        cancelled = true;
      };
    }
    void fetchStickerConfig()
      .then((c) => {
        if (cancelled) return;
        useApiCache.getState().set(STICKER_CONFIG_CACHE_KEY, c);
        setConfig(c);
      })
      .catch(() => {
        if (!cancelled) setConfig(FALLBACK_CONFIG);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (reduced || !config || !config.enabled) return;
    let timeout: ReturnType<typeof setTimeout>;
    const schedule = () => {
      const cooldown = cooldownRef.current;
      if (cooldown.cooldownUntil && cooldown.cooldownUntil > Date.now()) return;
      const minMs = Math.max(1, config.spawnMinSeconds) * 1000;
      const maxMs = Math.max(minMs, config.spawnMaxSeconds * 1000);
      const delay = randInRange(minMs, maxMs);
      timeout = setTimeout(() => {
        setStickers((curr) => {
          if (curr.length >= config.maxConcurrent) return curr;
          const asset = pickAsset(config.enabledAssets);
          if (!asset) return curr;
          const next: SpawnedSticker = {
            id: nextIdRef.current++,
            asset,
            topPct: randInRange(EDGE_PAD_PCT, 100 - EDGE_PAD_PCT),
            leftPct: randInRange(EDGE_PAD_PCT, 100 - EDGE_PAD_PCT),
            rotationDeg: randInRange(-18, 18),
            falling: false,
          };
          const newCount = cooldownRef.current.spawnedCount + 1;
          if (config.maxBeforeCooldown > 0 && newCount >= config.maxBeforeCooldown) {
            cooldownRef.current = {
              spawnedCount: 0,
              cooldownUntil: Date.now() + config.cooldownHours * 60 * 60 * 1000,
            };
          } else {
            cooldownRef.current = {
              spawnedCount: newCount,
              cooldownUntil: null,
            };
          }
            writeCooldown(cooldownRef.current);
            return [...curr, next];
        });
        schedule();
      }, delay);
    };
    schedule();
    return () => { clearTimeout(timeout); };
  }, [reduced, config]);

  const dismiss = useCallback(
    (id: number) => {
      // Fire-and-forget stat: send the current id token if logged in, otherwise
      // anonymous (the API will silently ignore anon clicks).
      void (async () => {
        try {
          const token = auth.currentUser ? await auth.currentUser.getIdToken() : null;
          await trackStickerClick(token);
        } catch {
          /* ignore */
        }
      })();

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
