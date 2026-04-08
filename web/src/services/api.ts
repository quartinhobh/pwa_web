import type {
  AdminRsvpEntry,
  Ban,
  Banner,
  BannerRoute,
  EmailTemplate,
  Event,
  EventExtras,
  EventStatus,
  ModerationLog,
  MusicBrainzRelease,
  MusicBrainzTrack,
  Photo,
  PhotoCategory,
  PixConfig,
  Product,
  FavoriteAlbum,
  LinkTreeItem,
  RsvpEntry,
  RsvpSummary,
  SocialLink,
  User,
  UserRole,
  UserVote,
  VoteTallies,
} from '@/types';

const API_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:3000';

export interface CurrentUserResponse {
  userId: string;
  email: string | null;
  displayName: string;
  username: string | null;
  role: UserRole;
  avatarUrl: string | null;
  bio: string | null;
  socialLinks: SocialLink[];
  favoriteAlbums: FavoriteAlbum[];
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

// ── User Profile ─────────────────────────────────────────────────────

export interface UserProfile {
  id: string;
  displayName: string;
  username: string | null;
  avatarUrl: string | null;
  bio: string | null;
  socialLinks: SocialLink[];
  favoriteAlbums: FavoriteAlbum[];
}

export async function fetchUserProfile(userId: string): Promise<UserProfile> {
  const res = await fetch(`${API_URL}/users/${encodeURIComponent(userId)}/profile`);
  if (!res.ok) throw new Error(`GET /users/${userId}/profile failed: ${res.status}`);
  return (await res.json()) as UserProfile;
}

export async function fetchProfileByUsername(username: string): Promise<UserProfile> {
  const res = await fetch(`${API_URL}/users/username/${encodeURIComponent(username)}`);
  if (!res.ok) throw new Error(`GET /users/username/${username} failed: ${res.status}`);
  return (await res.json()) as UserProfile;
}

export async function updateMyProfile(
  data: { displayName?: string; bio?: string; socialLinks?: SocialLink[]; username?: string | null; favoriteAlbums?: FavoriteAlbum[] },
  idToken: string,
): Promise<void> {
  const res = await fetch(`${API_URL}/users/me/profile`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: 'unknown' }));
    const error = (body as { error?: string }).error ?? `status ${res.status}`;
    throw new Error(`profile_update_failed: ${error}`);
  }
}

