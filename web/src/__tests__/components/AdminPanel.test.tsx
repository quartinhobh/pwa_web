import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import type { Event, Photo } from '@/types';

vi.mock('@/services/api', () => ({
  fetchEvents: vi.fn(),
  fetchPhotos: vi.fn(),
  deleteEvent: vi.fn(),
  deletePhoto: vi.fn(),
  createEvent: vi.fn(),
  updateEvent: vi.fn(),
  uploadPhoto: vi.fn(),
  fetchBans: vi.fn(),
  fetchModerationLogs: vi.fn(),
  unbanUser: vi.fn(),
  cancelEvent: vi.fn(),
  broadcastToEvent: vi.fn(),
  getChatConfig: vi.fn(),
  updateChatConfig: vi.fn(),
  fetchModerationUserProfile: vi.fn(),
}));

import { AdminPanel } from '@/components/admin/AdminPanel';
import {
  fetchEvents,
  fetchPhotos,
  deleteEvent,
  fetchBans,
  fetchModerationLogs,
} from '@/services/api';

const fetchEventsMock = fetchEvents as unknown as ReturnType<typeof vi.fn>;
const fetchPhotosMock = fetchPhotos as unknown as ReturnType<typeof vi.fn>;
const deleteEventMock = deleteEvent as unknown as ReturnType<typeof vi.fn>;
const fetchBansMock = fetchBans as unknown as ReturnType<typeof vi.fn>;
const fetchLogsMock = fetchModerationLogs as unknown as ReturnType<typeof vi.fn>;

const event: Event = {
  id: 'e1',
  mbAlbumId: 'mb-1',
  title: 'Night One',
  date: '2025-01-01',
  startTime: '20:00',
  endTime: '22:00',
  location: null,
  album: null,
  status: 'upcoming',
  extras: { text: '', links: [], images: [] },
  spotifyPlaylistUrl: null,
  createdBy: 'admin',
  createdAt: 0,
  updatedAt: 0,
};

const photo: Photo = {
  id: 'p1',
  url: 'https://x/p1.jpg',
  category: 'category1',
  uploadedBy: 'admin',
  createdAt: 0,
};

beforeEach(() => {
  fetchEventsMock.mockReset().mockResolvedValue([event]);
  fetchPhotosMock.mockReset().mockResolvedValue([photo]);
  deleteEventMock.mockReset().mockResolvedValue(undefined);
  fetchBansMock.mockReset().mockResolvedValue([]);
  fetchLogsMock.mockReset().mockResolvedValue([]);
});
afterEach(() => vi.restoreAllMocks());

describe('AdminPanel', () => {
  it('renders the three tabs', () => {
    render(<MemoryRouter><AdminPanel idToken="tok" /></MemoryRouter>);
    expect(screen.getByRole('tab', { name: /eventos/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /fotos/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /moderação/i })).toBeInTheDocument();
  });

  it('Events tab shows events list and New Event button', async () => {
    render(<MemoryRouter><AdminPanel idToken="tok" /></MemoryRouter>);
    await waitFor(() =>
      expect(screen.getByTestId('event-row-e1')).toBeInTheDocument(),
    );
    expect(
      screen.getByRole('button', { name: /novo evento/i }),
    ).toBeInTheDocument();
  });

  it('Events tab: clicking editar opens EventForm in edit mode', async () => {
    render(<MemoryRouter><AdminPanel idToken="tok" /></MemoryRouter>);
    await waitFor(() =>
      expect(screen.getByTestId('event-row-e1')).toBeInTheDocument(),
    );
    await userEvent.click(screen.getByRole('button', { name: /editar/i }));
    await waitFor(() =>
      expect(screen.getByLabelText('event-form')).toBeInTheDocument(),
    );
    expect(screen.getByRole('button', { name: /guardar/i })).toBeInTheDocument();
  });

  it('Photos tab: picks event and shows PhotoUpload + photo list', async () => {
    render(<MemoryRouter><AdminPanel idToken="tok" /></MemoryRouter>);
    await userEvent.click(screen.getByRole('tab', { name: /fotos/i }));
    await waitFor(() =>
      expect(screen.getByLabelText('photos-event-select')).toBeInTheDocument(),
    );
    await waitFor(() =>
      expect(screen.getByLabelText('photo-upload')).toBeInTheDocument(),
    );
    await waitFor(() =>
      expect(screen.getByTestId('photo-row-p1')).toBeInTheDocument(),
    );
  });

  it('Moderation tab renders ModerationPanel', async () => {
    render(<MemoryRouter><AdminPanel idToken="tok" /></MemoryRouter>);
    await userEvent.click(screen.getByRole('tab', { name: /moderação/i }));
    await waitFor(() =>
      expect(screen.getByText(/Banimentos ativos/i)).toBeInTheDocument(),
    );
  });
});
