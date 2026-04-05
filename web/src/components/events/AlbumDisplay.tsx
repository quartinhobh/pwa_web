import React from 'react';
import { ZineFrame } from '@/components/common/ZineFrame';
import type { Event, MusicBrainzRelease } from '@/types';

export interface AlbumDisplayProps {
  event: Event;
  album: MusicBrainzRelease | null;
  coverUrl?: string | null;
}

/**
 * AlbumDisplay — composes ZineFrame(bg=mint) with album cover + title + date.
 * Section 13: uses only zine.* Tailwind tokens and font-display.
 */
export const AlbumDisplay: React.FC<AlbumDisplayProps> = ({
  event,
  album,
  coverUrl,
}) => {
  return (
    <ZineFrame bg="mint" borderColor="cream">
      <div className="flex flex-col items-center gap-4">
        {coverUrl ? (
          <img
            src={coverUrl}
            alt={album?.title ?? event.title}
            className="w-48 h-48 object-cover border-4 border-zine-cream"
          />
        ) : (
          <div
            aria-label="album-cover-placeholder"
            className="w-48 h-48 bg-zine-cream border-4 border-zine-cream"
          />
        )}
        <h2 className="font-display text-2xl text-zine-cream">
          {album?.title ?? event.title}
        </h2>
        {album?.artistCredit ? (
          <p className="font-body text-zine-cream">{album.artistCredit}</p>
        ) : null}
        <p className="font-body text-zine-cream">{event.date}</p>
      </div>
    </ZineFrame>
  );
};

export default AlbumDisplay;
