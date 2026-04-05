import React from 'react';
import { useEvent } from '@/hooks/useEvent';
import { useLyrics } from '@/hooks/useLyrics';
import { AlbumDisplay } from '@/components/events/AlbumDisplay';
import { TrackList } from '@/components/events/TrackList';
import { LyricsDisplay } from '@/components/events/LyricsDisplay';

/**
 * Listen — primary listening page. Loads the current event and its
 * MusicBrainz album + tracks, then composes AlbumDisplay + TrackList +
 * LyricsDisplay. For MVP the lyrics are shown for the first track; track
 * selection UX lands in a later phase.
 */
export const Listen: React.FC = () => {
  const { event, album, tracks, loading, error } = useEvent(null);
  const firstTrack = tracks[0] ?? null;
  const { lyrics, loading: lyricsLoading } = useLyrics(
    album?.artistCredit ?? null,
    firstTrack?.title ?? null,
  );

  if (loading) {
    return (
      <main className="font-body text-zine-burntOrange p-4">loading...</main>
    );
  }

  if (error) {
    return (
      <main className="font-body text-zine-burntOrange p-4">
        error: {error}
      </main>
    );
  }

  if (!event) {
    return (
      <main className="font-body text-zine-burntOrange p-4">
        no current event
      </main>
    );
  }

  return (
    <main className="flex flex-col gap-4 p-4">
      <AlbumDisplay event={event} album={album} />
      <TrackList tracks={tracks} />
      <LyricsDisplay lyrics={lyrics} loading={lyricsLoading} />
    </main>
  );
};

export default Listen;
