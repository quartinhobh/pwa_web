import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { Mock } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('@/hooks/useIdToken', () => ({ useIdToken: () => 'tok' }));

vi.mock('@/services/api', () => ({
  getChatConfig: vi.fn(),
  updateChatConfig: vi.fn(),
  fetchEvents: vi.fn(),
  fetchModerationUserProfile: vi.fn(),
  fetchBans: vi.fn(),
  fetchModerationLogs: vi.fn(),
  banUser: vi.fn(),
  unbanUser: vi.fn(),
  deleteChatMessage: vi.fn(),
}));

import { ChatPanel } from '@/components/admin/ChatPanel';
import {
  getChatConfig,
  updateChatConfig,
  fetchEvents,
  fetchBans,
  fetchModerationLogs,
  unbanUser,
} from '@/services/api';
import type { Event } from '@/types';

const mockEvent = (over: Partial<Event> = {}): Event => ({
  id: 'evt1',
  mbAlbumId: 'mb1',
  title: 'Quartinho #42',
  date: '2026-05-01',
  startTime: '20:00',
  endTime: '23:00',
  location: null,
  status: 'upcoming',
  album: null,
  extras: {} as Event['extras'],
  spotifyPlaylistUrl: null,
  chatEnabled: true,
  chatOpensAt: null,
  chatClosesAt: null,
  createdBy: 'admin',
  createdAt: 0,
  updatedAt: 0,
  ...over,
} as Event);

beforeEach(() => {
  vi.resetAllMocks();
  (fetchBans as Mock).mockResolvedValue([]);
  (fetchModerationLogs as Mock).mockResolvedValue([]);
});

describe('ChatPanel', () => {
  it('renders config + events + bans after initial load', async () => {
    (getChatConfig as Mock).mockResolvedValue({ pauseAll: false });
    (fetchEvents as Mock).mockResolvedValue([mockEvent()]);
    (fetchBans as Mock).mockResolvedValue([]);

    render(<ChatPanel />);

    await waitFor(() =>
      expect(screen.getByText('Pausar todos os chats')).toBeInTheDocument(),
    );
    expect(screen.getByText('Quartinho #42')).toBeInTheDocument();
    expect(screen.getByText(/aberto agora/)).toBeInTheDocument();
    expect(screen.getByText(/nenhum usuário banido/i)).toBeInTheDocument();
  });

  it('toggling master switch persists via api', async () => {
    (getChatConfig as Mock).mockResolvedValue({ pauseAll: false });
    (fetchEvents as Mock).mockResolvedValue([]);
    (updateChatConfig as Mock).mockResolvedValue({ pauseAll: true });

    render(<ChatPanel />);

    const cb = await screen.findByRole('checkbox', { name: /pausar todos os chats/i });
    await userEvent.click(cb);

    await waitFor(() =>
      expect(updateChatConfig as Mock).toHaveBeenCalledWith('tok', { pauseAll: true }),
    );
  });

  it('renders event status as programado when chatOpensAt in the future', async () => {
    (getChatConfig as Mock).mockResolvedValue({ pauseAll: false });
    (fetchEvents as Mock).mockResolvedValue([
      mockEvent({ chatOpensAt: Date.now() + 10 * 60 * 1000 }),
    ]);

    render(<ChatPanel />);

    await waitFor(() => expect(screen.getByText(/programado/)).toBeInTheDocument());
  });

  it('renders bans list and calls unbanUser on click', async () => {
    (getChatConfig as Mock).mockResolvedValue({ pauseAll: false });
    (fetchEvents as Mock).mockResolvedValue([]);
    (fetchBans as Mock).mockResolvedValue([
      { userId: 'u1', bannedBy: 'admin', reason: 'spam', createdAt: 0, expiresAt: null },
    ]);
    (unbanUser as Mock).mockResolvedValue(undefined);

    render(<ChatPanel />);

    await waitFor(() => expect(screen.getByTestId('chat-ban-row-u1')).toBeInTheDocument());

    await userEvent.click(screen.getByRole('button', { name: /remover ban/i }));

    await waitFor(() =>
      expect(unbanUser as Mock).toHaveBeenCalledWith('u1', 'tok'),
    );
  });
});
