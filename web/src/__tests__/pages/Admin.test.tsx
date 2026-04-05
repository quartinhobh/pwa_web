import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

vi.mock('@/services/api', () => ({
  fetchEvents: vi.fn().mockResolvedValue([]),
  fetchPhotos: vi.fn().mockResolvedValue([]),
  fetchBans: vi.fn().mockResolvedValue([]),
  fetchModerationLogs: vi.fn().mockResolvedValue([]),
  deleteEvent: vi.fn(),
  deletePhoto: vi.fn(),
  createEvent: vi.fn(),
  updateEvent: vi.fn(),
  uploadPhoto: vi.fn(),
  unbanUser: vi.fn(),
}));

import { Admin } from '@/pages/Admin';
import { useSessionStore } from '@/store/sessionStore';

beforeEach(() => {
  useSessionStore.setState({
    sessionId: null,
    guestName: null,
    firebaseUid: null,
    role: 'guest',
    email: null,
    displayName: null,
  });
});
afterEach(() => vi.restoreAllMocks());

describe('Admin page', () => {
  it('shows Acesso negado for unauthenticated users', () => {
    render(<Admin idToken={null} />);
    expect(screen.getByText(/Acesso negado/i)).toBeInTheDocument();
  });

  it('shows Acesso negado for non-admin authenticated users', () => {
    useSessionStore.setState({ firebaseUid: 'uid-1', role: 'user' });
    render(<Admin idToken="tok" />);
    expect(screen.getByText(/Acesso negado/i)).toBeInTheDocument();
  });

  it('renders AdminPanel for admins', async () => {
    useSessionStore.setState({ firebaseUid: 'uid-admin', role: 'admin' });
    render(<Admin idToken="tok" />);
    await waitFor(() =>
      expect(screen.getByRole('tab', { name: /eventos/i })).toBeInTheDocument(),
    );
  });
});
