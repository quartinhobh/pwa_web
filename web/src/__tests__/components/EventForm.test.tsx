import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Event } from '@/types';

vi.mock('@/services/api', () => ({
  createEvent: vi.fn(),
  updateEvent: vi.fn(),
}));

import { EventForm } from '@/components/admin/EventForm';
import { createEvent, updateEvent } from '@/services/api';

const createMock = createEvent as unknown as ReturnType<typeof vi.fn>;
const updateMock = updateEvent as unknown as ReturnType<typeof vi.fn>;

const baseEvent: Event = {
  id: 'e1',
  mbAlbumId: 'mb-1',
  title: 'Old Title',
  date: '2025-01-01',
  startTime: '20:00',
  endTime: '22:00',
  location: null,
  status: 'upcoming',
  extras: { text: 'notes', links: [], images: [] },
  spotifyPlaylistUrl: null,
  createdBy: 'admin',
  createdAt: 0,
  updatedAt: 0,
};

beforeEach(() => {
  createMock.mockReset();
  updateMock.mockReset();
});
afterEach(() => vi.restoreAllMocks());

describe('EventForm', () => {
  it('renders all zine-styled fields in create mode', () => {
    render(<EventForm mode="create" idToken="tok" />);
    expect(screen.getByLabelText('mbAlbumId')).toBeInTheDocument();
    expect(screen.getByLabelText('title')).toBeInTheDocument();
    expect(screen.getByLabelText('date')).toBeInTheDocument();
    expect(screen.getByLabelText('startTime')).toBeInTheDocument();
    expect(screen.getByLabelText('endTime')).toBeInTheDocument();
    expect(screen.getByLabelText('extras-text')).toBeInTheDocument();
    expect(screen.getByLabelText('extras-links')).toBeInTheDocument();
    expect(screen.getByLabelText('extras-images')).toBeInTheDocument();
    expect(screen.getByLabelText('spotifyPlaylistUrl')).toBeInTheDocument();
  });

  it('submit in create mode calls createEvent with the payload', async () => {
    createMock.mockResolvedValue({ ...baseEvent, id: 'new' });
    const onSaved = vi.fn();
    render(<EventForm mode="create" idToken="tok" onSaved={onSaved} />);

    await userEvent.type(screen.getByLabelText('mbAlbumId'), 'mb-abc');
    await userEvent.type(screen.getByLabelText('title'), 'New Night');
    // date/time inputs accept value directly; use fireEvent via userEvent.type on value
    await userEvent.click(screen.getByRole('button', { name: /criar/i }));

    await waitFor(() => expect(createMock).toHaveBeenCalled());
    const [payload, token] = createMock.mock.calls[0]!;
    expect(payload.mbAlbumId).toBe('mb-abc');
    expect(payload.title).toBe('New Night');
    expect(token).toBe('tok');
    expect(onSaved).toHaveBeenCalled();
  });

  it('submit in edit mode calls updateEvent with event id', async () => {
    updateMock.mockResolvedValue({ ...baseEvent, title: 'Edited' });
    render(<EventForm mode="edit" initial={baseEvent} idToken="tok" />);

    const titleInput = screen.getByLabelText('title');
    await userEvent.clear(titleInput);
    await userEvent.type(titleInput, 'Edited');
    await userEvent.click(screen.getByRole('button', { name: /guardar/i }));

    await waitFor(() => expect(updateMock).toHaveBeenCalled());
    const [id, patch, token] = updateMock.mock.calls[0]!;
    expect(id).toBe('e1');
    expect(patch.title).toBe('Edited');
    expect(token).toBe('tok');
  });

  it('parses links and images multi-line fields', async () => {
    createMock.mockResolvedValue(baseEvent);
    render(<EventForm mode="create" idToken="tok" />);

    await userEvent.type(
      screen.getByLabelText('extras-links'),
      'Bandcamp|https://b.com',
    );
    await userEvent.type(
      screen.getByLabelText('extras-images'),
      'https://img.example/a.jpg',
    );
    await userEvent.click(screen.getByRole('button', { name: /criar/i }));

    await waitFor(() => expect(createMock).toHaveBeenCalled());
    const [payload] = createMock.mock.calls[0]!;
    expect(payload.extras.links).toEqual([
      { label: 'Bandcamp', url: 'https://b.com' },
    ]);
    expect(payload.extras.images).toEqual(['https://img.example/a.jpg']);
  });
});
