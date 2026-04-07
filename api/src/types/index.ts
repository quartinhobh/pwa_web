// Quartinho core domain types — source of truth.
// Owner: architect. Never edited by builder or UI-zine.

export type UserRole = 'guest' | 'user' | 'moderator' | 'admin';

export type SocialPlatform = 'instagram' | 'spotify' | 'twitter' | 'lastfm' | 'letterboxd';

export interface SocialLink {
  platform: SocialPlatform;
  url: string;
}

export interface FavoriteAlbum {
  mbId: string;
  title: string;
  artistCredit: string;
  coverUrl: string | null;
}

export interface User {
  id: string;
  email: string | null;
  displayName: string;
  username: string | null;
  role: UserRole;
  linkedSessionId: string | null;
  avatarUrl: string | null;
  bio: string | null;
  socialLinks: SocialLink[];
  favoriteAlbums: FavoriteAlbum[];
  newsletterOptIn?: boolean;
  groups?: string[];
  createdAt: number;
  updatedAt: number;
}

export type SessionType = 'anonymous' | 'authenticated';

export interface Session {
  id: string;
  userId: string | null;
  type: SessionType;
  guestName: string;
  createdAt: number;
  lastActiveAt: number;
}

export type EventStatus = 'upcoming' | 'live' | 'archived';

export interface EventExtraLink {
  label: string;
  url: string;
}

export interface EventExtras {
  text: string;
  links: EventExtraLink[];
  images: string[];
}

/** Snapshot of MusicBrainz data stored at event creation — never re-fetched. */
export interface EventAlbumSnapshot {
  albumTitle: string;
  artistCredit: string;
  coverUrl: string | null;
  coverBlurDataUrl: string | null;
  tracks: MusicBrainzTrack[];
}

export interface Event {
  id: string;
  mbAlbumId: string;
  title: string;
  date: string; // ISO date
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  location: string | null; // venue / address
  status: EventStatus;
  album: EventAlbumSnapshot | null; // populated on create, avoids MB re-fetch
  extras: EventExtras;
  spotifyPlaylistUrl: string | null;
  createdBy: string;
  createdAt: number;
  updatedAt: number;
}

export interface VoteTally {
  count: number;
  voters: string[];
}

export interface VoterRecord {
  trackId: string;
  updatedAt: number;
}

export interface VoteRecord {
  eventId: string;
  favorites: Record<string, VoteTally>;
  leastLiked: Record<string, VoteTally>;
  voters: Record<string, VoterRecord>;
  updatedAt: number;
}

// ── P3-D Voting contract ───────────────────────────────────────────────

export interface VoteSubmission {
  eventId: string;
  favoriteTrackId: string;
  leastLikedTrackId: string;
}

export interface VoteBucket {
  count: number;
  voterIds: string[];
}

export interface VoteTallies {
  favorites: Record<string, VoteBucket>;
  leastLiked: Record<string, VoteBucket>;
  updatedAt: number;
}

export interface UserVote {
  favoriteTrackId: string;
  leastLikedTrackId: string;
  updatedAt: number;
}

export interface ChatMessage {
  uid: string;
  displayName: string;
  avatarUrl?: string | null;
  text: string;
  timestamp: number;
  isDeleted: boolean;
}

export type LyricsSource = 'lyrics.ovh' | 'lrclib';

export interface LyricsCache {
  id: string;
  trackId: string;
  trackTitle: string;
  artistName: string;
  lyrics: string;
  source: LyricsSource;
  cachedAt: number;
  expiresAt: number;
}

export interface Ban {
  userId: string;
  bannedBy: string;
  reason: string | null;
  createdAt: number;
  expiresAt: number | null;
}

export type ModerationAction = 'delete_message' | 'ban_user' | 'unban_user';

export interface ModerationLog {
  id: string;
  eventId: string | null;
  action: ModerationAction;
  targetUserId: string;
  performedBy: string;
  messageId: string | null;
  reason: string | null;
  createdAt: number;
}

export interface EventPhoto {
  id: string;
  url: string;
  uploadedBy: string;
  createdAt: number;
}

// ── P3-G Photos ────────────────────────────────────────────────────────

export type PhotoCategory = 'category1' | 'category2';

export interface Photo {
  id: string;
  url: string;
  category: PhotoCategory;
  uploadedBy: string;
  createdAt: number;
}

export interface PhotoUploadPayload {
  category: PhotoCategory;
  file: Buffer;
  mimeType: string;
}

export interface EventCreatePayload {
  mbAlbumId: string;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  location: string | null;
  extras: EventExtras;
  spotifyPlaylistUrl: string | null;
}

export interface MusicBrainzTrack {
  id: string;
  title: string;
  position: number;
  length: number; // ms
}

export interface MusicBrainzRelease {
  id: string;
  title: string;
  artistCredit: string;
  date: string;
  tracks: MusicBrainzTrack[];
}

// ── Lojinha / PIX ─────────────────────────────────────────────────────

export interface PixConfig {
  key: string;
  beneficiary: string;
  city: string;
}

export interface Product {
  id: string;
  emoji: string;
  name: string;
  description: string;
  price: number; // centavos (R$ 25,00 = 2500)
  imageUrl: string | null;
  active: boolean;
  sortOrder: number;
  createdAt: number;
  updatedAt: number;
}

// ── LinkTree ─────────────────────────────────────────────────────────

export interface LinkTreeItem {
  id: string;
  title: string;
  url: string;
  emoji: string;
  sortOrder: number;
  active: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface ApiResponse<T> {
  data: T;
  error?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}
