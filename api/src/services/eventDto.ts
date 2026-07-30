// Event DTO parsers — single source of truth for POST /events and PUT /events/:id
// request body validation. Replaces the duplicate `parsePayload` and
// `parseUpdatePatch` ladders that previously lived in routes/events.ts.
//
// Both parsers share `isString` / `isNumber` / `isObject` helpers so the type-
// guard rules are grep-able in one place.

import type { EventCreatePayload, EventPatch } from '../types';

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null;

const isString = (v: unknown): v is string => typeof v === 'string';

const isNumber = (v: unknown): v is number => typeof v === 'number';

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