export async function uploadAvatar(
  file: File,
  idToken: string,
): Promise<string> {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(`${API_URL}/users/me/avatar`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${idToken}` },
    body: form,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: 'unknown' }));
    const detail = (body as { error?: string }).error ?? `status ${res.status}`;
    throw new Error(`avatar_upload_failed: ${detail}`);
  }
  const body = (await res.json()) as { avatarUrl: string };
  return body.avatarUrl;
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
  if (res.status === 404 || res.status === 500) return null;
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

export interface MbSearchResult {
  id: string;
  title: string;
  artistCredit: string;
  date: string;
  coverUrl: string | null;
}

export async function searchMusicBrainz(query: string): Promise<MbSearchResult[]> {
  const res = await fetch(
    `${API_URL}/mb/search?q=${encodeURIComponent(query)}`,
  );
  if (!res.ok) throw new Error(`GET /mb/search failed: ${res.status}`);
  const body = (await res.json()) as { results: MbSearchResult[] };
  return body.results;
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
  targetUserId?: string,
): Promise<void> {
  const res = await fetch(
    `${API_URL}/moderation/chat/${encodeURIComponent(eventId)}/delete`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({ messageId, reason, targetUserId }),
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

export async function fetchModerationUserProfile(
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

// ── Shop / PIX ──────────────────────────────────────────────────────────

export async function fetchProducts(): Promise<Product[]> {
  const res = await fetch(`${API_URL}/shop/products`);
  if (!res.ok) throw new Error(`GET /shop/products failed: ${res.status}`);
  const body = (await res.json()) as { products: Product[] };
  return body.products;
}

export async function fetchPixConfig(): Promise<PixConfig | null> {
  const res = await fetch(`${API_URL}/shop/pix`);
  if (!res.ok) throw new Error(`GET /shop/pix failed: ${res.status}`);
  const body = (await res.json()) as { config: PixConfig | null };
  return body.config;
}

export async function updatePixConfig(
  config: PixConfig,
  idToken: string,
): Promise<PixConfig> {
  const res = await fetch(`${API_URL}/shop/pix`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
    body: JSON.stringify(config),
  });
  if (!res.ok) throw new Error(`PUT /shop/pix failed: ${res.status}`);
  const body = (await res.json()) as { config: PixConfig };
  return body.config;
}

export async function createProduct(
  data: { emoji: string; name: string; description: string; price: number; imageUrl?: string | null },
  idToken: string,
): Promise<Product> {
  const res = await fetch(`${API_URL}/shop/products`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`POST /shop/products failed: ${res.status}`);
  const body = (await res.json()) as { product: Product };
  return body.product;
}

export async function importProductsCsv(
  csv: string,
  idToken: string,
): Promise<{ imported: number }> {
  const res = await fetch(`${API_URL}/shop/products/import`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
    body: JSON.stringify({ csv }),
  });
  if (!res.ok) throw new Error(`POST /shop/products/import failed: ${res.status}`);
  return (await res.json()) as { imported: number };
}

export async function reorderProducts(ids: string[], idToken: string): Promise<void> {
  const res = await fetch(`${API_URL}/shop/products/reorder`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
    body: JSON.stringify({ ids }),
  });
  if (!res.ok) throw new Error(`PUT /shop/products/reorder failed: ${res.status}`);
}

export async function deleteShopProduct(id: string, idToken: string): Promise<void> {
  const res = await fetch(`${API_URL}/shop/products/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${idToken}` },
  });
  if (!res.ok) throw new Error(`DELETE /shop/products/${id} failed: ${res.status}`);
}

// ── Users (admin) ──────────────────────────────────────────────────

export async function fetchUsers(idToken: string): Promise<User[]> {
  const res = await fetch(`${API_URL}/users`, {
    headers: { Authorization: `Bearer ${idToken}` },
  });
  if (!res.ok) throw new Error(`GET /users failed: ${res.status}`);
  const body = (await res.json()) as { users: User[] };
  return body.users;
}

export async function updateUserRole(
  userId: string,
  role: UserRole,
  idToken: string,
): Promise<void> {
  const res = await fetch(`${API_URL}/users/${encodeURIComponent(userId)}/role`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
    body: JSON.stringify({ role }),
  });
  if (!res.ok) throw new Error(`PUT /users/${userId}/role failed: ${res.status}`);
}

export interface RoleInvite {
  email: string;
  role: UserRole;
}

export async function fetchInvites(idToken: string): Promise<RoleInvite[]> {
  const res = await fetch(`${API_URL}/users/invites`, {
    headers: { Authorization: `Bearer ${idToken}` },
  });
  if (!res.ok) throw new Error(`GET /users/invites failed: ${res.status}`);
  const body = (await res.json()) as { invites: RoleInvite[] };
  return body.invites;
}

export async function createInvite(
  email: string,
  role: UserRole,
  idToken: string,
): Promise<void> {
  const res = await fetch(`${API_URL}/users/invites`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
    body: JSON.stringify({ email, role }),
  });
  if (!res.ok) throw new Error(`POST /users/invites failed: ${res.status}`);
}

export async function deleteInvite(email: string, idToken: string): Promise<void> {
  const res = await fetch(`${API_URL}/users/invites/${encodeURIComponent(email)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${idToken}` },
  });
  if (!res.ok) throw new Error(`DELETE /users/invites failed: ${res.status}`);
}

// ── Email / Newsletter ────────────────────────────────────────────────

export interface EmailLimits {
  dailyLimit: number;
  dailyRemaining: number;
  monthlyLimit: number;
  monthlyRemaining: number;
  maxGroupSize: number;
}

export async function fetchEmailLimits(idToken: string): Promise<EmailLimits> {
  const res = await fetch(`${API_URL}/email/limits`, {
    headers: { Authorization: `Bearer ${idToken}` },
  });
  if (!res.ok) throw new Error(`GET /email/limits failed: ${res.status}`);
  return (await res.json()) as EmailLimits;
}

export interface EmailConfig {
  autoEventEmail: boolean;
}

export async function fetchEmailConfig(idToken: string): Promise<EmailConfig> {
  const res = await fetch(`${API_URL}/email/config`, {
    headers: { Authorization: `Bearer ${idToken}` },
  });
  if (!res.ok) throw new Error(`GET /email/config failed: ${res.status}`);
  const body = (await res.json()) as { config: EmailConfig };
  return body.config;
}

export async function updateEmailConfig(
  config: Partial<EmailConfig>,
  idToken: string,
): Promise<void> {
  const res = await fetch(`${API_URL}/email/config`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
    body: JSON.stringify(config),
  });
  if (!res.ok) throw new Error(`PUT /email/config failed: ${res.status}`);
}

export interface UnsubscribedUser {
  id: string;
  email: string | null;
  displayName: string;
}

export async function fetchUnsubscribed(idToken: string): Promise<UnsubscribedUser[]> {
  const res = await fetch(`${API_URL}/email/unsubscribed`, {
    headers: { Authorization: `Bearer ${idToken}` },
  });
  if (!res.ok) throw new Error(`GET /email/unsubscribed failed: ${res.status}`);
  const body = (await res.json()) as { users: UnsubscribedUser[] };
  return body.users;
}

export async function resubscribeUser(userId: string, idToken: string): Promise<void> {
  const res = await fetch(`${API_URL}/email/resubscribe/${encodeURIComponent(userId)}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${idToken}` },
  });
  if (!res.ok) throw new Error(`POST /email/resubscribe failed: ${res.status}`);
}

export interface ContactGroup {
  id: string;
  name: string;
  description: string;
}

export async function fetchContactGroups(idToken: string): Promise<ContactGroup[]> {
  const res = await fetch(`${API_URL}/email/groups`, {
    headers: { Authorization: `Bearer ${idToken}` },
  });
  if (!res.ok) throw new Error(`GET /email/groups failed: ${res.status}`);
  const body = (await res.json()) as { groups: ContactGroup[] };
  return body.groups;
}

export async function createContactGroup(
  name: string,
  description: string,
  idToken: string,
): Promise<ContactGroup> {
  const res = await fetch(`${API_URL}/email/groups`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
    body: JSON.stringify({ name, description }),
  });
  if (!res.ok) throw new Error(`POST /email/groups failed: ${res.status}`);
  return (await res.json()) as ContactGroup;
}

export interface GroupMember {
  id: string;
  email: string | null;
  displayName: string;
}

export async function fetchGroupMembers(groupId: string, idToken: string): Promise<GroupMember[]> {
  const res = await fetch(`${API_URL}/email/groups/${encodeURIComponent(groupId)}/members`, {
    headers: { Authorization: `Bearer ${idToken}` },
  });
  if (!res.ok) throw new Error(`GET /email/groups/members failed: ${res.status}`);
  const body = (await res.json()) as { members: GroupMember[] };
  return body.members;
}

export async function addGroupMember(groupId: string, userId: string, idToken: string): Promise<void> {
  const res = await fetch(`${API_URL}/email/groups/${encodeURIComponent(groupId)}/members`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
    body: JSON.stringify({ userId }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { message?: string };
    throw new Error(body.message || `POST /email/groups/members failed: ${res.status}`);
  }
}

export async function removeGroupMember(groupId: string, userId: string, idToken: string): Promise<void> {
  const res = await fetch(
    `${API_URL}/email/groups/${encodeURIComponent(groupId)}/members/${encodeURIComponent(userId)}`,
    { method: 'DELETE', headers: { Authorization: `Bearer ${idToken}` } },
  );
  if (!res.ok) throw new Error(`DELETE /email/groups/members failed: ${res.status}`);
}

export async function deleteContactGroup(id: string, idToken: string): Promise<void> {
  const res = await fetch(`${API_URL}/email/groups/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${idToken}` },
  });
  if (!res.ok) throw new Error(`DELETE /email/groups failed: ${res.status}`);
}

export async function sendNewsletter(
  data: { subject: string; html: string; includeGroups: string[]; excludeGroups: string[] },
  idToken: string,
): Promise<{ sentCount: number }> {
  const res = await fetch(`${API_URL}/email/newsletter`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`POST /email/newsletter failed: ${res.status}`);
  return (await res.json()) as { sentCount: number };
}

export async function sendSingleEmail(
  data: { to: string; subject: string; html: string },
  idToken: string,
): Promise<void> {
  const res = await fetch(`${API_URL}/email/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`POST /email/send failed: ${res.status}`);
}

export interface EmailCampaign {
  id: string;
  subject: string;
  status: string;
  sentCount: number;
  sentAt: number;
  createdAt: number;
}

export async function fetchCampaigns(idToken: string): Promise<EmailCampaign[]> {
  const res = await fetch(`${API_URL}/email/campaigns`, {
    headers: { Authorization: `Bearer ${idToken}` },
  });
  if (!res.ok) throw new Error(`GET /email/campaigns failed: ${res.status}`);
  const body = (await res.json()) as { campaigns: EmailCampaign[] };
  return body.campaigns;
}

export async function updateUserGroups(
  userId: string,
  groups: string[],
  idToken: string,
): Promise<void> {
  const res = await fetch(`${API_URL}/email/users/${encodeURIComponent(userId)}/groups`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
    body: JSON.stringify({ groups }),
  });
  if (!res.ok) throw new Error(`PUT /email/users/groups failed: ${res.status}`);
}

