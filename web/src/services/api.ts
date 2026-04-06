import type {
  Ban,
  Event,
  EventExtras,
  EventStatus,
  ModerationLog,
  MusicBrainzRelease,
  MusicBrainzTrack,
  Photo,
  PhotoCategory,
  UserRole,
  UserVote,
  VoteTallies,
} from '@/types';

const API_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:3000';

export interface CurrentUserResponse {
  userId: string;
  email: string | null;
  displayName: string;
  role: UserRole;
}

export async function fetchCurrentUser(
  idToken: string,
): Promise<CurrentUserResponse> {
  const res = await fetch(`${API_URL}/auth/me`, {
    headers: { Authorization: `Bearer ${idToken}` },
  });
  if (!res.ok) throw new Error(`GET /auth/me failed: ${res.status}`);
  return (await res.json()) as CurrentUserResponse;
}

export interface EventCreatePayload {
  mbAlbumId: string;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  extras: EventExtras;
  spotifyPlaylistUrl: string | null;
}

export async function createEvent(
  payload: EventCreatePayload,
  idToken: string,
): Promise<Event> {
  const res = await fetch(`${API_URL}/events`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`POST /events failed: ${res.status}`);
  const body = (await res.json()) as { event: Event };
  return body.event;
}

export async function updateEvent(
  id: string,
  patch: Partial<EventCreatePayload>,
  idToken: string,
): Promise<Event> {
  const res = await fetch(`${API_URL}/events/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error(`PUT /events/${id} failed: ${res.status}`);
  const body = (await res.json()) as { event: Event };
  return body.event;
}

export async function deleteEvent(
  id: string,
  idToken: string,
): Promise<void> {
  const res = await fetch(`${API_URL}/events/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${idToken}` },
  });
  if (!res.ok) throw new Error(`DELETE /events/${id} failed: ${res.status}`);
}

export async function setSpotifyPlaylist(
  eventId: string,
  spotifyPlaylistUrl: string,
  idToken: string,
): Promise<Event> {
  const res = await fetch(
    `${API_URL}/events/${encodeURIComponent(eventId)}/spotify`,
    {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({ spotifyPlaylistUrl }),
    },
  );
  if (!res.ok)
    throw new Error(`PUT /events/${eventId}/spotify failed: ${res.status}`);
  const body = (await res.json()) as { event: Event };
  return body.event;
}

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

export async function fetchEvents(status?: EventStatus): Promise<Event[]> {
  const qs = status ? `?status=${encodeURIComponent(status)}` : '';
  const res = await fetch(`${API_URL}/events${qs}`);
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

export async function fetchTallies(eventId: string): Promise<VoteTallies> {
  const res = await fetch(`${API_URL}/votes/${encodeURIComponent(eventId)}`);
  if (!res.ok) throw new Error(`GET /votes/${eventId} failed: ${res.status}`);
  return (await res.json()) as VoteTallies;
}

export async function fetchUserVote(
  eventId: string,
  idToken: string | null,
): Promise<UserVote | null> {
  if (!idToken) return null;
  const res = await fetch(
    `${API_URL}/votes/${encodeURIComponent(eventId)}/user`,
    { headers: { Authorization: `Bearer ${idToken}` } },
  );
  if (!res.ok) throw new Error(`GET /votes/${eventId}/user failed: ${res.status}`);
  const body = (await res.json()) as { vote: UserVote | null };
  return body.vote;
}

export async function postVote(
  eventId: string,
  idToken: string,
  favoriteTrackId: string,
  leastLikedTrackId: string,
): Promise<VoteTallies> {
  const res = await fetch(`${API_URL}/votes/${encodeURIComponent(eventId)}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({ favoriteTrackId, leastLikedTrackId }),
  });
  if (!res.ok) throw new Error(`POST /votes/${eventId} failed: ${res.status}`);
  return (await res.json()) as VoteTallies;
}

// ── P3-F Moderation ────────────────────────────────────────────────

export async function deleteChatMessage(
  eventId: string,
  messageId: string,
  idToken: string,
  reason?: string,
): Promise<void> {
  const res = await fetch(
    `${API_URL}/moderation/chat/${encodeURIComponent(eventId)}/delete`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({ messageId, reason }),
    },
  );
  if (!res.ok) throw new Error(`POST moderation/delete failed: ${res.status}`);
}

export async function banUser(
  userId: string,
  idToken: string,
  eventId?: string,
  reason?: string,
): Promise<Ban> {
  const res = await fetch(`${API_URL}/moderation/ban`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({ userId, eventId, reason }),
  });
  if (!res.ok) throw new Error(`POST moderation/ban failed: ${res.status}`);
  const body = (await res.json()) as { ban: Ban };
  return body.ban;
}

export async function unbanUser(
  userId: string,
  idToken: string,
): Promise<void> {
  const res = await fetch(
    `${API_URL}/moderation/ban/${encodeURIComponent(userId)}`,
    {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${idToken}` },
    },
  );
  if (!res.ok) throw new Error(`DELETE moderation/ban failed: ${res.status}`);
}

export async function fetchBans(idToken: string): Promise<Ban[]> {
  const res = await fetch(`${API_URL}/moderation/bans`, {
    headers: { Authorization: `Bearer ${idToken}` },
  });
  if (!res.ok) throw new Error(`GET moderation/bans failed: ${res.status}`);
  const body = (await res.json()) as { bans: Ban[] };
  return body.bans;
}

export async function fetchUserProfile(
  userId: string,
  idToken: string,
): Promise<{ userId: string; displayName: string | null; email: string | null; role: string }> {
  const res = await fetch(`${API_URL}/moderation/users/${encodeURIComponent(userId)}`, {
    headers: { Authorization: `Bearer ${idToken}` },
  });
  if (!res.ok) throw new Error(`GET moderation/users/${userId} failed: ${res.status}`);
  return (await res.json()) as { userId: string; displayName: string | null; email: string | null; role: string };
}

export async function fetchModerationLogs(
  idToken: string,
): Promise<ModerationLog[]> {
  const res = await fetch(`${API_URL}/moderation/logs`, {
    headers: { Authorization: `Bearer ${idToken}` },
  });
  if (!res.ok) throw new Error(`GET moderation/logs failed: ${res.status}`);
  const body = (await res.json()) as { logs: ModerationLog[] };
  return body.logs;
}

// ── P3-G Photos ────────────────────────────────────────────────────

export async function fetchPhotos(eventId: string): Promise<Photo[]> {
  const res = await fetch(`${API_URL}/photos/${encodeURIComponent(eventId)}`);
  if (!res.ok) throw new Error(`GET /photos/${eventId} failed: ${res.status}`);
  const body = (await res.json()) as { photos: Photo[] };
  return body.photos;
}

export async function uploadPhoto(
  eventId: string,
  category: PhotoCategory,
  file: File,
  idToken: string,
): Promise<Photo> {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(
    `${API_URL}/photos/${encodeURIComponent(eventId)}/${category}/upload`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${idToken}` },
      body: form,
    },
  );
  if (!res.ok) throw new Error(`POST /photos upload failed: ${res.status}`);
  const body = (await res.json()) as { photo: Photo };
  return body.photo;
}

export async function deletePhoto(
  eventId: string,
  category: PhotoCategory,
  photoId: string,
  idToken: string,
): Promise<void> {
  const res = await fetch(
    `${API_URL}/photos/${encodeURIComponent(eventId)}/${category}/${encodeURIComponent(photoId)}`,
    {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${idToken}` },
    },
  );
  if (!res.ok) throw new Error(`DELETE /photos failed: ${res.status}`);
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
