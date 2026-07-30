import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { Listen } from '@/pages/Listen';
import type { Event, RsvpSummary } from '@/types';

vi.mock('@/hooks/useEvent', () => ({ useEvent: vi.fn() }));
vi.mock('@/hooks/useVotes', () => ({ useVotes: vi.fn() }));
vi.mock('@/hooks/useRsvp', () => ({ useRsvp: vi.fn() }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: vi.fn() }));

// Suppress child component rendering complexities
vi.mock('@/components/events/AlbumDisplay', () => ({
  AlbumDisplay: () => <div data-testid="album-display" />,
}));
vi.mock('@/components/events/TrackList', () => ({
  TrackList: () => <div data-testid="track-list" />,
}));
vi.mock('@/components/rsvp/RsvpButton', () => ({
  RsvpButton: () => <div data-testid="rsvp-button" />,
}));
vi.mock('@/components/rsvp/RsvpStatus', () => ({
  RsvpStatus: () => <div data-testid="rsvp-status" />,
}));

import { useEvent } from '@/hooks/useEvent';
import { useVotes } from '@/hooks/useVotes';
import { useRsvp } from '@/hooks/useRsvp';
import { useAuth } from '@/hooks/useAuth';

const mockUseEvent = useEvent as unknown as ReturnType<typeof vi.fn>;
const mockUseVotes = useVotes as unknown as ReturnType<typeof vi.fn>;
const mockUseRsvp = useRsvp as unknown as ReturnType<typeof vi.fn>;
const mockUseAuth = useAuth as unknown as ReturnType<typeof vi.fn>;

const baseEvent: Event = {
  id: 'evt-1',
  mbAlbumId: 'mb-1',
  title: 'Jazz Night',
  date: '2099-12-31',
  startTime: '20:00',
  endTime: '23:00',
  location: null,
  status: 'upcoming',
  album: {
    albumTitle: 'Cool Album',
    artistCredit: 'The Band',
    coverUrl: null,
    coverBlurDataUrl: null,
    tracks: [],
  },
  extras: { text: '', links: [], images: [] },
  spotifyPlaylistUrl: null,
  createdBy: 'admin',
  createdAt: 0,
  updatedAt: 0,
};

const defaultRsvpSummary: RsvpSummary = {
  confirmedCount: 0,
  waitlistCount: 0,
  capacity: null,
  confirmedAvatars: [],
};

function setupDefaults() {
  mockUseAuth.mockReturnValue({ user: null, isAuthenticated: false });
  mockUseVotes.mockReturnValue({ userVote: null, submitVote: vi.fn() });
  mockUseRsvp.mockReturnValue({
    summary: null,
    userEntry: null,
    submit: vi.fn(),
    cancel: vi.fn(),
  });
}

function renderListen() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<Listen />} />
        <Route
          path="/archive"
          element={<div data-testid="archive-redirect-target" />}
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe('Listen page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDefaults();
  });

  it('shows intro + archive link when there is no current event', () => {
    mockUseEvent.mockReturnValue({ event: null, album: null, tracks: [], loading: false, error: null });
    renderListen();
    expect(screen.getByText(/somos um evento mensal/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /arquivo/i })).toBeInTheDocument();
    expect(screen.queryByTestId('archive-redirect-target')).not.toBeInTheDocument();
  });

  it('does not redirect while loading, even with no event', () => {
    mockUseEvent.mockReturnValue({ event: null, album: null, tracks: [], loading: true, error: null });
    renderListen();
    expect(screen.getByTestId('loading-skeleton')).toBeInTheDocument();
    expect(screen.queryByTestId('archive-redirect-target')).not.toBeInTheDocument();
  });

  it('does not redirect on error, even with no event', () => {
    mockUseEvent.mockReturnValue({ event: null, album: null, tracks: [], loading: false, error: 'boom' });
    renderListen();
    expect(screen.getByText(/erro: boom/i)).toBeInTheDocument();
    expect(screen.queryByTestId('archive-redirect-target')).not.toBeInTheDocument();
  });

  it('shows album title when event exists', () => {
    mockUseEvent.mockReturnValue({ event: baseEvent, album: null, tracks: [], loading: false, error: null });
    renderListen();
    expect(screen.getByTestId('album-display')).toBeInTheDocument();
  });

  it('shows "ao vivo" badge for live events', () => {
    const liveEvent = { ...baseEvent, status: 'live' as const };
    mockUseEvent.mockReturnValue({ event: liveEvent, album: null, tracks: [], loading: false, error: null });
    renderListen();
    // The badge is a <span> with the text; use getAllByText and check at least one exists
    const badges = screen.getAllByText(/ao vivo/i);
    expect(badges.length).toBeGreaterThan(0);
  });

  it('shows "próximo evento" badge for upcoming events', () => {
    mockUseEvent.mockReturnValue({ event: baseEvent, album: null, tracks: [], loading: false, error: null });
    renderListen();
    expect(screen.getByText(/próximo evento/i)).toBeInTheDocument();
  });

  it('shows RSVP section when event.rsvp.enabled is true and summary exists', () => {
    const rsvpConfig = {
      enabled: true,
      capacity: 50,
      waitlistEnabled: false,
      plusOneAllowed: false,
      approvalMode: 'auto' as const,
      opensAt: null,
      closesAt: null,
    };
    const eventWithRsvp = { ...baseEvent, rsvp: rsvpConfig };
    mockUseEvent.mockReturnValue({ event: eventWithRsvp, album: null, tracks: [], loading: false, error: null });
    mockUseRsvp.mockReturnValue({
      summary: defaultRsvpSummary,
      userEntry: null,
      submit: vi.fn(),
      cancel: vi.fn(),
    });
    renderListen();
    expect(screen.getByTestId('rsvp-status')).toBeInTheDocument();
  });

  it('does NOT show RSVP when rsvp is undefined', () => {
    const eventWithoutRsvp = { ...baseEvent, rsvp: undefined };
    mockUseEvent.mockReturnValue({ event: eventWithoutRsvp, album: null, tracks: [], loading: false, error: null });
    renderListen();
    expect(screen.queryByTestId('rsvp-status')).not.toBeInTheDocument();
  });
});