export async function updateUserNewsletter(
  userId: string,
  optIn: boolean,
  idToken: string,
): Promise<void> {
  const res = await fetch(`${API_URL}/email/users/${encodeURIComponent(userId)}/newsletter`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
    body: JSON.stringify({ optIn }),
  });
  if (!res.ok) throw new Error(`PUT /email/users/newsletter failed: ${res.status}`);
}

// ── Email Templates ───────────────────────────────────────────────────

export async function fetchEmailTemplates(idToken: string): Promise<EmailTemplate[]> {
  const res = await fetch(`${API_URL}/email/templates`, {
    headers: { Authorization: `Bearer ${idToken}` },
  });
  if (!res.ok) throw new Error(`GET /email/templates failed: ${res.status}`);
  const body = (await res.json()) as { templates: EmailTemplate[] };
  return body.templates;
}

export async function updateEmailTemplate(
  key: string,
  data: { enabled?: boolean; subject?: string; body?: string },
  idToken: string,
): Promise<EmailTemplate> {
  const res = await fetch(`${API_URL}/email/templates/${encodeURIComponent(key)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`PUT /email/templates/${key} failed: ${res.status}`);
  const body = (await res.json()) as { template: EmailTemplate };
  return body.template;
}

export async function restoreEmailTemplate(
  key: string,
  idToken: string,
): Promise<EmailTemplate> {
  const res = await fetch(`${API_URL}/email/templates/${encodeURIComponent(key)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${idToken}` },
  });
  if (!res.ok) throw new Error(`DELETE /email/templates/${key} failed: ${res.status}`);
  const body = (await res.json()) as { template: EmailTemplate };
  return body.template;
}

// ── LinkTree ──────────────────────────────────────────────────────────

export async function fetchLinkTree(): Promise<LinkTreeItem[]> {
  const res = await fetch(`${API_URL}/linktree`);
  if (!res.ok) throw new Error(`GET /linktree failed: ${res.status}`);
  const body = (await res.json()) as { links: LinkTreeItem[] };
  return body.links;
}

export async function fetchAllLinks(idToken: string): Promise<LinkTreeItem[]> {
  const res = await fetch(`${API_URL}/linktree/all`, {
    headers: { Authorization: `Bearer ${idToken}` },
  });
  if (!res.ok) throw new Error(`GET /linktree/all failed: ${res.status}`);
  const body = (await res.json()) as { links: LinkTreeItem[] };
  return body.links;
}

export async function createLink(
  data: { title: string; url: string; emoji?: string },
  idToken: string,
): Promise<LinkTreeItem> {
  const res = await fetch(`${API_URL}/linktree`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`POST /linktree failed: ${res.status}`);
  const body = (await res.json()) as { link: LinkTreeItem };
  return body.link;
}

export async function updateLink(
  id: string,
  data: { title?: string; url?: string; emoji?: string; active?: boolean },
  idToken: string,
): Promise<LinkTreeItem> {
  const res = await fetch(`${API_URL}/linktree/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`PUT /linktree/${id} failed: ${res.status}`);
  const body = (await res.json()) as { link: LinkTreeItem };
  return body.link;
}

export async function deleteLink(id: string, idToken: string): Promise<void> {
  const res = await fetch(`${API_URL}/linktree/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${idToken}` },
  });
  if (!res.ok) throw new Error(`DELETE /linktree/${id} failed: ${res.status}`);
}

