// Unit tests for the event DTO parsers. Pure functions — no Firestore / no mocks.

import { describe, expect, it } from 'vitest';
import { parseEventCreate, parseEventPatch } from '../services/eventDto';

const validCreate = {
  mbAlbumId: 'abc-123',
  title: 'Test Album',
  date: '2025-01-15',
  startTime: '20:00',
  endTime: '22:00',
  extras: { text: '', links: [], images: [] },
  spotifyPlaylistUrl: null,
};

describe('parseEventCreate', () => {
  describe('rejects', () => {
    it('null body', () => {
      expect(parseEventCreate(null)).toBeNull();
    });

    it('undefined body', () => {
      expect(parseEventCreate(undefined)).toBeNull();
    });

    it('array body', () => {
      expect(parseEventCreate([1, 2, 3])).toBeNull();
    });

    it('string body', () => {
      expect(parseEventCreate('hello')).toBeNull();
    });

    it('number body', () => {
      expect(parseEventCreate(42)).toBeNull();
    });

    it('boolean body', () => {
      expect(parseEventCreate(true)).toBeNull();
    });

    it('missing mbAlbumId', () => {
      expect(parseEventCreate({ ...validCreate, mbAlbumId: undefined })).toBeNull();
    });

    it('missing title', () => {
      expect(parseEventCreate({ ...validCreate, title: undefined })).toBeNull();
    });

    it('missing date', () => {
      expect(parseEventCreate({ ...validCreate, date: undefined })).toBeNull();
    });

    it('missing startTime', () => {
      expect(parseEventCreate({ ...validCreate, startTime: undefined })).toBeNull();
    });

    it('missing endTime', () => {
      expect(parseEventCreate({ ...validCreate, endTime: undefined })).toBeNull();
    });

    it('missing extras', () => {
      expect(parseEventCreate({ ...validCreate, extras: undefined })).toBeNull();
    });

    it('number where string (mbAlbumId)', () => {
      expect(parseEventCreate({ ...validCreate, mbAlbumId: 123 })).toBeNull();
    });

    it('boolean where string (title)', () => {
      expect(parseEventCreate({ ...validCreate, title: true })).toBeNull();
    });

    it('null where string (date)', () => {
      expect(parseEventCreate({ ...validCreate, date: null })).toBeNull();
    });

    it('non-object extras', () => {
      expect(parseEventCreate({ ...validCreate, extras: 'nope' })).toBeNull();
    });

    it('number extras', () => {
      expect(parseEventCreate({ ...validCreate, extras: 42 })).toBeNull();
    });

    it('null extras', () => {
      expect(parseEventCreate({ ...validCreate, extras: null })).toBeNull();
    });
  });

  describe('accepts', () => {
    it('the known-good sample payload from events.test.ts', () => {
      const result = parseEventCreate(validCreate);
      expect(result).not.toBeNull();
      expect(result?.mbAlbumId).toBe('abc-123');
      expect(result?.title).toBe('Test Album');
      expect(result?.date).toBe('2025-01-15');
      expect(result?.startTime).toBe('20:00');
      expect(result?.endTime).toBe('22:00');
      expect(result?.extras).toEqual({ text: '', links: [], images: [] });
      expect(result?.spotifyPlaylistUrl).toBeNull();
      expect(result?.location).toBeNull();
      expect(result?.venueRevealDaysBefore).toBeUndefined();
      expect(result?.chatEnabled).toBeUndefined();
    });

    it('a minimal body (only the required fields)', () => {
      const minimal = {
        mbAlbumId: 'x',
        title: 't',
        date: 'd',
        startTime: 's',
        endTime: 'e',
        extras: { text: '', links: [], images: [] },
      };
      const result = parseEventCreate(minimal);
      expect(result).not.toBeNull();
      expect(result?.mbAlbumId).toBe('x');
      expect(result?.location).toBeNull();
      expect(result?.spotifyPlaylistUrl).toBeNull();
    });

    it('a body with every optional field populated', () => {
      const full = {
        ...validCreate,
        location: 'Bar do Quartinho',
        venueRevealDaysBefore: 7,
        spotifyPlaylistUrl: 'https://open.spotify.com/playlist/abc',
        chatEnabled: true,
        chatOpensAt: 1700000000000,
        chatClosesAt: null,
      };
      const result = parseEventCreate(full);
      expect(result?.location).toBe('Bar do Quartinho');
      expect(result?.venueRevealDaysBefore).toBe(7);
      expect(result?.spotifyPlaylistUrl).toBe('https://open.spotify.com/playlist/abc');
      expect(result?.chatEnabled).toBe(true);
      expect(result?.chatOpensAt).toBe(1700000000000);
      expect(result?.chatClosesAt).toBeNull();
    });

    it('floors fractional venueRevealDaysBefore', () => {
      const result = parseEventCreate({ ...validCreate, venueRevealDaysBefore: 3.7 });
      expect(result?.venueRevealDaysBefore).toBe(3);
    });

    it('drops negative venueRevealDaysBefore (→ undefined)', () => {
      const result = parseEventCreate({ ...validCreate, venueRevealDaysBefore: -1 });
      expect(result?.venueRevealDaysBefore).toBeUndefined();
    });
  });
});

