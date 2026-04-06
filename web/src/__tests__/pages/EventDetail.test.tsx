import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { EventDetail } from '@/pages/EventDetail';
import type { Event, MusicBrainzRelease, Photo, VoteTallies } from '@/types';

vi.mock('@/services/api', () => ({
  fetchEventById: vi.fn(),
  fetchMusicBrainzAlbum: vi.fn(),
  fetchTallies: vi.fn(),
  fetchPhotos: vi.fn(),
}));

import {
  fetchEventById,
  fetchMusicBrainzAlbum,
  fetchTallies,
  fetchPhotos,
} from '@/services/api';

const event: Event = {
  id: 'e1',
  mbAlbumId: 'mb-1',
  title: 'Archived Night',
  date: '2024-05-01',
  startTime: '20:00',
  endTime: '22:00',
  location: null,
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
    (fetchEventById as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(event);
    (fetchMusicBrainzAlbum as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(album);
    (fetchTallies as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(tallies);
    (fetchPhotos as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(photos);
  });

  it('renders album, tracks, votes, and category1 photos by default', async () => {
    render(<EventDetail eventId="e1" />);
    await waitFor(() => {
      expect(screen.getByText('Some Album')).toBeInTheDocument();
    });
    expect(screen.getAllByText('Track One').length).toBeGreaterThan(0);
    expect(screen.getByLabelText('vote-results')).toBeInTheDocument();
    // category1 tab active, shows p1 only
    expect(screen.getByAltText('photo-p1')).toBeInTheDocument();
    expect(screen.queryByAltText('photo-p2')).not.toBeInTheDocument();
  });

  it('switches to category2 tab and shows other photos', async () => {
    render(<EventDetail eventId="e1" />);
    await waitFor(() => {
      expect(screen.getByAltText('photo-p1')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByLabelText('tab-category2'));
    expect(screen.getByAltText('photo-p2')).toBeInTheDocument();
    expect(screen.queryByAltText('photo-p1')).not.toBeInTheDocument();
  });

  it('shows loading state before event resolves', () => {
    (fetchEventById as unknown as ReturnType<typeof vi.fn>).mockReturnValue(
      new Promise(() => {}),
    );
    render(<EventDetail eventId="e1" />);
    expect(screen.getByText(/carregando/i)).toBeInTheDocument();
  });
});
