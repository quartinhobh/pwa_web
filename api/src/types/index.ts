// Quartinho core domain types — source of truth.
// Owner: architect. Never edited by builder or UI-zine.

export type UserRole = 'guest' | 'user' | 'moderator' | 'admin';

export interface User {
  id: string;
  email: string | null;
  displayName: string;
  role: UserRole;
  linkedSessionId: string | null;
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

export interface Event {
  id: string;
  mbAlbumId: string;
  title: string;
  date: string; // ISO date
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  status: EventStatus;
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

export interface ChatMessage {
  uid: string;
  displayName: string;
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
  reason: string;
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
