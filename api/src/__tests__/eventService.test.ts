// eventService unit tests — mocks Firestore with an in-memory store.

import { describe, expect, it, vi, beforeEach } from 'vitest';

const store = {
  events: new Map<string, Record<string, unknown>>(),
  rsvps: new Map<string, Record<string, unknown>>(),
};

function collectionMap(name: string): Map<string, Record<string, unknown>> {
  if (name === 'events') return store.events;
  if (name === 'rsvps') return store.rsvps;
  throw new Error(`unknown collection: ${name}`);
}

function makeDocRef(col: string, id: string) {
  return {
    id,
    get: () => {
      const data = collectionMap(col).get(id);
      return Promise.resolve({ exists: data !== undefined, id, data: () => data });
    },
    set: (value: Record<string, unknown>) => {
      collectionMap(col).set(id, structuredClone(value));
      return Promise.resolve();
    },
    update: (patch: Record<string, unknown>) => {
      const existing = collectionMap(col).get(id) ?? {};
      collectionMap(col).set(id, { ...existing, ...patch });
      return Promise.resolve();
    },
  };
}

vi.mock('../config/firebase', () => ({
  adminDb: {
    collection: (name: string) => ({
      doc: (id: string) => makeDocRef(name, id),
    }),
  },
  adminAuth: {},
}));

// Avoid hitting MusicBrainz/image fetching in cancelEvent's sibling createEvent.
vi.mock('../services/musicbrainzService', () => ({
  fetchAlbum: vi.fn(),
}));
vi.mock('../services/blurPlaceholder', () => ({
  generateBlurPlaceholder: vi.fn().mockResolvedValue(null),
}));

import { cancelEvent, getRsvpEmailsByFilter } from '../services/eventService';

beforeEach(() => {
  store.events.clear();
  store.rsvps.clear();
});

describe('cancelEvent', () => {
  it('marks the event as cancelled and returns the updated doc', async () => {
    store.events.set('evt1', {
      id: 'evt1',
      title: 'T',
      date: '2099-01-01',
      startTime: '20:00',
      endTime: '22:00',
      status: 'upcoming',
    });
    const updated = await cancelEvent('evt1', 'chuva forte');
    expect(updated?.status).toBe('cancelled');
    expect(updated?.cancelledReason).toBe('chuva forte');
    expect(typeof updated?.cancelledAt).toBe('number');
  });

  it('returns null if event does not exist', async () => {
    const result = await cancelEvent('missing');
    expect(result).toBeNull();
  });

  it('stores null reason when empty string passed', async () => {
    store.events.set('evt2', {
      id: 'evt2', title: 'T', date: '2099-01-01', startTime: '20:00', endTime: '22:00',
    });
    const updated = await cancelEvent('evt2', '   ');
    expect(updated?.cancelledReason).toBeNull();
  });
});

describe('getRsvpEmailsByFilter', () => {
  beforeEach(() => {
    store.rsvps.set('evt1', {
      entries: {
        'firebase:u1': { status: 'confirmed', email: 'u1@x.com', displayName: 'U1', authMode: 'firebase', plusOne: false, plusOneName: null, createdAt: 1, updatedAt: 1 },
        'guest:abcd': { status: 'confirmed', email: 'g1@x.com', displayName: 'G1', authMode: 'guest', plusOne: false, plusOneName: null, createdAt: 2, updatedAt: 2 },
        'firebase:u2': { status: 'waitlisted', email: 'u2@x.com', displayName: 'U2', authMode: 'firebase', plusOne: false, plusOneName: null, createdAt: 3, updatedAt: 3 },
        'firebase:u3': { status: 'cancelled', email: 'u3@x.com', displayName: 'U3', authMode: 'firebase', plusOne: false, plusOneName: null, createdAt: 4, updatedAt: 4 },
        'firebase:u4': { status: 'rejected', email: 'u4@x.com', displayName: 'U4', authMode: 'firebase', plusOne: false, plusOneName: null, createdAt: 5, updatedAt: 5 },
      },
      confirmedCount: 2, waitlistCount: 1, updatedAt: 0,
    });
  });

  it('filter=confirmed returns only confirmed entries', async () => {
    const list = await getRsvpEmailsByFilter('evt1', 'confirmed');
    expect(list.map((r) => r.email).sort()).toEqual(['g1@x.com', 'u1@x.com']);
  });

  it('filter=waitlisted returns only waitlisted entries', async () => {
    const list = await getRsvpEmailsByFilter('evt1', 'waitlisted');
    expect(list.map((r) => r.email)).toEqual(['u2@x.com']);
  });

  it('filter=all excludes cancelled and rejected', async () => {
    const list = await getRsvpEmailsByFilter('evt1', 'all');
    expect(list.map((r) => r.email).sort()).toEqual(['g1@x.com', 'u1@x.com', 'u2@x.com']);
  });

  it('returns empty when rsvp doc missing', async () => {
    const list = await getRsvpEmailsByFilter('missing', 'all');
    expect(list).toEqual([]);
  });
});
