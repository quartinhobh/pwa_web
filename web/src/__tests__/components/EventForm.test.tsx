import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Event } from '@/types';

vi.mock('@/hooks/useIdToken', () => ({ useIdToken: () => 'fake-token' }));
vi.mock('@/services/api', () => ({
  createEvent: vi.fn(),
  updateEvent: vi.fn(),
  searchMusicBrainz: vi.fn().mockResolvedValue([]),
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
  album: null,
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
  it('renders key fields in create mode', () => {
    render(<EventForm mode="create" idToken="tok" />);
    expect(screen.getByLabelText('title')).toBeInTheDocument();
    expect(screen.getByLabelText('date')).toBeInTheDocument();
    expect(screen.getByLabelText('startTime')).toBeInTheDocument();
    expect(screen.getByLabelText('endTime')).toBeInTheDocument();
    expect(screen.getByLabelText('location')).toBeInTheDocument();
    expect(screen.getByLabelText('venueRevealDaysBefore')).toBeInTheDocument();
    expect(screen.getByLabelText('extras-text')).toBeInTheDocument();
    expect(screen.getByLabelText('spotifyPlaylistUrl')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/OK Computer/i)).toBeInTheDocument();
  });

  it('pre-fills default time (19:00-23:00) and reveal days (7) in create mode', () => {
    render(<EventForm mode="create" idToken="tok" />);
    expect(screen.getByLabelText('startTime')).toHaveValue('19:00');
    expect(screen.getByLabelText('endTime')).toHaveValue('23:00');
    expect(screen.getByLabelText('venueRevealDaysBefore')).toHaveValue(7);
  });

  it('pre-fills date with the 4th Wednesday of the current (or next) month in create mode', () => {
    render(<EventForm mode="create" idToken="tok" />);
    const dateInput = screen.getByLabelText('date') as HTMLInputElement;
    const value = dateInput.value;
    expect(value).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const d = new Date(value + 'T00:00:00');
    expect(d.getDay()).toBe(3); // Wednesday
    const day = d.getDate();
    expect(day).toBeGreaterThanOrEqual(22);
    expect(day).toBeLessThanOrEqual(28);
  });

  it('submit in create mode calls createEvent with the payload', async () => {
    createMock.mockResolvedValue({ ...baseEvent, id: 'new' });
    const onSaved = vi.fn();
    render(<EventForm mode="create" idToken="tok" onSaved={onSaved} />);

    await userEvent.type(screen.getByLabelText('title'), 'New Night');
    await userEvent.click(screen.getByRole('button', { name: /criar/i }));

    await waitFor(() => expect(createMock).toHaveBeenCalled());
    const [payload, token] = createMock.mock.calls[0]!;
    expect(payload.title).toBe('New Night');
    expect(token).toBe('fake-token');
    expect(onSaved).toHaveBeenCalled();
  });

  it('submits chat config fields (enabled + opensAt + closesAt) as ms epoch in payload', async () => {
    createMock.mockResolvedValue({ ...baseEvent, id: 'new' });
    render(<EventForm mode="create" idToken="tok" />);

    await userEvent.type(screen.getByLabelText('title'), 'Chat Window Night');
    await userEvent.click(screen.getByRole('button', { name: /^chat/i }));

    const opensInput = screen.getByLabelText('chat-opens-at') as HTMLInputElement;
    const closesInput = screen.getByLabelText('chat-closes-at') as HTMLInputElement;
    await userEvent.type(opensInput, '2026-04-15T19:00');
    await userEvent.type(closesInput, '2026-04-15T23:00');

    await userEvent.click(screen.getByRole('button', { name: /criar/i }));

    await waitFor(() => expect(createMock).toHaveBeenCalled());
    const [payload] = createMock.mock.calls[0]!;
    expect(payload.chatEnabled).toBe(true);
    expect(payload.chatOpensAt).toBe(new Date('2026-04-15T19:00').getTime());
    expect(payload.chatClosesAt).toBe(new Date('2026-04-15T23:00').getTime());
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
    expect(token).toBe('fake-token');
  });
});
