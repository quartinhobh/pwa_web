// Web-side domain types. Mirror of api/src/types/index.ts plus frontend-only shapes.
// Owner: architect. No shared package yet — duplicated intentionally until Turborepo
// shared package is introduced in a later phase.

export type EmailTemplateKey = 'confirmation' | 'waitlist' | 'promotion' | 'reminder' | 'venue_reveal' | 'rejected';

export interface EmailTemplate {
  key: EmailTemplateKey;
  enabled: boolean;
  subject: string;
  body: string;
  updatedAt: number;
  updatedBy: string;
}

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
  date: string;
  startTime: string;
  endTime: string;
  location: string | null;
  status: EventStatus;
  album: EventAlbumSnapshot | null;
  extras: EventExtras;
  spotifyPlaylistUrl: string | null;
  rsvp?: RsvpConfig;
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

// ── RSVP ────────────────────────────────────────────────────────────

export type RsvpApprovalMode = 'auto' | 'manual';

export interface RsvpConfig {
  enabled: boolean;
  capacity: number | null;
  waitlistEnabled: boolean;
  plusOneAllowed: boolean;
  approvalMode: RsvpApprovalMode;
  opensAt: number | null;
  closesAt: number | null;
}

export type RsvpStatus = 'confirmed' | 'waitlisted' | 'pending_approval' | 'cancelled' | 'rejected';

export interface RsvpEntry {
  status: RsvpStatus;
  plusOne: boolean;
  plusOneName: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface AdminRsvpEntry extends RsvpEntry {
  userId: string;
  displayName: string;
  email: string | null;
  avatarUrl: string | null;
}

export interface RsvpSummary {
  confirmedCount: number;
  waitlistCount: number;
  capacity: number | null;
  confirmedAvatars: { id: string; displayName: string; avatarUrl: string | null }[];
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
  price: number;
  imageUrl: string | null;
  active: boolean;
  createdAt: number;
  updatedAt: number;
}

// ── Banners ──────────────────────────────────────────────────────────

export type BannerRoute = 'home' | 'profile' | 'lojinha' | 'chat';

export interface Banner {
  id: string;
  imageUrl: string;
  link: string | null;
  altText: string;
  isActive: boolean;
  routes: BannerRoute[];
  autoDismissSeconds: number | null;
  reappearAfterDismissMs: number | null;
  version: number;
  createdAt: number;
  updatedAt: number;
}

// ── Sticker config ───────────────────────────────────────────────────

export interface StickerConfig {
  enabled: boolean;
  maxConcurrent: number;
  spawnMinSeconds: number;
  spawnMaxSeconds: number;
  maxBeforeCooldown: number;
  cooldownHours: number;
  enabledAssets: string[];
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
  file: File;
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

// ── Frontend-only shapes ───────────────────────────────────────────────

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