export async function reorderLinks(ids: string[], idToken: string): Promise<void> {
  const res = await fetch(`${API_URL}/linktree/reorder`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
    body: JSON.stringify({ ids }),
  });
  if (!res.ok) throw new Error(`PUT /linktree/reorder failed: ${res.status}`);
}

// ── Banners ──────────────────────────────────────────────────────────

export async function uploadBannerImage(file: File, idToken: string): Promise<string> {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(`${API_URL}/banners/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${idToken}` },
    body: form,
  });
  if (!res.ok) throw new Error(`POST /banners/upload failed: ${res.status}`);
  const body = (await res.json()) as { imageUrl: string };
  return body.imageUrl;
}

export async function fetchActiveBanner(): Promise<Banner | null> {
  const res = await fetch(`${API_URL}/banners/active`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GET /banners/active failed: ${res.status}`);
  const body = (await res.json()) as { banner: Banner };
  return body.banner;
}

export async function fetchAllBanners(idToken: string): Promise<Banner[]> {
  const res = await fetch(`${API_URL}/banners/all`, {
    headers: { Authorization: `Bearer ${idToken}` },
  });
  if (!res.ok) throw new Error(`GET /banners/all failed: ${res.status}`);
  const body = (await res.json()) as { banners: Banner[] };
  return body.banners;
}

export async function createBanner(
  data: { imageUrl: string; altText: string; link?: string; routes?: BannerRoute[]; autoDismissSeconds?: number | null },
  idToken: string,
): Promise<Banner> {
  const res = await fetch(`${API_URL}/banners`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`POST /banners failed: ${res.status}`);
  const body = (await res.json()) as { banner: Banner };
  return body.banner;
}

export async function updateBanner(
  id: string,
  data: { imageUrl?: string; altText?: string; link?: string | null; routes?: BannerRoute[]; autoDismissSeconds?: number | null },
  idToken: string,
): Promise<Banner> {
  const res = await fetch(`${API_URL}/banners/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`PUT /banners/${id} failed: ${res.status}`);
  const body = (await res.json()) as { banner: Banner };
  return body.banner;
}

