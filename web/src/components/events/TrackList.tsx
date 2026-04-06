import React, { useState } from 'react';
import { ZineFrame } from '@/components/common/ZineFrame';
import { LyricsDisplay } from '@/components/events/LyricsDisplay';
import { useLyrics } from '@/hooks/useLyrics';
import type { MusicBrainzTrack } from '@/types';

export interface TrackListProps {
  tracks: MusicBrainzTrack[];
  artistCredit?: string | null;
}

function formatDuration(ms: number): string {
  if (!ms || ms <= 0) return '';
  const total = Math.round(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function TrackLyrics({ track, artistCredit }: { track: MusicBrainzTrack; artistCredit: string | null }) {
  const { lyrics, loading } = useLyrics(artistCredit, track.title);
  return <LyricsDisplay lyrics={lyrics} loading={loading} />;
}

export const TrackList: React.FC<TrackListProps> = ({ tracks, artistCredit }) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <ZineFrame bg="cream" borderColor="burntYellow">
      <ol className="font-body space-y-1" aria-label="tracks">
        {tracks.map((t) => {
          const isOpen = expandedId === t.id;
          return (
            <li key={t.id}>
              <button
                type="button"
                onClick={() => setExpandedId(isOpen ? null : t.id)}
                className="w-full flex items-baseline gap-3 py-1 hover:bg-zine-mint/20 dark:hover:bg-zine-mint-dark/30 rounded px-1 text-left"
              >
                <span className="font-display text-zine-burntYellow w-8 text-right shrink-0">
                  {t.position}
                </span>
                <span className="flex-1 text-zine-burntOrange dark:text-zine-cream">
                  {t.title}
                </span>
                {t.length ? (
                  <span className="text-zine-burntYellow text-sm shrink-0">
                    {formatDuration(t.length)}
                  </span>
                ) : null}
                <span className="text-zine-burntOrange/50 dark:text-zine-cream/50 text-xs shrink-0">
                  {isOpen ? '▲' : '♪'}
                </span>
              </button>
              {isOpen && (
                <div className="mt-1 mb-2">
                  <TrackLyrics track={t} artistCredit={artistCredit ?? null} />
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </ZineFrame>
  );
};

export default TrackList;
