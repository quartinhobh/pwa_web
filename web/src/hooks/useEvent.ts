import { useEffect, useState } from 'react';
import {
  fetchCurrentEvent,
  fetchEventById,
  fetchMusicBrainzAlbum,
  fetchMusicBrainzTracks,
} from '@/services/api';
import { useApiCache } from '@/store/apiCache';
import type { Event, MusicBrainzRelease, MusicBrainzTrack } from '@/types';

export interface UseEventResult {
  event: Event | null;
  album: MusicBrainzRelease | null;
  tracks: MusicBrainzTrack[];
  loading: boolean;
  error: string | null;
}

function buildEventCacheKey(eventId: string | null): string {
  return eventId ? `event:${eventId}` : 'event:current';
}

interface CachedEventData {
  event: Event | null;
  album: MusicBrainzRelease | null;
  tracks: MusicBrainzTrack[];
}

async function fetchEventData(
  eventId: string | null,
): Promise<CachedEventData> {
  const ev = eventId ? await fetchEventById(eventId) : await fetchCurrentEvent();

  let alb: MusicBrainzRelease | null = null;
  let trks: MusicBrainzTrack[] = [];

  if (ev?.album) {
    alb = {
      id: ev.mbAlbumId,
      title: ev.album.albumTitle,
      artistCredit: ev.album.artistCredit,
      date: ev.date,
      tracks: ev.album.tracks,
    };
    trks = ev.album.tracks;
  } else if (ev) {
    const [albumData, tracksData] = await Promise.all([
      fetchMusicBrainzAlbum(ev.mbAlbumId),
      fetchMusicBrainzTracks(ev.mbAlbumId),
    ]);
    alb = albumData;
    trks = tracksData.length > 0 ? tracksData : albumData.tracks;
  }

  return { event: ev, album: alb, tracks: trks };
}

export function useEvent(eventId: string | null): UseEventResult {
  const cacheKey = buildEventCacheKey(eventId);

  const cached = useApiCache.getState().get<CachedEventData>(cacheKey);
  const [data, setData] = useState<CachedEventData | null>(cached ?? null);
  const [loading, setLoading] = useState(!cached);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        const result = await fetchEventData(eventId);
        if (cancelled) return;
        useApiCache.getState().set(cacheKey, result);
        setData(result);
        setLoading(false);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'unknown_error');
        setLoading(false);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [eventId, cacheKey]);

  return {
    event: data?.event ?? null,
    album: data?.album ?? null,
    tracks: data?.tracks ?? [],
    loading,
    error,
  };
}
