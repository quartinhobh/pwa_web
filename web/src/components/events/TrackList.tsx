import React from 'react';
import { ZineFrame } from '@/components/common/ZineFrame';
import type { MusicBrainzTrack } from '@/types';

export interface TrackListProps {
  tracks: MusicBrainzTrack[];
}

function formatDuration(ms: number): string {
  if (!ms || ms <= 0) return '';
  const total = Math.round(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/**
 * TrackList — ordered list inside ZineFrame(bg=cream).
 * Track numbers use text-zine-burntYellow per Section 13.
 */
export const TrackList: React.FC<TrackListProps> = ({ tracks }) => {
  return (
    <ZineFrame bg="cream" borderColor="burntYellow">
      <ol className="font-body space-y-2" aria-label="tracks">
        {tracks.map((t) => (
          <li key={t.id} className="flex items-baseline gap-3">
            <span className="font-display text-zine-burntYellow w-8 text-right">
              {t.position}
            </span>
            <span className="flex-1 text-zine-burntOrange">{t.title}</span>
            {t.length ? (
              <span className="text-zine-burntYellow text-sm">
                {formatDuration(t.length)}
              </span>
            ) : null}
          </li>
        ))}
      </ol>
    </ZineFrame>
  );
};

export default TrackList;
