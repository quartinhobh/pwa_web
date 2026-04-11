import { describe, expect, it } from 'vitest';
import { decideActions, type EventWithFlags } from '../jobs/emailScheduler';

function makeEvent(overrides: Partial<EventWithFlags> = {}): EventWithFlags {
  return {
    id: 'ev1',
    mbAlbumId: 'mb',
    title: 'Quartinho #1',
    date: '2026-05-15',
    startTime: '19:00',
    endTime: '23:00',
    location: 'Rua das Flores, 10',
    status: 'upcoming',
    album: null,
    extras: { text: '', links: [], images: [] },
    spotifyPlaylistUrl: null,
    createdBy: 'admin',
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  };
}

describe('decideActions', () => {
  it('fires reminder exactly 1 day before the event', () => {
    const ev = makeEvent({ date: '2026-05-15' });
    const actions = decideActions(ev, '2026-05-14');
    expect(actions.map((a) => a.kind)).toEqual(['reminder']);
  });

  it('fires venue_reveal N days before (default 7)', () => {
    const ev = makeEvent({ date: '2026-05-15' });
    const actions = decideActions(ev, '2026-05-08');
    expect(actions.map((a) => a.kind)).toEqual(['venue_reveal']);
  });

  it('fires venue_reveal using per-event venueRevealDaysBefore override', () => {
    const ev = makeEvent({ date: '2026-05-15', venueRevealDaysBefore: 3 });
    const actions = decideActions(ev, '2026-05-12');
    expect(actions.map((a) => a.kind)).toEqual(['venue_reveal']);
  });

  it('returns no actions when today is neither D-1 nor D-N', () => {
    const ev = makeEvent({ date: '2026-05-15' });
    expect(decideActions(ev, '2026-05-10')).toEqual([]);
  });

  it('skips reminder when flag already set', () => {
    const ev = makeEvent({ date: '2026-05-15', reminderEmailSent: true });
    expect(decideActions(ev, '2026-05-14')).toEqual([]);
  });

  it('skips venue_reveal when flag already set', () => {
    const ev = makeEvent({ date: '2026-05-15', venueRevealEmailSent: true });
    expect(decideActions(ev, '2026-05-08')).toEqual([]);
  });

  it('returns no actions for events already in the past', () => {
    const ev = makeEvent({ date: '2026-05-15' });
    expect(decideActions(ev, '2026-05-20')).toEqual([]);
  });

  it('fires both reminder and venue_reveal when D-1 equals D-N (venueRevealDaysBefore = 1)', () => {
    const ev = makeEvent({ date: '2026-05-15', venueRevealDaysBefore: 1 });
    const kinds = decideActions(ev, '2026-05-14').map((a) => a.kind);
    expect(kinds).toContain('reminder');
    expect(kinds).toContain('venue_reveal');
  });
});
