import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import type { Mock } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import type { Event } from '@/types';

vi.mock('@/hooks/useIdToken', () => ({ useIdToken: () => 'tok' }));

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
import { fetchEvents, fetchBans, fetchModerationLogs, cancelEvent, broadcastToEvent } from '@/services/api';

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
  extras: { text: '', links: [], images: [] } as unknown as Event['extras'],
  spotifyPlaylistUrl: null,
  createdBy: 'admin',
  createdAt: 0,
  updatedAt: 0,
};

beforeEach(() => {
  (fetchEvents as Mock).mockResolvedValue([event]);
  (fetchBans as Mock).mockResolvedValue([]);
  (fetchModerationLogs as Mock).mockResolvedValue([]);
  (cancelEvent as Mock).mockResolvedValue({ event });
  (broadcastToEvent as Mock).mockResolvedValue({ sentCount: 12 });
});

afterEach(() => vi.resetAllMocks());

describe('EventsPanel (cancel + broadcast)', () => {
  it('opens cancel modal and submits to api', async () => {
    render(<MemoryRouter><AdminPanel idToken="tok" /></MemoryRouter>);
    await waitFor(() => expect(screen.getByTestId('event-row-e1')).toBeInTheDocument());

    await userEvent.click(screen.getByRole('button', { name: /cancelar evento/i }));
    expect(screen.getByRole('dialog', { name: /cancelar evento/i })).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText(/motivo do cancelamento/i), 'chovendo muito');
    await userEvent.click(screen.getByRole('button', { name: /confirmar cancelamento/i }));

    await waitFor(() =>
      expect(cancelEvent as Mock).toHaveBeenCalledWith('tok', 'e1', 'chovendo muito'),
    );
  });

  it('opens broadcast modal and validates empty fields', async () => {
    render(<MemoryRouter><AdminPanel idToken="tok" /></MemoryRouter>);
    await waitFor(() => expect(screen.getByTestId('event-row-e1')).toBeInTheDocument());

    await userEvent.click(screen.getByRole('button', { name: /enviar mensagem/i }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    // Click enviar with empty subject → should NOT call api
    await userEvent.click(screen.getByRole('button', { name: /^enviar$/i }));
    expect(broadcastToEvent as Mock).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(/assunto inválido/i);
  });

  it('submits broadcast with subject + body + filter', async () => {
    render(<MemoryRouter><AdminPanel idToken="tok" /></MemoryRouter>);
    await waitFor(() => expect(screen.getByTestId('event-row-e1')).toBeInTheDocument());

    await userEvent.click(screen.getByRole('button', { name: /enviar mensagem/i }));
    await userEvent.type(screen.getByLabelText(/assunto/i), 'importante');
    await userEvent.type(screen.getByLabelText(/^mensagem$/i), 'corpo da mensagem');
    await userEvent.click(screen.getByRole('button', { name: /^enviar$/i }));

    await waitFor(() =>
      expect(broadcastToEvent as Mock).toHaveBeenCalledWith('tok', 'e1', {
        subject: 'importante',
        body: 'corpo da mensagem',
        filter: 'confirmed',
      }),
    );
    await waitFor(() =>
      expect(screen.getByText(/enviada para/i)).toBeInTheDocument(),
    );
  });
});
