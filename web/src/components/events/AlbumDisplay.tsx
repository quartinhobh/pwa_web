import React, { useState, useEffect } from 'react';
import { ZineFrame } from '@/components/common/ZineFrame';
import { CreditsPanel } from '@/components/events/CreditsPanel';
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
  const [coverFailed, setCoverFailed] = useState(false);
  const blurSrc = event.album?.coverBlurDataUrl;

  // Reset state when coverUrl changes
  useEffect(() => {
    setLoaded(false);
    setCoverFailed(false);
  }, [coverUrl]);

  return (
    <ZineFrame bg="mint" borderColor="cream">
      <div className="flex flex-col items-center gap-4">
        {coverUrl ? (
          <div className="relative w-48 h-48 border-4 border-zine-cream overflow-hidden">
            {/* Blur placeholder — shown only if cover hasn't failed and hasn't loaded */}
            {!coverFailed && blurSrc && !loaded && (
              <img
                src={blurSrc}
                alt=""
                aria-hidden="true"
                className="absolute inset-0 w-full h-full object-cover scale-110 blur-sm"
              />
            )}
            {/* Real cover image — hidden if failed */}
            {!coverFailed && (
              <img
                src={coverUrl}
                alt={album?.title ?? event.title}
                onLoad={() => setLoaded(true)}
                onError={() => setCoverFailed(true)}
                loading="lazy"
                className={`w-full h-full object-cover transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
              />
            )}
            {/* Fallback when cover fails to load */}
            {coverFailed && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-zine-periwinkle dark:bg-zine-periwinkle-dark">
                <span className="font-display text-zine-cream text-xs uppercase tracking-widest opacity-70">
                  sem capa
                </span>
                <span className="font-body text-zine-cream text-[10px] text-center px-2 leading-tight opacity-50">
                  {album?.title ?? event.title}
                </span>
              </div>
            )}
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
      </div>

      <CreditsPanel credits={event.album?.credits} />
    </ZineFrame>
  );
};

export default AlbumDisplay;
