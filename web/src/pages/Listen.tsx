import React, { useEffect, useState } from 'react';
import { useEvent } from '@/hooks/useEvent';
import { useLyrics } from '@/hooks/useLyrics';
import { useVotes } from '@/hooks/useVotes';
import { useAuth } from '@/hooks/useAuth';
import { AlbumDisplay } from '@/components/events/AlbumDisplay';
import { TrackList } from '@/components/events/TrackList';
import { LyricsDisplay } from '@/components/events/LyricsDisplay';
import { VotePanel } from '@/components/voting/VotePanel';
import { VoteResults } from '@/components/voting/VoteResults';

/**
 * Listen — primary listening page. Loads the current event and its
 * MusicBrainz album + tracks, then composes AlbumDisplay + TrackList +
 * VotePanel + VoteResults + LyricsDisplay. For MVP the lyrics are shown
 * for the first track; track selection UX lands in a later phase.
 */
export const Listen: React.FC = () => {
  const { event, album, tracks, loading, error } = useEvent(null);
  const firstTrack = tracks[0] ?? null;
  const { lyrics, loading: lyricsLoading } = useLyrics(
    album?.artistCredit ?? null,
    firstTrack?.title ?? null,
  );

  const { user } = useAuth();
  const [idToken, setIdToken] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    if (!user) {
      setIdToken(null);
      return;
    }
    void user.getIdToken().then((t) => {
      if (!cancelled) setIdToken(t);
    });
    return () => {
      cancelled = true;
    };
  }, [user]);

  const { tallies, userVote, submitVote } = useVotes(
    event?.id ?? null,
    idToken,
    user?.uid ?? null,
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
      {idToken ? (
        <VotePanel
          tracks={tracks}
          userVote={userVote}
          onSubmit={submitVote}
        />
      ) : null}
      <VoteResults tallies={tallies} tracks={tracks} />
      <LyricsDisplay lyrics={lyrics} loading={lyricsLoading} />
    </main>
  );
};

export default Listen;
