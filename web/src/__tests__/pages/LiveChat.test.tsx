import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { Event } from '@/types';

vi.mock('@/hooks/useEvent', () => ({ useEvent: vi.fn() }));
vi.mock('@/hooks/useChat', () => ({ useChat: vi.fn() }));
vi.mock('@/hooks/useModeration', () => ({
  useModeration: () => ({ deleteMessage: vi.fn(), banUser: vi.fn() }),
}));
vi.mock('@/store/sessionStore', () => ({
  useSessionStore: (selector: (s: { role: string }) => unknown) => selector({ role: 'user' }),
}));
vi.mock('@/services/firebase', () => ({
  auth: { onIdTokenChanged: (_cb: unknown) => () => {} },
}));
vi.mock('@/components/chat/ChatRoom', () => ({
  ChatRoom: () => <div data-testid="chat-room" />,
}));
vi.mock('@/components/chat/ChatInput', () => ({
  ChatInput: () => <div data-testid="chat-input" />,
}));
vi.mock('@/components/auth/LoginModal', () => ({
  default: () => null,
}));

import { LiveChat } from '@/pages/LiveChat';
import { useEvent } from '@/hooks/useEvent';
import { useChat } from '@/hooks/useChat';

const mockUseEvent = useEvent as unknown as ReturnType<typeof vi.fn>;
const mockUseChat = useChat as unknown as ReturnType<typeof vi.fn>;

const baseEvent: Event = {
  id: 'evt-1',
  mbAlbumId: 'mb-1',
  title: 'Jazz Night',
  date: '2026-04-15',
  startTime: '19:00',
  endTime: '23:00',
  location: null,
  status: 'live',
  album: null,
  extras: { text: '', links: [], images: [] },
  spotifyPlaylistUrl: null,
  createdBy: 'admin',
  createdAt: 0,
  updatedAt: 0,
};

function renderLiveChat() {
  return render(
    <MemoryRouter initialEntries={['/chat/evt-1']}>
      <LiveChat eventId="evt-1" />
    </MemoryRouter>,
  );
}

describe('LiveChat page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseChat.mockReturnValue({
      messages: [],
      sendMessage: vi.fn(),
      removeMessage: vi.fn(),
      loading: false,
    });
  });

  it('shows status text when chat is closed (chatClosesAt in the past)', () => {
    mockUseEvent.mockReturnValue({
      event: { ...baseEvent, chatEnabled: true, chatOpensAt: null, chatClosesAt: Date.now() - 60_000 },
      album: null,
      tracks: [],
      loading: false,
      error: null,
    });
    renderLiveChat();
    expect(screen.getByText(/chat fechado/i)).toBeInTheDocument();
    expect(screen.queryByTestId('chat-room')).not.toBeInTheDocument();
    expect(screen.queryByTestId('chat-input')).not.toBeInTheDocument();
  });

  it('renders ChatRoom and ChatInput when chat is open (no gate)', () => {
    mockUseEvent.mockReturnValue({
      event: { ...baseEvent, chatEnabled: true },
      album: null,
      tracks: [],
      loading: false,
      error: null,
    });
    renderLiveChat();
    expect(screen.getByTestId('chat-room')).toBeInTheDocument();
    expect(screen.getByTestId('chat-input')).toBeInTheDocument();
  });

  it('shows "chat desativado" when chatEnabled is false', () => {
    mockUseEvent.mockReturnValue({
      event: { ...baseEvent, chatEnabled: false },
      album: null,
      tracks: [],
      loading: false,
      error: null,
    });
    renderLiveChat();
    expect(screen.getByText(/chat desativado/i)).toBeInTheDocument();
    expect(screen.queryByTestId('chat-input')).not.toBeInTheDocument();
  });
});
