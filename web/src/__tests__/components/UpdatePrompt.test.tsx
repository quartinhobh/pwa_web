import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const mockUpdateServiceWorker = vi.fn();
let mockNeedRefresh = false;

vi.mock('@/hooks/useServiceWorker', () => ({
  useServiceWorker: () => ({
    needRefresh: mockNeedRefresh,
    updateServiceWorker: mockUpdateServiceWorker,
  }),
}));

vi.stubGlobal('__APP_VERSION__', '2026-04-08T00:00:00.000Z');

import { UpdatePrompt } from '@/components/common/UpdatePrompt';

describe('UpdatePrompt', () => {
  beforeEach(() => {
    localStorage.clear();
    mockUpdateServiceWorker.mockClear();
    mockNeedRefresh = false;
  });

  it('renders nothing when no update is available', () => {
    const { container } = render(<UpdatePrompt />);
    expect(container.firstChild).toBeNull();
  });

  it('shows banner when SW has update waiting', () => {
    mockNeedRefresh = true;
    render(<UpdatePrompt />);

    expect(screen.getByText('tem versão nova!')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /atualizar/i })).toBeInTheDocument();
  });

  it('calls updateServiceWorker(true) and hides banner on click', () => {
    mockNeedRefresh = true;
    render(<UpdatePrompt />);

    fireEvent.click(screen.getByRole('button', { name: /atualizar/i }));

    expect(mockUpdateServiceWorker).toHaveBeenCalledWith(true);
    // Banner hides immediately to prevent flicker during reload
    expect(screen.queryByText('tem versão nova!')).toBeNull();
  });

  it('saves version to localStorage on mount', () => {
    render(<UpdatePrompt />);
    expect(localStorage.getItem('quartinho:app-version')).toBe('2026-04-08T00:00:00.000Z');
  });
});
