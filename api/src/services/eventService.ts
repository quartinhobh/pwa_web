// Event service — Firestore-backed CRUD for /events.
// Owner: feature-builder. Pure domain; no HTTP concerns.

import { adminDb } from '../config/firebase';
import type {
  AggregatedCredits,
  Event,
  EventAlbumSnapshot,
  EventCreatePayload,
  EventStatus,
  RsvpDoc,
  RsvpEntry,
} from '../types';
import { fetchAlbum, fetchCredits } from './musicbrainzService';
import { fetchCoverArt } from './coverArtService';
import { computeEventStatus, withDerivedStatus } from './eventStatus';
import { fetchLyrics } from './lyricsService';

const EVENTS = 'events';

function maybeBackfillCredits(event: Event): void {
  const album = event.album;
  if (!album || !event.mbAlbumId) return;
  if (album.credits || album.creditsAttempted) return;

  const ref = adminDb.collection(EVENTS).doc(event.id);

  fetchCredits(event.mbAlbumId)
    .then((cr) => {
      void ref.update({ 'album.credits': cr.credits, 'album.tracks': cr.tracks, 'album.creditsAttempted': true });

      // Fire-and-forget: warm lyrics cache in background
      const artist = album.artistCredit;
      if (artist) {
        void Promise.allSettled(
          cr.tracks.map((t) =>
            fetchLyrics(artist, t.title, { skipCache: true }),
          ),
        );
      }
    })
    .catch(() => {
      void ref.update({ 'album.creditsAttempted': true });
    });
}

export async function listEvents(): Promise<Event[]> {
  const snap = await adminDb
    .collection(EVENTS)
    .orderBy('date', 'desc')
    .get();
  return snap.docs.map((d) => withDerivedStatus(d.data() as Event));
}

export async function getCurrentEvent(): Promise<Event | null> {
  // Status is derived from date now, so we can't query by `status` anymore.
  // Pull a window of recent + upcoming events ordered by date asc and pick
  // the first one whose computed status is not 'archived'. The window is
  // bounded by date >= 60 days ago to avoid scanning the full archive.
  const cutoff = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  const snap = await adminDb
    .collection(EVENTS)
    .where('date', '>=', cutoff)
    .orderBy('date', 'asc')
    .get();
  for (const doc of snap.docs) {
    const ev = doc.data() as Event;
    if (computeEventStatus(ev) !== 'archived') {
      const result = withDerivedStatus(ev);
      maybeBackfillCredits(result);
      return result;
    }
  }
  return null;
}

export async function getEventById(id: string): Promise<Event | null> {
  const snap = await adminDb.collection(EVENTS).doc(id).get();
  if (!snap.exists) return null;
  const ev = withDerivedStatus(snap.data() as Event);
  maybeBackfillCredits(ev);
  return ev;
}

export async function createEvent(
  payload: EventCreatePayload,
  createdBy: string,
): Promise<Event> {
  const now = Date.now();
  const ref = adminDb.collection(EVENTS).doc();

  // Snapshot MusicBrainz data at creation time so the app never needs to
  // re-fetch it — avoids rate limits when 60 users hit the same event.
  // Cover art is fetched via waterfall: CAA → Deezer → Last.fm → null
  let album: EventAlbumSnapshot | null = null;
  if (payload.mbAlbumId) {
    try {
      const mb = await fetchAlbum(payload.mbAlbumId);
      const { coverUrl, coverBlurDataUrl } = await fetchCoverArt({
        mbid: mb.id,
        artistCredit: mb.artistCredit,
        albumTitle: mb.title,
      });
      // Credits (genres, label, performers, composers) are the slow part:
      // one rate-limited MusicBrainz call per track (~N seconds). We skip them
      // here so the admin gets a fast response, and let maybeBackfillCredits
      // populate them in the background. creditsAttempted:false keeps the
      // read-path backfill enabled as a safety net.
      album = {
        albumTitle: mb.title,
        artistCredit: mb.artistCredit,
        coverUrl,
        coverBlurDataUrl,
        tracks: mb.tracks,
        creditsAttempted: false,
      };
    } catch {
      // MB unreachable — album snapshot stays null, can be enriched later.
    }
  }

  const event: Event = {
    id: ref.id,
    mbAlbumId: payload.mbAlbumId,
    title: payload.title,
    date: payload.date,
    startTime: payload.startTime,
    endTime: payload.endTime,
    location: payload.location ?? null,
    venueRevealDaysBefore: payload.venueRevealDaysBefore ?? 7,
    status: 'upcoming' satisfies EventStatus,
    album,
    extras: payload.extras,
    spotifyPlaylistUrl: payload.spotifyPlaylistUrl,
    chatEnabled: payload.chatEnabled ?? true,
    chatOpensAt: payload.chatOpensAt ?? null,
    chatClosesAt: payload.chatClosesAt ?? null,
    createdBy,
    createdAt: now,
    updatedAt: now,
  };
  await ref.set(event);
  // Fire-and-forget: start fetching credits now so they're ready by the time
  // anyone opens the event. The read-path also retries via maybeBackfillCredits.
  maybeBackfillCredits(event);
  return event;
}