export async function activateBanner(id: string, idToken: string): Promise<void> {
  const res = await fetch(`${API_URL}/banners/${encodeURIComponent(id)}/activate`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${idToken}` },
  });
  if (!res.ok) throw new Error(`PUT /banners/${id}/activate failed: ${res.status}`);
}

export async function deactivateBanner(id: string, idToken: string): Promise<void> {
  const res = await fetch(`${API_URL}/banners/${encodeURIComponent(id)}/deactivate`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${idToken}` },
  });
  if (!res.ok) throw new Error(`PUT /banners/${id}/deactivate failed: ${res.status}`);
}

export async function deleteBanner(id: string, idToken: string): Promise<void> {
  const res = await fetch(`${API_URL}/banners/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${idToken}` },
  });
  if (!res.ok) throw new Error(`DELETE /banners/${id} failed: ${res.status}`);
}

export async function dismissBannerServer(bannerId: string, bannerVersion: number, idToken: string): Promise<void> {
  const res = await fetch(`${API_URL}/banners/dismiss`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
    body: JSON.stringify({ bannerId, bannerVersion }),
  });
  if (!res.ok) throw new Error(`POST /banners/dismiss failed: ${res.status}`);
}

export async function checkBannerDismissal(bannerId: string, version: number, idToken: string): Promise<boolean> {
  const res = await fetch(`${API_URL}/banners/dismissal?bannerId=${encodeURIComponent(bannerId)}&version=${version}`, {
    headers: { Authorization: `Bearer ${idToken}` },
  });
  if (!res.ok) return false;
  const body = (await res.json()) as { dismissed: boolean };
  return body.dismissed;
}

