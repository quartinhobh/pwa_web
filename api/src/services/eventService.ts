// Event service — Firestore-backed CRUD for /events.
// Owner: feature-builder. Pure domain; no HTTP concerns.

import { adminDb } from '../config/firebase';
import type { Event, EventAlbumSnapshot, EventCreatePayload, EventStatus } from '../types';
import { fetchAlbum } from './musicbrainzService';

const EVENTS = 'events';

export async function listEvents(): Promise<Event[]> {
  const snap = await adminDb
    .collection(EVENTS)
    .orderBy('date', 'desc')
    .get();
  return snap.docs.map((d) => d.data() as Event);
}

export async function getCurrentEvent(): Promise<Event | null> {
  const snap = await adminDb
    .collection(EVENTS)
    .where('status', 'in', ['live', 'upcoming'])
    .orderBy('date', 'asc')
    .limit(1)
    .get();
  if (snap.empty) return null;
  return snap.docs[0]!.data() as Event;
}

export async function getEventById(id: string): Promise<Event | null> {
  const snap = await adminDb.collection(EVENTS).doc(id).get();
  if (!snap.exists) return null;
  return snap.data() as Event;
}

export async function createEvent(
  payload: EventCreatePayload,
  createdBy: string,
): Promise<Event> {
  const now = Date.now();
  const ref = adminDb.collection(EVENTS).doc();

  // Snapshot MusicBrainz data at creation time so the app never needs to
  // re-fetch it — avoids rate limits when 60 users hit the same event.
  let album: EventAlbumSnapshot | null = null;
  if (payload.mbAlbumId) {
    try {
      const mb = await fetchAlbum(payload.mbAlbumId);
      album = {
        albumTitle: mb.title,
        artistCredit: mb.artistCredit,
        coverUrl: `https://coverartarchive.org/release/${mb.id}/front-250`,
        tracks: mb.tracks,
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
    status: 'upcoming' satisfies EventStatus,
    album,
    extras: payload.extras,
    spotifyPlaylistUrl: payload.spotifyPlaylistUrl,
    createdBy,
    createdAt: now,
    updatedAt: now,
  };
  await ref.set(event);
  return event;
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
