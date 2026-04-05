import type { Event, MusicBrainzRelease, MusicBrainzTrack } from '@/types';

const API_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:3000';

export interface GuestSessionResponse {
  sessionId: string;
  guestName: string;
}

export async function postGuestSession(): Promise<GuestSessionResponse> {
  const res = await fetch(`${API_URL}/auth/guest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) throw new Error(`POST /auth/guest failed: ${res.status}`);
  return (await res.json()) as GuestSessionResponse;
}

export interface LinkSessionResponse {
  success: boolean;
  firebaseUid: string;
}

export async function postLinkSession(
  idToken: string,
  sessionId: string | null,
): Promise<LinkSessionResponse> {
  const res = await fetch(`${API_URL}/auth/link`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({ sessionId }),
  });
  if (!res.ok) throw new Error(`POST /auth/link failed: ${res.status}`);
  return (await res.json()) as LinkSessionResponse;
}

export async function fetchEvents(): Promise<Event[]> {
  const res = await fetch(`${API_URL}/events`);
  if (!res.ok) throw new Error(`GET /events failed: ${res.status}`);
  const body = (await res.json()) as { events: Event[] };
  return body.events;
}

export async function fetchCurrentEvent(): Promise<Event | null> {
  const res = await fetch(`${API_URL}/events/current`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GET /events/current failed: ${res.status}`);
  const body = (await res.json()) as { event: Event };
  return body.event;
}

export async function fetchEventById(id: string): Promise<Event | null> {
  const res = await fetch(`${API_URL}/events/${encodeURIComponent(id)}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GET /events/${id} failed: ${res.status}`);
  const body = (await res.json()) as { event: Event };
  return body.event;
}

export async function fetchMusicBrainzAlbum(
  mbid: string,
): Promise<MusicBrainzRelease> {
  const res = await fetch(`${API_URL}/mb/album/${encodeURIComponent(mbid)}`);
  if (!res.ok) throw new Error(`GET /mb/album failed: ${res.status}`);
  const body = (await res.json()) as { release: MusicBrainzRelease };
  return body.release;
}

export interface LyricsResponse {
  lyrics: string | null;
  source: string | null;
  cached: boolean;
}

export async function fetchLyrics(
  artist: string,
  title: string,
): Promise<LyricsResponse> {
  const res = await fetch(
    `${API_URL}/lyrics/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`,
  );
  if (!res.ok) throw new Error(`GET /lyrics failed: ${res.status}`);
  return (await res.json()) as LyricsResponse;
}

export async function fetchMusicBrainzTracks(
  mbid: string,
): Promise<MusicBrainzTrack[]> {
  const res = await fetch(
    `${API_URL}/mb/release-groups/${encodeURIComponent(mbid)}/tracks`,
  );
  if (!res.ok) throw new Error(`GET /mb/tracks failed: ${res.status}`);
  const body = (await res.json()) as { tracks: MusicBrainzTrack[] };
  return body.tracks;
}
