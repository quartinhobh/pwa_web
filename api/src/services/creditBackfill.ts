import { adminDb } from '../config/firebase';
import type { AggregatedCredits, Event, MusicBrainzTrack } from '../types';
import { searchGeniusTracks } from './geniusService';
import { fetchLyrics } from './lyricsService';
import { fetchCredits } from './musicbrainzService';

const EVENTS = 'events';

export interface CreditBackfillReport {
  eventId: string;
  creditsAttempted: boolean;
  tracksCount: number;
  creditsCount: number;
  lyricsWarmed: boolean;
  error?: string;
}

function countCredits(credits?: AggregatedCredits): number {
  return (credits?.performers.length ?? 0) + (credits?.trackWorks.length ?? 0);
}

async function warmLyricsCache(tracks: { title: string }[], artist: string): Promise<boolean> {
  if (!artist || tracks.length === 0) return false;
  await Promise.allSettled(
    tracks.map((track) => fetchLyrics(artist, track.title, { skipCache: true })),
  );
  return true;
}

function reportFor(
  eventId: string,
  creditsAttempted: boolean,
  tracks: MusicBrainzTrack[],
  credits?: AggregatedCredits,
  lyricsWarmed = false,
  error?: string,
): CreditBackfillReport {
  return {
    eventId,
    creditsAttempted,
    tracksCount: tracks.length,
    creditsCount: countCredits(credits),
    lyricsWarmed,
    ...(error ? { error } : {}),
  };
}

export async function backfillEventCredits(
  eventId: string,
  opts?: { await?: boolean; logger?: (event: string, payload?: unknown) => void },
): Promise<CreditBackfillReport> {
  const ref = adminDb.collection(EVENTS).doc(eventId);
  const snap = await ref.get();
  if (!snap.exists) return reportFor(eventId, false, [], undefined, false, 'event_not_found');

  const event = snap.data() as Event;
  const album = event.album;
  if (!album || !event.mbAlbumId) {
    return reportFor(eventId, false, album?.tracks ?? [], album?.credits, false, 'event_not_found_or_no_mbid');
  }
  if (album.credits || album.creditsAttempted) {
    return reportFor(eventId, !!album.creditsAttempted, album.tracks, album.credits);
  }

  let credits: AggregatedCredits | undefined;
  let tracks: MusicBrainzTrack[] = [];
  let error: string | undefined;

  try {
    const result = await fetchCredits(event.mbAlbumId);
    credits = result.credits;
    tracks = result.tracks;

    if (tracks.length === 0 && album.artistCredit) {
      try {
        const geniusTracks = await searchGeniusTracks(album.artistCredit, album.albumTitle);
        if (geniusTracks.length > 0) tracks = geniusTracks;
      } catch (err) {
        opts?.logger?.('backfill_genius_error', { eventId, err: String(err) });
      }
    }

    await ref.update({
      'album.credits': credits,
      'album.tracks': tracks,
      'album.creditsAttempted': true,
    });
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
    opts?.logger?.('backfill_credits_error', { eventId, err: error });

    if (album.artistCredit) {
      try {
        const geniusTracks = await searchGeniusTracks(album.artistCredit, album.albumTitle);
        if (geniusTracks.length > 0) {
          tracks = geniusTracks;
          await ref.update({ 'album.tracks': tracks, 'album.creditsAttempted': true });
          const lyricsWarmed = await warmLyricsCache(tracks, album.artistCredit);
          return reportFor(eventId, true, tracks, undefined, lyricsWarmed, error);
        }
      } catch (geniusError) {
        opts?.logger?.('backfill_genius_error', { eventId, err: String(geniusError) });
      }
    }

    await ref.update({ 'album.creditsAttempted': true });
    return reportFor(eventId, true, tracks, undefined, false, error);
  }

  const lyricsWarmed = await warmLyricsCache(tracks, album.artistCredit);
  return reportFor(eventId, true, tracks, credits, lyricsWarmed);
}
