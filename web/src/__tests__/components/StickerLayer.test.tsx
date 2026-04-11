import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import StickerLayer from '@/components/common/StickerLayer';

// Mock the sticker config API so the spawner doesn't sit waiting for a real
// fetch. The hook reads this once on mount; we hand it a tiny config with a
// 1s spawn window so a single advanceTimersByTime call is enough to fire it.
vi.mock('@/services/api', () => ({
  fetchStickerConfig: vi.fn().mockResolvedValue({
    enabled: true,
    maxConcurrent: 5,
    spawnMinSeconds: 1,
    spawnMaxSeconds: 1,
    maxBeforeCooldown: 0,
    cooldownHours: 0,
    enabledAssets: ['heart.svg'],
    updatedAt: 0,
  }),
  trackStickerClick: vi.fn().mockResolvedValue(undefined),
}));

// Mock confetti to avoid issues with createParticles not being defined
vi.mock('@/components/common/Confetti', () => ({
  useConfettiBurst: () => ({ particles: [], burst: vi.fn() }),
  ConfettiLayer: () => null,
}));

// Reset the persisted apiCache between tests so a stale stickerConfig from
// a previous run can't change the timing.
beforeEach(() => {
  try {
    localStorage.removeItem('quartinho:api-cache');
    localStorage.removeItem('qbh:stickerCooldown');
  } catch { /* ignore */ }
});

// Ensure the reduced-motion media query returns a predictable default.
function mockMatchMedia(matches: boolean): void {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: (query: string) => ({
      matches,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }),
  });
}

describe('StickerLayer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('renders an empty sticker layer container', () => {
    mockMatchMedia(false);
    render(<StickerLayer />);
    const layer = screen.getByTestId('sticker-layer');
    expect(layer).toBeInTheDocument();
    expect(layer.querySelectorAll('button').length).toBe(0);
  });

  it('spawns stickers over time when motion is allowed', async () => {
    mockMatchMedia(false);
    // Force the random delay to land on its minimum (the mocked config has
    // min=max=1s anyway, so this is belt + suspenders).
    vi.spyOn(Math, 'random').mockReturnValue(0);

    render(<StickerLayer />);

    // Flush the fetchStickerConfig promise so the spawn timer gets scheduled.
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    act(() => {
      vi.advanceTimersByTime(2_000);
    });

    const buttons = screen.getAllByRole('button', { name: /dismiss sticker/i });
    expect(buttons.length).toBeGreaterThan(0);
  });

  it('does not spawn stickers when prefers-reduced-motion is set', async () => {
    mockMatchMedia(true);
    render(<StickerLayer />);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(
      screen.queryAllByRole('button', { name: /dismiss sticker/i }),
    ).toHaveLength(0);
  });
});
