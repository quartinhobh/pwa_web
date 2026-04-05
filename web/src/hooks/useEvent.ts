import { useEffect, useState } from 'react';
import {
  fetchCurrentEvent,
  fetchEventById,
  fetchMusicBrainzAlbum,
  fetchMusicBrainzTracks,
} from '@/services/api';
import type { Event, MusicBrainzRelease, MusicBrainzTrack } from '@/types';

export interface UseEventResult {
  event: Event | null;
  album: MusicBrainzRelease | null;
  tracks: MusicBrainzTrack[];
  loading: boolean;
  error: string | null;
}

/**
 * useEvent — loads an event (by id, or current if id is null) and its
 * MusicBrainz album + tracks via the api proxy.
 */
export function useEvent(eventId: string | null): UseEventResult {
  const [event, setEvent] = useState<Event | null>(null);
  const [album, setAlbum] = useState<MusicBrainzRelease | null>(null);
  const [tracks, setTracks] = useState<MusicBrainzTrack[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const run = async () => {
      try {
        const ev = eventId
          ? await fetchEventById(eventId)
          : await fetchCurrentEvent();
        if (cancelled) return;
        setEvent(ev);

        if (!ev) {
          setAlbum(null);
          setTracks([]);
          return;
        }

        const [alb, trks] = await Promise.all([
          fetchMusicBrainzAlbum(ev.mbAlbumId),
          fetchMusicBrainzTracks(ev.mbAlbumId),
        ]);
        if (cancelled) return;
        setAlbum(alb);
        setTracks(trks.length > 0 ? trks : alb.tracks);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'unknown_error');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [eventId]);

  return { event, album, tracks, loading, error };
}
