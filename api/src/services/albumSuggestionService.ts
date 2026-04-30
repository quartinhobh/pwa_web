import { randomUUID } from 'node:crypto';
import { adminDb } from '../config/firebase';
import type { AlbumSuggestion, SuggestionStatus, CreateAlbumSuggestionPayload } from '../types';

const COLLECTION = 'albumSuggestions';

/**
 * List album suggestions, optionally filtered by status.
 * If status is omitted, returns all. Always ordered by createdAt DESC.
 * Admin-only usage.
 */
export async function listAlbumSuggestions(status?: SuggestionStatus): Promise<AlbumSuggestion[]> {
  const col = adminDb.collection(COLLECTION);
  const query = status
    ? col.where('status', '==', status).orderBy('createdAt', 'desc')
    : col.orderBy('createdAt', 'desc');

  const snap = await query.get();
  return snap.docs.map((doc) => doc.data() as AlbumSuggestion);
}

/**
 * Create a new album suggestion. Public — uid/email null when anonymous.
 * Sets status = 'suggested', createdAt and updatedAt = Date.now().
 * At least one of mbid, spotifyUrl, youtubeUrl, or albumTitle must be present.
 */
export async function createAlbumSuggestion(
  uid: string | null,
  email: string | null,
  payload: CreateAlbumSuggestionPayload,
): Promise<AlbumSuggestion> {
  const mbid = payload.mbid?.trim() || null;
  const albumTitle = payload.albumTitle?.trim() || null;
  const artistName = payload.artistName?.trim() || null;
  const spotifyUrl = normalizeSpotifyUrl(payload.spotifyUrl?.trim() || null);
  const youtubeUrl = payload.youtubeUrl?.trim() || null;
  const rawNotes = payload.notes?.trim() || null;
  const notes = rawNotes && rawNotes.length > 500 ? rawNotes.slice(0, 500) : rawNotes;

  // At least one identifier required
  if (!mbid && !albumTitle && !spotifyUrl && !youtubeUrl) {
    throw new Error('payload_required');
  }

  // Validate Spotify URL
  if (spotifyUrl && !spotifyUrl.includes('spotify.com')) {
    throw new Error('invalid_spotify_url');
  }

  // Validate YouTube URL
  if (youtubeUrl && !youtubeUrl.includes('youtube.com') && !youtubeUrl.includes('youtu.be')) {
    throw new Error('invalid_youtube_url');
  }

  // Derive coverUrl from mbid via Cover Art Archive (no fetch — frontend renders directly)
  const coverUrl = mbid ? `https://coverartarchive.org/release/${mbid}/front-250` : null;

  // Dedup: find existing suggestion with same identifier (precedence: mbid → spotify → youtube → title+artist)
  const existing = await findDuplicate({ mbid, spotifyUrl, youtubeUrl, albumTitle, artistName });
  if (existing) {
    const now = Date.now();
    await adminDb.collection(COLLECTION).doc(existing.id).update({
      suggestionCount: (existing.suggestionCount ?? 1) + 1,
      updatedAt: now,
    });
    return { ...existing, suggestionCount: (existing.suggestionCount ?? 1) + 1, updatedAt: now };
  }

  const now = Date.now();
  const id = randomUUID();

  const suggestion: AlbumSuggestion = {
    id,
    status: 'suggested',
    suggestedByUid: uid,
    suggestedByEmail: email,
    suggestionCount: 1,
    createdAt: now,
    updatedAt: now,
    mbid,
    albumTitle,
    artistName,
    coverUrl,
    spotifyUrl,
    youtubeUrl,
    notes,
    instagramLink: null,
  };

  await adminDb.collection(COLLECTION).doc(id).set(suggestion);
  return suggestion;
}

function normalizeSpotifyUrl(url: string | null): string | null {
  if (!url) return null;
  // Spotify URLs put the resource id in the path (/album/{id}); query string is just
  // tracking (?si=, ?utm_=) — strip it for robust dedup.
  return url.split('?')[0]!.replace(/\/+$/, '');
}

async function findDuplicate(params: {
  mbid: string | null;
  spotifyUrl: string | null;
  youtubeUrl: string | null;
  albumTitle: string | null;
  artistName: string | null;
}): Promise<AlbumSuggestion | null> {
  const col = adminDb.collection(COLLECTION);

  if (params.mbid) {
    const snap = await col.where('mbid', '==', params.mbid).limit(1).get();
    if (!snap.empty) return snap.docs[0]!.data() as AlbumSuggestion;
  }
  if (params.spotifyUrl) {
    const snap = await col.where('spotifyUrl', '==', params.spotifyUrl).limit(1).get();
    if (!snap.empty) return snap.docs[0]!.data() as AlbumSuggestion;
  }
  if (params.youtubeUrl) {
    const snap = await col.where('youtubeUrl', '==', params.youtubeUrl).limit(1).get();
    if (!snap.empty) return snap.docs[0]!.data() as AlbumSuggestion;
  }
  if (params.albumTitle && params.artistName) {
    // Case-insensitive match: store/query lowercased equivalents would be ideal,
    // but for simplicity scan the title-only matches and filter in-memory.
    const snap = await col.where('albumTitle', '==', params.albumTitle).get();
    const target = params.artistName.toLowerCase().trim();
    const match = snap.docs.find((d) => {
      const data = d.data() as AlbumSuggestion;
      return (data.artistName?.toLowerCase().trim() ?? '') === target;
    });
    if (match) return match.data() as AlbumSuggestion;
  }
  return null;
}

/**
 * Update status of an album suggestion.
 * Throws Error('not_found') if document does not exist.
 */
export async function updateAlbumSuggestionStatus(id: string, status: SuggestionStatus): Promise<void> {
  const ref = adminDb.collection(COLLECTION).doc(id);
  const snap = await ref.get();
  if (!snap.exists) throw new Error('not_found');
  await ref.update({ status, updatedAt: Date.now() });
}

/**
 * Get a single album suggestion by id. Returns null when not found.
 */
export async function getAlbumSuggestionById(
  id: string,
): Promise<AlbumSuggestion | null> {
  const snap = await adminDb.collection(COLLECTION).doc(id).get();
  if (!snap.exists) return null;
  return snap.data() as AlbumSuggestion;
}

/**
 * Persist a resolved MB lookup on a suggestion. Called after a confident
 * match so subsequent reads can skip the lookup roundtrip.
 * Throws Error('not_found') if document does not exist.
 */
export async function enrichWithCover(
  id: string,
  mbid: string,
  coverUrl: string,
): Promise<void> {
  const ref = adminDb.collection(COLLECTION).doc(id);
  const snap = await ref.get();
  if (!snap.exists) throw new Error('not_found');
  await ref.update({ mbid, coverUrl, updatedAt: Date.now() });
}

/**
 * Delete an album suggestion.
 * Throws Error('not_found') if document does not exist.
 */
export async function deleteAlbumSuggestion(id: string): Promise<void> {
  const ref = adminDb.collection(COLLECTION).doc(id);
  const snap = await ref.get();
  if (!snap.exists) throw new Error('not_found');
  await ref.delete();
}
