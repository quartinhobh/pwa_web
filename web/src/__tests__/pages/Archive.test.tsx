import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { Archive } from '@/pages/Archive';
import type { Event } from '@/types';

vi.mock('@/services/api', () => ({
  fetchEvents: vi.fn(),
}));

import { fetchEvents } from '@/services/api';

const archivedEvent: Event = {
  id: 'e1',
  mbAlbumId: 'mb-1',
  title: 'Old Night',
  date: '2024-01-15',
  startTime: '20:00',
  endTime: '22:00',
  location: null,
  album: null,
  status: 'archived',
  extras: { text: '', links: [], images: [] },
  spotifyPlaylistUrl: null,
  createdBy: 'admin',
  createdAt: 0,
  updatedAt: 0,
};

describe('Archive page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches archived events and renders cards', async () => {
    (fetchEvents as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([
      archivedEvent,
    ]);
    render(<Archive />);
    await waitFor(() => {
      expect(screen.getByText('Old Night')).toBeInTheDocument();
    });
    expect(fetchEvents).toHaveBeenCalledWith('archived');
    expect(screen.getByLabelText('archive-grid')).toBeInTheDocument();
  });

  it('shows empty state when no events', async () => {
    (fetchEvents as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    render(<Archive />);
    await waitFor(() => {
      expect(screen.getByText(/nenhum evento arquivado/i)).toBeInTheDocument();
    });
  });

  it('shows error when fetch fails', async () => {
    (fetchEvents as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('boom'),
    );
    render(<Archive />);
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/boom/);
    });
  });
});
