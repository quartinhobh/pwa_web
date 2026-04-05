import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { VoteResults } from '@/components/voting/VoteResults';
import type { MusicBrainzTrack, VoteTallies } from '@/types';

const tracks: MusicBrainzTrack[] = [
  { id: 't1', title: 'Alpha', position: 1, length: 100000 },
  { id: 't2', title: 'Beta', position: 2, length: 100000 },
];

describe('VoteResults', () => {
  it('renders bars for favorites (burntYellow) and least-liked (periwinkle)', () => {
    const tallies: VoteTallies = {
      favorites: {
        t1: { count: 3, voterIds: ['a', 'b', 'c'] },
        t2: { count: 1, voterIds: ['d'] },
      },
      leastLiked: {
        t1: { count: 0, voterIds: [] },
        t2: { count: 2, voterIds: ['e', 'f'] },
      },
      updatedAt: 1,
    };
    render(<VoteResults tallies={tallies} tracks={tracks} />);
    expect(screen.getByLabelText('vote-results')).toBeInTheDocument();
    expect(screen.getByText('Favoritas')).toBeInTheDocument();
    expect(screen.getByText('Menos preferidas')).toBeInTheDocument();

    // Two rows named Alpha (favorites + least); favorites uses burntYellow
    const allFills = screen.getAllByTestId('bar-fill-Alpha');
    expect(allFills).toHaveLength(2);
    expect(allFills[0]!.className).toContain('bg-zine-burntYellow');
    expect(allFills[1]!.className).toContain('bg-zine-periwinkle');
  });

  it('handles null tallies gracefully with zero bars', () => {
    render(<VoteResults tallies={null} tracks={tracks} />);
    expect(screen.getByLabelText('vote-results')).toBeInTheDocument();
    // Bars still rendered with 0 counts
    expect(screen.getAllByText('0').length).toBeGreaterThan(0);
  });
});
