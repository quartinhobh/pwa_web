import React from 'react';
import { useEvent } from '@/hooks/useEvent';
import { AlbumDisplay } from '@/components/events/AlbumDisplay';
import { TrackList } from '@/components/events/TrackList';

/**
 * Listen — primary listening page. Loads the current event and its
 * MusicBrainz album + tracks, then composes AlbumDisplay + TrackList.
 */
export const Listen: React.FC = () => {
  const { event, album, tracks, loading, error } = useEvent(null);

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
    </main>
  );
};

export default Listen;