describe('parseEventPatch', () => {
  describe('rejects', () => {
    it('null body', () => {
      expect(parseEventPatch(null)).toBeNull();
    });

    it('undefined body', () => {
      expect(parseEventPatch(undefined)).toBeNull();
    });

    it('string body', () => {
      expect(parseEventPatch('hi')).toBeNull();
    });

    it('number body', () => {
      expect(parseEventPatch(42)).toBeNull();
    });
  });

  describe('accepts', () => {
    it('empty object — valid no-op patch', () => {
      expect(parseEventPatch({})).toEqual({});
    });

    it('partial { title }', () => {
      expect(parseEventPatch({ title: 'x' })).toEqual({ title: 'x' });
    });

    it('the PUT body used in events.test.ts → { title: "Renamed" }', () => {
      // Drawn directly from api/src/__tests__/events.test.ts line 127.
      expect(parseEventPatch({ title: 'Renamed' })).toEqual({ title: 'Renamed' });
    });

    it('strips unknown / non-whitelisted fields (status is server-managed)', () => {
      const result = parseEventPatch({ title: 'x', status: 'cancelled', id: 'hax' });
      expect(result).toEqual({ title: 'x' });
    });

    it('strips wrong-typed fields', () => {
      const result = parseEventPatch({ title: 42, date: true, chatEnabled: 'yes' });
      expect(result).toEqual({});
    });

    it('negative venueRevealDaysBefore is dropped', () => {
      const result = parseEventPatch({ venueRevealDaysBefore: -1 });
      expect(result).toEqual({});
    });

    it('fractional venueRevealDaysBefore is floored', () => {
      expect(parseEventPatch({ venueRevealDaysBefore: 3.7 })).toEqual({
        venueRevealDaysBefore: 3,
      });
    });

    it('null chatOpensAt passes through', () => {
      expect(parseEventPatch({ chatOpensAt: null })).toEqual({ chatOpensAt: null });
    });

    it('null spotifyPlaylistUrl passes through', () => {
      expect(parseEventPatch({ spotifyPlaylistUrl: null })).toEqual({
        spotifyPlaylistUrl: null,
      });
    });

    it('string spotifyPlaylistUrl passes through (same field used by /spotify route)', () => {
      const url = 'https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M';
      expect(parseEventPatch({ spotifyPlaylistUrl: url })).toEqual({
        spotifyPlaylistUrl: url,
      });
    });

    it('object extras and rsvp pass through when truthy + object', () => {
      const extras = { text: 'note', links: [], images: [] };
      const rsvp = { enabled: true, capacity: 50 };
      expect(parseEventPatch({ extras, rsvp })).toEqual({ extras, rsvp });
    });

    it('null extras is dropped (not "set to null")', () => {
      expect(parseEventPatch({ extras: null })).toEqual({});
    });
  });
});

describe('parity vs previous parsePayload / parseUpdatePatch', () => {
  // Every body that previously passed parsePayload must continue to pass
  // parseEventCreate. Drawn from api/src/__tests__/events.test.ts.

  it('samplePayload (the only body that hits POST /events in events.test.ts)', () => {
    expect(parseEventCreate(validCreate)).not.toBeNull();
  });

  it('the PUT /events/:id body from events.test.ts (title rename)', () => {
    expect(parseEventPatch({ title: 'Renamed' })).toEqual({ title: 'Renamed' });
  });

  it('the PUT /events/:id/spotify body (a subset of the patch whitelist)', () => {
    const url = 'https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M';
    expect(parseEventPatch({ spotifyPlaylistUrl: url })).toEqual({
      spotifyPlaylistUrl: url,
    });
  });
});