// ── RSVP ────────────────────────────────────────────────────────────

export async function fetchRsvpSummary(eventId: string): Promise<RsvpSummary> {
  const res = await fetch(`${API_URL}/events/${encodeURIComponent(eventId)}/rsvp`);
  if (!res.ok) throw new Error(`GET rsvp summary failed: ${res.status}`);
  return (await res.json()) as RsvpSummary;
}

export async function fetchUserRsvp(
  eventId: string,
  idToken: string | null,
): Promise<RsvpEntry | null> {
  if (!idToken) return null;
  const res = await fetch(
    `${API_URL}/events/${encodeURIComponent(eventId)}/rsvp/user`,
    { headers: { Authorization: `Bearer ${idToken}` } },
  );
  if (!res.ok) throw new Error(`GET rsvp user failed: ${res.status}`);
  const body = (await res.json()) as { entry: RsvpEntry | null };
  return body.entry;
}

export async function submitRsvp(
  eventId: string,
  idToken: string,
  opts?: { plusOne?: boolean; plusOneName?: string },
): Promise<{ entry: RsvpEntry }> {
  const res = await fetch(`${API_URL}/events/${encodeURIComponent(eventId)}/rsvp`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify(opts ?? {}),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `POST rsvp failed: ${res.status}`);
  }
  return (await res.json()) as { entry: RsvpEntry };
}

export async function cancelRsvp(
  eventId: string,
  idToken: string,
): Promise<{ promotedUserId: string | null }> {
  const res = await fetch(`${API_URL}/events/${encodeURIComponent(eventId)}/rsvp`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${idToken}` },
  });
  if (!res.ok) throw new Error(`DELETE rsvp failed: ${res.status}`);
  return (await res.json()) as { promotedUserId: string | null };
}

export async function updateRsvpPlusOne(
  eventId: string,
  idToken: string,
  plusOne: boolean,
  plusOneName: string | null,
): Promise<{ entry: RsvpEntry }> {
  const res = await fetch(`${API_URL}/events/${encodeURIComponent(eventId)}/rsvp/plus-one`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({ plusOne, plusOneName }),
  });
  if (!res.ok) throw new Error(`PUT rsvp plus-one failed: ${res.status}`);
  return (await res.json()) as { entry: RsvpEntry };
}

// ── RSVP Admin ───────────────────────────────────────────────────────

export async function fetchAdminRsvpList(
  eventId: string,
  idToken: string,
): Promise<{ entries: AdminRsvpEntry[] }> {
  const res = await fetch(
    `${API_URL}/events/${encodeURIComponent(eventId)}/rsvp/admin`,
    { headers: { Authorization: `Bearer ${idToken}` } },
  );
  if (!res.ok) throw new Error(`GET rsvp/admin failed: ${res.status}`);
  return (await res.json()) as { entries: AdminRsvpEntry[] };
}

export async function approveRejectRsvp(
  eventId: string,
  userId: string,
  status: 'confirmed' | 'rejected',
  idToken: string,
): Promise<{ entry: RsvpEntry }> {
  const res = await fetch(
    `${API_URL}/events/${encodeURIComponent(eventId)}/rsvp/admin/${encodeURIComponent(userId)}`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
      body: JSON.stringify({ status }),
    },
  );
  if (!res.ok) throw new Error(`PUT rsvp/admin/${userId} failed: ${res.status}`);
  return (await res.json()) as { entry: RsvpEntry };
}

export async function exportRsvpCsv(
  eventId: string,
  idToken: string,
): Promise<string> {
  const res = await fetch(
    `${API_URL}/events/${encodeURIComponent(eventId)}/rsvp/admin/export`,
    { headers: { Authorization: `Bearer ${idToken}` } },
  );
  if (!res.ok) throw new Error(`GET rsvp/admin/export failed: ${res.status}`);
  return res.text();
}
