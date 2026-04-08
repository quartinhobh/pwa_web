import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { InstallPrompt } from '@/components/common/InstallPrompt';

const DISMISS_KEY = 'quartinho:install-dismissed';

interface BeforeInstallPromptEvent extends Event {
  platforms: string[];
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
  prompt: () => Promise<void>;
  _resolveChoice: (value: { outcome: 'accepted' | 'dismissed' }) => void;
}

function createBeforeInstallPromptEvent(): BeforeInstallPromptEvent {
  const event = new Event('beforeinstallprompt', { cancelable: true }) as BeforeInstallPromptEvent;
  const userChoicePromise = new Promise<{ outcome: 'accepted' | 'dismissed' }>((resolve) => {
    event._resolveChoice = resolve;
  });
  event.prompt = vi.fn().mockResolvedValue(undefined);
  event.userChoice = userChoicePromise;
  event.platforms = ['web'];
  return event;
}

describe('InstallPrompt', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders nothing initially (no beforeinstallprompt fired)', () => {
    const { container } = render(<InstallPrompt />);
    expect(container.firstChild).toBeNull();
  });

  it('shows banner when beforeinstallprompt fires', () => {
    render(<InstallPrompt />);

    act(() => {
      window.dispatchEvent(createBeforeInstallPromptEvent());
    });

    expect(screen.getByText('instala o quartinho')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /bora/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /agora não/i })).toBeInTheDocument();
  });

  it('does not show if dismissed within 30 days', () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    render(<InstallPrompt />);

    act(() => {
      window.dispatchEvent(createBeforeInstallPromptEvent());
    });

    expect(screen.queryByText('instala o quartinho')).toBeNull();
  });

  it('shows again if dismissal is older than 30 days', () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now() - 31 * 24 * 60 * 60 * 1000));
    render(<InstallPrompt />);

    act(() => {
      window.dispatchEvent(createBeforeInstallPromptEvent());
    });

    expect(screen.getByText('instala o quartinho')).toBeInTheDocument();
  });

  it('dismiss button saves timestamp and hides banner', () => {
    render(<InstallPrompt />);

    act(() => {
      window.dispatchEvent(createBeforeInstallPromptEvent());
    });

    fireEvent.click(screen.getByRole('button', { name: /agora não/i }));

    expect(screen.queryByText('instala o quartinho')).toBeNull();
    expect(localStorage.getItem(DISMISS_KEY)).toBeTruthy();
  });

  it('accept button calls prompt() and hides banner', async () => {
    render(<InstallPrompt />);

    const event = createBeforeInstallPromptEvent();
    act(() => {
      window.dispatchEvent(event);
    });

    fireEvent.click(screen.getByRole('button', { name: /bora/i }));

    expect(event.prompt).toHaveBeenCalled();

    // Resolve the userChoice promise
    await act(async () => {
      event._resolveChoice({ outcome: 'accepted' });
    });

    expect(screen.queryByText('instala o quartinho')).toBeNull();
  });

  it('hides on appinstalled event', () => {
    render(<InstallPrompt />);

    act(() => {
      window.dispatchEvent(createBeforeInstallPromptEvent());
    });

    expect(screen.getByText('instala o quartinho')).toBeInTheDocument();

    act(() => {
      window.dispatchEvent(new Event('appinstalled'));
    });

    expect(screen.queryByText('instala o quartinho')).toBeNull();
  });
});