export async function cancelEvent(
  id: string,
  reason?: string,
): Promise<Event | null> {
  const ref = adminDb.collection(EVENTS).doc(id);
  const snap = await ref.get();
  if (!snap.exists) return null;
  const patch = {
    status: 'cancelled' as EventStatus,
    cancelledAt: Date.now(),
    cancelledReason: reason?.trim() ? reason.trim() : null,
    updatedAt: Date.now(),
  };
  await ref.update(patch);
  const updated = await ref.get();
  return updated.data() as Event;
}

/** List of {email,displayName} for RSVP entries matching a status filter. */
export async function getRsvpEmailsByFilter(
  eventId: string,
  filter: 'confirmed' | 'waitlisted' | 'all',
): Promise<{ email: string; displayName: string }[]> {
  const snap = await adminDb.collection('rsvps').doc(eventId).get();
  if (!snap.exists) return [];
  const doc = snap.data() as RsvpDoc;
  const out: { email: string; displayName: string }[] = [];
  const seen = new Set<string>();
  for (const entry of Object.values(doc.entries) as RsvpEntry[]) {
    if (entry.status === 'cancelled' || entry.status === 'rejected') continue;
    if (filter === 'confirmed' && entry.status !== 'confirmed') continue;
    if (filter === 'waitlisted' && entry.status !== 'waitlisted') continue;
    const email = (entry.email ?? '').trim().toLowerCase();
    if (!email) continue;
    if (seen.has(email)) continue;
    seen.add(email);
    out.push({ email, displayName: entry.displayName || 'amigo' });
  }
  return out;
}

export async function updateEvent(
  id: string,
  patch: Partial<Omit<Event, 'id' | 'createdAt' | 'createdBy'>>,
): Promise<Event | null> {
  const ref = adminDb.collection(EVENTS).doc(id);
  const snap = await ref.get();
  if (!snap.exists) return null;
  const next = { ...patch, updatedAt: Date.now() };
  await ref.update(next);
  const updated = await ref.get();
  return updated.data() as Event;
}

export async function deleteEvent(id: string): Promise<boolean> {
  const ref = adminDb.collection(EVENTS).doc(id);
  const snap = await ref.get();
  if (!snap.exists) return false;
  await ref.delete();
  return true;
}

export async function refreshEventCredits(
  eventId: string,
): Promise<AggregatedCredits | null> {
  const ref = adminDb.collection(EVENTS).doc(eventId);
  const snap = await ref.get();
  if (!snap.exists) return null;
  const ev = snap.data() as Event;
  if (!ev.mbAlbumId) return null;

  const { credits, tracks } = await fetchCredits(ev.mbAlbumId, true);
  await ref.update({
    'album.credits': credits,
    'album.tracks': tracks,
    'album.creditsAttempted': true,
  });

  // Refresh lyrics for all tracks and cache them
  const artist = ev.album?.artistCredit;
  if (artist) {
    await Promise.allSettled(
      tracks.map((t) =>
        fetchLyrics(artist, t.title, { skipCache: true }),
      ),
    );
  }

  return credits;
}
