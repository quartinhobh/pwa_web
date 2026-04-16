import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Header } from '@/components/layout/Header';
import { GuestUpsellProvider } from '@/contexts/GuestUpsellContext';
import { useSessionStore } from '@/store/sessionStore';

// Header calls window.matchMedia to detect dark mode preference
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

vi.mock('@/hooks/useAuth', () => ({ useAuth: vi.fn() }));
vi.mock('@/components/auth/LoginModal', () => ({
  default: () => null,
}));
vi.mock('@/components/rsvp/GuestUpsellModal', () => ({
  default: () => null,
}));
vi.mock('@/components/common/UserAvatar', () => ({
  default: ({ name }: { name: string }) => <span data-testid="user-avatar">{name}</span>,
}));

import { useAuth } from '@/hooks/useAuth';

const mockUseAuth = useAuth as unknown as ReturnType<typeof vi.fn>;

function renderHeader() {
  return render(
    <MemoryRouter>
      <GuestUpsellProvider>
        <Header />
      </GuestUpsellProvider>
    </MemoryRouter>,
  );
}

describe('Header', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useSessionStore.setState({ role: 'guest' });
    mockUseAuth.mockReturnValue({
      user: null,
      isAuthenticated: false,
      signOut: vi.fn(),
    });
  });

  it('renders app name', () => {
    renderHeader();
    expect(screen.getByText('Quartinho')).toBeInTheDocument();
  });

  it('shows navigation links', () => {
    renderHeader();
    expect(screen.getByText('lojinha')).toBeInTheDocument();
  });

  it('shows "sair" button when authenticated', () => {
    mockUseAuth.mockReturnValue({
      user: { displayName: 'Gustavo', email: 'g@test.com', uid: 'uid-1' },
      isAuthenticated: true,
      signOut: vi.fn(),
    });
    renderHeader();
    expect(screen.getByRole('button', { name: /sair/i })).toBeInTheDocument();
  });

  it('shows admin link when role is admin', () => {
    useSessionStore.setState({ role: 'admin' });
    mockUseAuth.mockReturnValue({
      user: { displayName: 'Admin', email: 'admin@test.com', uid: 'uid-admin' },
      isAuthenticated: true,
      signOut: vi.fn(),
    });
    renderHeader();
    expect(screen.getByText('admin')).toBeInTheDocument();
  });
});
