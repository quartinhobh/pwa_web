// Event DTO parsers — single source of truth for POST /events and PUT /events/:id
// request body validation. Replaces the duplicate `parsePayload` and
// `parseUpdatePatch` ladders that previously lived in routes/events.ts.
//
// Both parsers share `isString` / `isNumber` / `isObject` helpers so the type-
// guard rules are grep-able in one place.

import type {
  EventCreatePayload,
  EventPatch,
  VenueRevealPolicy,
} from '../types';

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null;

const isString = (v: unknown): v is string => typeof v === 'string';

const isNumber = (v: unknown): v is number => typeof v === 'number';

const isNonNegativeFinite = (v: unknown): v is number =>
  isNumber(v) && Number.isFinite(v) && v >= 0;

/** Recursively validate a VenueRevealPolicy shape. Returns null on any
 *  deviation from the discriminated union. */
function validateVenueRevealPolicy(input: unknown): VenueRevealPolicy | null {
  if (!isObject(input) || !isString(input.mode)) return null;
  switch (input.mode) {
    case 'always':
      return { mode: 'always' };
    case 'days_before_event':
    case 'days_after_creation': {
      const days = Math.floor(input.days as number);
      if (!isNonNegativeFinite(days)) return null;
      return { mode: input.mode, days };
    }
    case 'after_n_previous_events': {
      const count = Math.floor(input.count as number);
      if (!isNonNegativeFinite(count)) return null;
      return { mode: 'after_n_previous_events', count };
    }
    case 'correlated': {
      if (input.operator !== 'and' && input.operator !== 'or') return null;
      if (!Array.isArray(input.policies)) return null;
      const subs: VenueRevealPolicy[] = [];
      for (const sub of input.policies) {
        const v = validateVenueRevealPolicy(sub);
        if (!v) return null;
        subs.push(v);
      }
      return { mode: 'correlated', operator: input.operator, policies: subs };
    }
    default:
      return null;
  }
}

/**
 * Validate a POST /events body. Returns the typed payload on success, or
 * `null` when the body is malformed (non-object, missing required field,
 * wrong type, non-object extras).
 */
export function parseEventCreate(body: unknown): EventCreatePayload | null {
  if (!isObject(body)) return null;
  if (
    !isString(body.mbAlbumId) ||
    !isString(body.title) ||
    !isString(body.date) ||
    !isString(body.startTime) ||
    !isString(body.endTime) ||
    typeof body.extras !== 'object' ||
    body.extras === null
  ) {
    return null;
  }
  let venueRevealPolicy: VenueRevealPolicy | undefined;
  if (body.venueRevealPolicy !== undefined && body.venueRevealPolicy !== null) {
    const validated = validateVenueRevealPolicy(body.venueRevealPolicy);
    if (!validated) return null;
    venueRevealPolicy = validated;
  }
  return {
    mbAlbumId: body.mbAlbumId,
    title: body.title,
    date: body.date,
    startTime: body.startTime,
    endTime: body.endTime,
    extras: body.extras as EventCreatePayload['extras'],
    location: isString(body.location) ? body.location : null,
    venueRevealDaysBefore:
      isNumber(body.venueRevealDaysBefore) && body.venueRevealDaysBefore >= 0
        ? Math.floor(body.venueRevealDaysBefore)
        : undefined,
    venueRevealPolicy,
    spotifyPlaylistUrl: isString(body.spotifyPlaylistUrl) ? body.spotifyPlaylistUrl : null,
    chatEnabled: typeof body.chatEnabled === 'boolean' ? body.chatEnabled : undefined,
    chatOpensAt: isNumber(body.chatOpensAt)
      ? body.chatOpensAt
      : body.chatOpensAt === null
        ? null
        : undefined,
    chatClosesAt: isNumber(body.chatClosesAt)
      ? body.chatClosesAt
      : body.chatClosesAt === null
        ? null
        : undefined,
  };
}

/**
 * Validate a PUT /events/:id patch body. Returns the whitelisted patch on
 * success, or `null` when the body is not an object (string, number, null,
 * undefined, …). Unknown / wrong-type fields are silently dropped — matches
 * the previous behavior of `parseUpdatePatch`.
 */
export function parseEventPatch(body: unknown): EventPatch | null {
  if (!isObject(body)) return null;
  const patch: EventPatch = {};
  if (isString(body.title)) patch.title = body.title;
  if (isString(body.date)) patch.date = body.date;
  if (isString(body.startTime)) patch.startTime = body.startTime;
  if (isString(body.endTime)) patch.endTime = body.endTime;
  if (isString(body.location) || body.location === null) {
    patch.location = body.location as string | null;
  }
  if (isNumber(body.venueRevealDaysBefore) && body.venueRevealDaysBefore >= 0) {
    patch.venueRevealDaysBefore = Math.floor(body.venueRevealDaysBefore);
  }
  if (body.venueRevealPolicy !== undefined && body.venueRevealPolicy !== null) {
    const validated = validateVenueRevealPolicy(body.venueRevealPolicy);
    if (validated) patch.venueRevealPolicy = validated;
  }
  if (isString(body.spotifyPlaylistUrl) || body.spotifyPlaylistUrl === null) {
    patch.spotifyPlaylistUrl = body.spotifyPlaylistUrl as string | null;
  }
  if (body.extras && typeof body.extras === 'object') {
    patch.extras = body.extras as EventPatch['extras'];
  }
  if (body.rsvp && typeof body.rsvp === 'object') {
    patch.rsvp = body.rsvp as EventPatch['rsvp'];
  }
  if (typeof body.chatEnabled === 'boolean') patch.chatEnabled = body.chatEnabled;
  if (isNumber(body.chatOpensAt) || body.chatOpensAt === null) {
    patch.chatOpensAt = body.chatOpensAt as number | null;
  }
  if (isNumber(body.chatClosesAt) || body.chatClosesAt === null) {
    patch.chatClosesAt = body.chatClosesAt as number | null;
  }
  return patch;
}
