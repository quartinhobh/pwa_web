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

export function useEvent(eventId: string | null): UseEventResult {
  const cache = useApiCache();
  const cacheKey = buildEventCacheKey(eventId);

  const [data, setData] = useState<CachedEventData | null>(() => {
    return cache.get<CachedEventData>(cacheKey) ?? null;
  });
  const [loading, setLoading] = useState(!data);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const cached = cache.get<CachedEventData>(cacheKey);
    if (cached) {
      setData(cached);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const run = async () => {
      try {
        const ev = eventId
          ? await fetchEventById(eventId)
          : await fetchCurrentEvent();
        if (cancelled) return;

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

        const result = { event: ev, album: alb, tracks: trks };
        cache.set(cacheKey, result);
        if (!cancelled) {
          setData(result);
          setLoading(false);
        }
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
  }, [eventId, cache, cacheKey]);

  if (loading && !data) {
    return { event: null, album: null, tracks: [], loading: true, error: null };
  }

  return {
    event: data?.event ?? null,
    album: data?.album ?? null,
    tracks: data?.tracks ?? [],
    loading,
    error,
  };
}
