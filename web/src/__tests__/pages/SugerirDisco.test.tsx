import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('@/hooks/useIdToken', () => ({
  useIdToken: vi.fn().mockReturnValue(null),
}));

vi.mock('@/services/api', () => ({
  createAlbumSuggestion: vi.fn(),
}));

import { useIdToken } from '@/hooks/useIdToken';
import * as api from '@/services/api';
import SugerirDisco from '@/pages/SugerirDisco';

const useIdTokenMock = useIdToken as unknown as ReturnType<typeof vi.fn>;
const createAlbumMock = api.createAlbumSuggestion as unknown as ReturnType<typeof vi.fn>;

describe('SugerirDisco page', () => {
  beforeEach(() => {
    createAlbumMock.mockReset();
    useIdTokenMock.mockReturnValue(null);
  });

  it('renders only album title and notes inputs', () => {
    render(<SugerirDisco />);
    expect(screen.getByLabelText(/nome do album/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/obs/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/buscar/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/link do spotify/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/link do youtube/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/artista/i)).not.toBeInTheDocument();
  });

  it('anonymous can submit with album title', async () => {
    createAlbumMock.mockResolvedValue({ id: '1', status: 'suggested' });
    render(<SugerirDisco />);

    fireEvent.change(screen.getByLabelText(/nome do album/i), {
      target: { value: 'Rumours' },
    });
    fireEvent.click(screen.getByRole('button', { name: /indicar disco/i }));

    await waitFor(() =>
      expect(createAlbumMock).toHaveBeenCalledWith(
        expect.objectContaining({ albumTitle: 'Rumours' }),
        null,
      ),
    );
  });

  it('logged-in user submits with idToken', async () => {
    useIdTokenMock.mockReturnValue('user-token');
    createAlbumMock.mockResolvedValue({ id: '1', status: 'suggested' });
    render(<SugerirDisco />);

    fireEvent.change(screen.getByLabelText(/nome do album/i), {
      target: { value: 'Dark Side of the Moon' },
    });
    fireEvent.click(screen.getByRole('button', { name: /indicar disco/i }));

    await waitFor(() =>
      expect(createAlbumMock).toHaveBeenCalledWith(
        expect.objectContaining({ albumTitle: 'Dark Side of the Moon' }),
        'user-token',
      ),
    );
  });

  it('sends notes when filled', async () => {
    createAlbumMock.mockResolvedValue({ id: '1', status: 'suggested' });
    render(<SugerirDisco />);

    fireEvent.change(screen.getByLabelText(/nome do album/i), {
      target: { value: 'Rumours' },
    });
    fireEvent.change(screen.getByLabelText(/obs/i), {
      target: { value: 'curto muito' },
    });
    fireEvent.click(screen.getByRole('button', { name: /indicar disco/i }));

    await waitFor(() =>
      expect(createAlbumMock).toHaveBeenCalledWith(
        expect.objectContaining({ albumTitle: 'Rumours', notes: 'curto muito' }),
        null,
      ),
    );
  });

  it('shows validation error and does not call api if title empty', async () => {
    render(<SugerirDisco />);
    fireEvent.click(screen.getByRole('button', { name: /indicar disco/i }));

    await waitFor(() =>
      expect(screen.getByText(/preencha o nome do disco/i)).toBeInTheDocument(),
    );

    expect(createAlbumMock).not.toHaveBeenCalled();
  });

  it('shows success message after submit', async () => {
    createAlbumMock.mockResolvedValue({ id: '1', status: 'suggested' });
    render(<SugerirDisco />);

    fireEvent.change(screen.getByLabelText(/nome do album/i), {
      target: { value: 'Some Album' },
    });
    fireEvent.click(screen.getByRole('button', { name: /indicar disco/i }));

    await waitFor(() =>
      expect(screen.getByText(/disco indicado com sucesso/i)).toBeInTheDocument(),
    );
  });
});
