import { describe, expect, it, beforeEach, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import StickerLayer from '@/components/common/StickerLayer';

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

  it('renders an empty sticker layer container', () => {
    mockMatchMedia(false);
    render(<StickerLayer />);
    const layer = screen.getByTestId('sticker-layer');
    expect(layer).toBeInTheDocument();
    expect(layer.querySelectorAll('button').length).toBe(0);
  });

  it('spawns stickers over time when motion is allowed', () => {
    mockMatchMedia(false);
    render(<StickerLayer />);
    // 30s is the upper bound of the random spawn delay.
    act(() => {
      vi.advanceTimersByTime(30_000);
    });
    const buttons = screen.getAllByRole('button', { name: /dismiss sticker/i });
    expect(buttons.length).toBeGreaterThan(0);
  });

  it('does not spawn stickers when prefers-reduced-motion is set', () => {
    mockMatchMedia(true);
    render(<StickerLayer />);
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(
      screen.queryAllByRole('button', { name: /dismiss sticker/i }),
    ).toHaveLength(0);
  });
});
