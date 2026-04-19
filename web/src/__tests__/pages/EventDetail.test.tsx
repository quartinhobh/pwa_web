import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { EventDetail } from '@/pages/EventDetail';
import type { Mock } from 'vitest';
import type { Event, MusicBrainzRelease, Photo, VoteTallies } from '@/types';

vi.mock('@/services/api', () => ({
  fetchEventById: vi.fn(),
  fetchMusicBrainzAlbum: vi.fn(),
  fetchTallies: vi.fn(),
  fetchPhotos: vi.fn(),
  fetchComments: vi.fn(),
}));

import {
  fetchEventById,
  fetchMusicBrainzAlbum,
  fetchTallies,
  fetchPhotos,
  fetchComments,
} from '@/services/api';

const event: Event = {
  id: 'e1',
  mbAlbumId: 'mb-1',
  title: 'Archived Night',
  date: '2024-05-01',
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

const album: MusicBrainzRelease = {
  id: 'mb-1',
  title: 'Some Album',
  artistCredit: 'Artist',
  date: '2020-01-01',
  tracks: [
    { id: 't1', title: 'Track One', position: 1, length: 60000 },
    { id: 't2', title: 'Track Two', position: 2, length: 90000 },
  ],
};

const tallies: VoteTallies = {
  favorites: { t1: { count: 2, voterIds: ['a', 'b'] } },
  leastLiked: { t2: { count: 1, voterIds: ['c'] } },
  updatedAt: 0,
};

const photos: Photo[] = [
  {
    id: 'p1',
    url: 'https://example.com/a.jpg',
    category: 'category1',
    uploadedBy: 'admin',
    createdAt: 200,
  },
  {
    id: 'p2',
    url: 'https://example.com/b.jpg',
    category: 'category2',
    uploadedBy: 'admin',
    createdAt: 100,
  },
];

describe('EventDetail page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (fetchEventById as Mock).mockResolvedValue(event);
    (fetchMusicBrainzAlbum as Mock).mockResolvedValue(album);
    (fetchTallies as Mock).mockResolvedValue(tallies);
    (fetchPhotos as Mock).mockResolvedValue(photos);
    (fetchComments as Mock).mockResolvedValue([]);
  });

  it('renders album and tabs by default', async () => {
    render(<EventDetail eventId="e1" />);
    await waitFor(() => {
      expect(screen.getByText('Some Album')).toBeInTheDocument();
    });
    expect(screen.getAllByText('Track One').length).toBeGreaterThan(0);
    expect(screen.getByRole('tab', { name: 'Músicas' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Votos' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Fotos' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Comentários' })).toBeInTheDocument();
  });

  it('shows tracks by default (Músicas tab active)', async () => {
    render(<EventDetail eventId="e1" />);
    await waitFor(() => {
      expect(screen.getByText('Some Album')).toBeInTheDocument();
    });
    expect(screen.getByLabelText('tracks')).toBeInTheDocument();
  });

  it('switches to votes tab and shows vote results', async () => {
    render(<EventDetail eventId="e1" />);
    await waitFor(() => {
      expect(screen.getByText('Some Album')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('tab', { name: 'Votos' }));
    expect(screen.getByLabelText('vote-results')).toBeInTheDocument();
  });

  it('switches to photos tab and shows photo gallery', async () => {
    render(<EventDetail eventId="e1" />);
    await waitFor(() => {
      expect(screen.getByText('Some Album')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('tab', { name: 'Fotos' }));
    expect(screen.getByAltText('photo-p1')).toBeInTheDocument();
  });

  it('switches to comments tab and shows empty state', async () => {
    render(<EventDetail eventId="e1" />);
    await waitFor(() => {
      expect(screen.getByText('Some Album')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('tab', { name: 'Comentários' }));
    await waitFor(() => {
      expect(
        screen.getByText(/Nenhum comentário ainda\. Seja o primeiro!/i),
      ).toBeInTheDocument();
    });
  });

  it('shows loading state before event resolves', () => {
    (fetchEventById as unknown as ReturnType<typeof vi.fn>).mockReturnValue(
      new Promise(() => {}),
    );
    render(<EventDetail eventId="e1" />);
    expect(screen.getByTestId('loading-skeleton')).toBeInTheDocument();
  });
});
