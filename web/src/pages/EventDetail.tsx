import React, { useEffect, useState } from 'react';
import ZineFrame from '@/components/common/ZineFrame';
import Button from '@/components/common/Button';
import { EventDetailSkeleton } from '@/components/common/LoadingState';
import AlbumDisplay from '@/components/events/AlbumDisplay';
import TrackList from '@/components/events/TrackList';
import VoteResults from '@/components/voting/VoteResults';
import PhotoGallery from '@/components/events/PhotoGallery';
import CommentsSection from '@/components/events/CommentsSection';
import {
  fetchEventById,
  fetchMusicBrainzAlbum,
  fetchPhotos,
  fetchTallies,
} from '@/services/api';
import type {
  Event,
  MusicBrainzRelease,
  Photo,
  VoteTallies,
} from '@/types';

type Tab = 'tracks' | 'votes' | 'photos' | 'comments';

function parseTextWithLinks(text: string): React.ReactNode[] {
  const urlPattern = /(https?:\/\/[^\s]+)/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = urlPattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    const url = match[0];
    const display =
      url.length > 50
        ? url.slice(0, 35) + '...' + url.slice(-12)
        : url;
    parts.push(
      <a
        key={match.index}
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-zine-burntYellow underline hover:text-zine-burntOrange"
      >
        {display}
      </a>,
    );
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  return parts;
}

export interface EventDetailProps {
  eventId: string;
}

/**
 * EventDetail — archived event view. Composes AlbumDisplay + TrackList +
 * VoteResults (read-only) + a zine-style photo gallery split by category.
 */
export const EventDetail: React.FC<EventDetailProps> = ({ eventId }) => {
  const [event, setEvent] = useState<Event | null>(null);
  const [album, setAlbum] = useState<MusicBrainzRelease | null>(null);
  const [tallies, setTallies] = useState<VoteTallies | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [tab, setTab] = useState<Tab>('tracks');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async (): Promise<void> => {
      try {
        const ev = await fetchEventById(eventId);
        if (cancelled) return;
        setEvent(ev);
        if (ev) {
          // Use snapshot if available (Branch 1), otherwise fetch from MB API (Branch 2)
          let rel: MusicBrainzRelease | null = null;
          if (ev.album) {
            // Snapshot exists — assemble from it without network call
            rel = {
              id: ev.mbAlbumId,
              title: ev.album.albumTitle,
              artistCredit: ev.album.artistCredit,
              date: ev.date,
              tracks: ev.album.tracks,
            };
          } else {
            // Snapshot is null — fetch from MB API as fallback
            rel = await fetchMusicBrainzAlbum(ev.mbAlbumId).catch(() => null);
          }

          const [tal, pics] = await Promise.all([
            fetchTallies(eventId).catch(() => null),
            fetchPhotos(eventId).catch(() => [] as Photo[]),
          ]);
          if (cancelled) return;
          setAlbum(rel);
          setTallies(tal);
          setPhotos(pics);
        }
      } catch (err) {
        if (!cancelled) setError((err as Error).message);
      }
    })();
    return (): void => {
      cancelled = true;
    };
  }, [eventId]);

  if (error) {
    return (
      <ZineFrame bg="cream">
        <p role="alert" className="font-body text-zine-burntOrange">
          erro: {error}
        </p>
      </ZineFrame>
    );
  }

  if (!event) {
    return <EventDetailSkeleton />;
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'tracks', label: 'Músicas' },
    { key: 'votes', label: 'Votos' },
    { key: 'photos', label: 'Fotos' },
    { key: 'comments', label: 'Comentários' },
  ];

  return (
    <div className="flex flex-col gap-4">
      <AlbumDisplay event={event} album={album} coverUrl={event.album?.coverUrl} />

      {/* Event notes */}
      {event.extras.text && (
        <ZineFrame bg="cream" borderColor="burntYellow">
          <p className="font-body text-zine-burntOrange text-sm whitespace-pre-wrap leading-relaxed">
            {parseTextWithLinks(event.extras.text)}
          </p>
        </ZineFrame>
      )}

      <div
        role="tablist"
        aria-label="event-tabs"
        className="flex flex-wrap gap-1.5"
      >
        {tabs.map(({ key, label }) => (
          <Button
            key={key}
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={tab === key ? 'ring-4 ring-zine-burntOrange' : ''}
          >
            {label}
          </Button>
        ))}
      </div>

      {tab === 'tracks' && (
        <TrackList
          tracks={album?.tracks ?? []}
          artistCredit={album?.artistCredit}
          trackWorks={event.album?.credits?.trackWorks}
        />
      )}

      {tab === 'votes' && (
        <VoteResults tallies={tallies} tracks={album?.tracks ?? []} />
      )}

      {tab === 'photos' && (
        <PhotoGallery photos={photos} />
      )}

      {tab === 'comments' && (
        <CommentsSection eventId={event.id} />
      )}
    </div>
  );
};

export default EventDetail;
