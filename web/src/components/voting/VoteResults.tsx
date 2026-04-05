import React from 'react';
import { ZineFrame } from '@/components/common/ZineFrame';
import type { MusicBrainzTrack, VoteBucket, VoteTallies } from '@/types';

export interface VoteResultsProps {
  tallies: VoteTallies | null;
  tracks: MusicBrainzTrack[];
}

function maxCount(buckets: Record<string, VoteBucket>): number {
  let m = 0;
  for (const k of Object.keys(buckets)) {
    const c = buckets[k]!.count;
    if (c > m) m = c;
  }
  return m;
}

interface BarRowProps {
  label: string;
  count: number;
  max: number;
  color: 'burntYellow' | 'periwinkle';
}

const BarRow: React.FC<BarRowProps> = ({ label, count, max, color }) => {
  const pct = max > 0 ? Math.round((count / max) * 100) : 0;
  const bgClass =
    color === 'burntYellow' ? 'bg-zine-burntYellow' : 'bg-zine-periwinkle';
  return (
    <div className="flex items-center gap-2" aria-label={`bar-${label}`}>
      <span className="font-body text-zine-burntOrange w-32 truncate">
        {label}
      </span>
      <div className="flex-1 h-4 bg-zine-cream relative">
        <div
          className={`${bgClass} h-full`}
          style={{ width: `${pct}%` }}
          data-testid={`bar-fill-${label}`}
        />
      </div>
      <span className="font-body text-zine-burntOrange w-8 text-right">
        {count}
      </span>
    </div>
  );
};

/**
 * VoteResults — horizontal bar chart for favorite + least-liked tallies.
 * Favorites use burntYellow, least-liked use periwinkle.
 */
export const VoteResults: React.FC<VoteResultsProps> = ({ tallies, tracks }) => {
  const favs = tallies?.favorites ?? {};
  const least = tallies?.leastLiked ?? {};
  const favMax = maxCount(favs);
  const leastMax = maxCount(least);

  return (
    <ZineFrame bg="cream" borderColor="burntYellow">
      <div className="flex flex-col gap-4" aria-label="vote-results">
        <section className="flex flex-col gap-2">
          <h3 className="font-display text-zine-burntOrange text-xl">
            Favoritas
          </h3>
          {tracks.map((t) => (
            <BarRow
              key={`fav-${t.id}`}
              label={t.title}
              count={favs[t.id]?.count ?? 0}
              max={favMax}
              color="burntYellow"
            />
          ))}
        </section>
        <section className="flex flex-col gap-2">
          <h3 className="font-display text-zine-burntOrange text-xl">
            Menos preferidas
          </h3>
          {tracks.map((t) => (
            <BarRow
              key={`least-${t.id}`}
              label={t.title}
              count={least[t.id]?.count ?? 0}
              max={leastMax}
              color="periwinkle"
            />
          ))}
        </section>
      </div>
    </ZineFrame>
  );
};

export default VoteResults;
