import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { VotePanel } from '@/components/voting/VotePanel';
import type { MusicBrainzTrack } from '@/types';

const tracks: MusicBrainzTrack[] = [
  { id: 't1', title: 'Alpha', position: 1, length: 100000 },
  { id: 't2', title: 'Beta', position: 2, length: 100000 },
  { id: 't3', title: 'Gamma', position: 3, length: 100000 },
];

describe('VotePanel', () => {
  it('submits selected favorite + least', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<VotePanel tracks={tracks} userVote={null} onSubmit={onSubmit} />);

    const favRadios = screen.getAllByRole('radio', { name: 'Alpha' });
    const leastRadios = screen.getAllByRole('radio', { name: 'Gamma' });
    fireEvent.click(favRadios[0]!);
    fireEvent.click(leastRadios[leastRadios.length - 1]!);

    fireEvent.click(screen.getByRole('button', { name: /enviar voto/i }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith('t1', 't3'));
    // After submit the panel collapses — look for the collapsed banner.
    expect(await screen.findByText(/voto registrado/i)).toBeInTheDocument();
  });

  it('disables submit when same track chosen for both', () => {
    const onSubmit = vi.fn();
    render(<VotePanel tracks={tracks} userVote={null} onSubmit={onSubmit} />);

    const favBetas = screen.getAllByRole('radio', { name: 'Beta' });
    fireEvent.click(favBetas[0]!);
    fireEvent.click(favBetas[1]!);

    expect(screen.getByText('Escolha faixas diferentes.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /enviar voto/i })).toBeDisabled();
  });

  it('is collapsed when already voted and expands on click', async () => {
    const onSubmit = vi.fn();
    render(
      <VotePanel
        tracks={tracks}
        userVote={{
          favoriteTrackId: 't2',
          leastLikedTrackId: 't3',
          updatedAt: 1,
        }}
        onSubmit={onSubmit}
      />,
    );
    // Collapsed state shows summary.
    expect(screen.getByText(/voto registrado/i)).toBeInTheDocument();
    // Expand.
    fireEvent.click(screen.getByText(/ver detalhes/i));
    // Now the radios are visible and disabled.
    const favBeta = screen.getAllByRole('radio', { name: 'Beta' })[0]!;
    expect(favBeta).toBeDisabled();
    expect((favBeta as HTMLInputElement).checked).toBe(true);
  });
});
