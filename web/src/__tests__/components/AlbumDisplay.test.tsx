import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AlbumDisplay } from '@/components/events/AlbumDisplay';
import type { Event, MusicBrainzRelease } from '@/types';

const baseEvent: Event = {
  id: 'e1',
  mbAlbumId: 'mb-1',
  title: 'Event Title',
  date: '2025-01-15',
  startTime: '20:00',
  endTime: '22:00',
  status: 'upcoming',
  extras: { text: '', links: [], images: [] },
  spotifyPlaylistUrl: null,
  createdBy: 'admin',
  createdAt: 0,
  updatedAt: 0,
};

const album: MusicBrainzRelease = {
  id: 'mb-1',
  title: 'Real Album Title',
  artistCredit: 'Some Artist',
  date: '2020-01-01',
  tracks: [],
};

describe('AlbumDisplay', () => {
  it('renders the album title from MusicBrainz', () => {
    render(<AlbumDisplay event={baseEvent} album={album} />);
    expect(screen.getByText('Real Album Title')).toBeInTheDocument();
    expect(screen.getByText('Some Artist')).toBeInTheDocument();
    expect(screen.getByText('2025-01-15')).toBeInTheDocument();
  });

  it('falls back to event.title when album is null', () => {
    render(<AlbumDisplay event={baseEvent} album={null} />);
    expect(screen.getByText('Event Title')).toBeInTheDocument();
  });

  it('renders cover placeholder when no coverUrl provided', () => {
    render(<AlbumDisplay event={baseEvent} album={album} />);
    expect(screen.getByLabelText('album-cover-placeholder')).toBeInTheDocument();
  });
});
