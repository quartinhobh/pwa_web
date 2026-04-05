import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TrackList } from '@/components/events/TrackList';
import type { MusicBrainzTrack } from '@/types';

const tracks: MusicBrainzTrack[] = [
  { id: 't1', title: 'Alpha', position: 1, length: 180000 },
  { id: 't2', title: 'Beta', position: 2, length: 200000 },
  { id: 't3', title: 'Gamma', position: 3, length: 0 },
];

describe('TrackList', () => {
  it('renders all tracks in position order with titles', () => {
    render(<TrackList tracks={tracks} />);
    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.getByText('Beta')).toBeInTheDocument();
    expect(screen.getByText('Gamma')).toBeInTheDocument();
  });

  it('renders track numbers', () => {
    render(<TrackList tracks={tracks} />);
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('formats durations as m:ss', () => {
    render(<TrackList tracks={tracks} />);
    expect(screen.getByText('3:00')).toBeInTheDocument();
    expect(screen.getByText('3:20')).toBeInTheDocument();
  });
});
