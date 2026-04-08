import React, { useState } from 'react';
import { ZineFrame } from '@/components/common/ZineFrame';
import type { Event, MusicBrainzRelease } from '@/types';

export interface AlbumDisplayProps {
  event: Event;
  album: MusicBrainzRelease | null;
  coverUrl?: string | null;
}

/**
 * AlbumDisplay — composes ZineFrame(bg=mint) with album cover + title + date.
 * Shows a tiny blur placeholder while the full image loads.
 */
export const AlbumDisplay: React.FC<AlbumDisplayProps> = ({
  event,
  album,
  coverUrl,
}) => {
  const [loaded, setLoaded] = useState(false);
  const blurSrc = event.album?.coverBlurDataUrl;

  return (
    <ZineFrame bg="mint" borderColor="cream">
      <div className="flex flex-col items-center gap-4">
        {coverUrl ? (
          <div className="relative w-48 h-48 border-4 border-zine-cream overflow-hidden">
            {/* Blur placeholder — shown instantly, fades out when real image loads */}
            {blurSrc && !loaded && (
              <img
                src={blurSrc}
                alt=""
                aria-hidden="true"
                className="absolute inset-0 w-full h-full object-cover scale-110 blur-sm"
              />
            )}
            <img
              src={coverUrl}
              alt={album?.title ?? event.title}
              onLoad={() => setLoaded(true)}
              loading="lazy"
              className={`w-full h-full object-cover transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
            />
          </div>
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
          <p className="font-body text-xl text-zine-cream">{album.artistCredit}</p>
        ) : null}
        {/* <p className="font-body text-zine-cream">{event.date}</p> */}
      </div>
    </ZineFrame>
  );
};

export default AlbumDisplay;
