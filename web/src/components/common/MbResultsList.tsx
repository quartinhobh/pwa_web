import React from 'react';
import type { MbSearchResult } from '@/services/api';

export type MbResultsListVariant = 'default' | 'compact';

interface MbResultsListProps {
  results: MbSearchResult[];
  searching: boolean;
  onSelect: (result: MbSearchResult) => void;
  variant?: MbResultsListVariant;
  searchingLabel?: string;
}

/**
 * Presentational list of MusicBrainz search results. Pairs with
 * useMusicBrainzSearch. Two variants:
 *  - default: large zine-style card list (used in EventForm)
 *  - compact: dense list with smaller covers (used in Profile picker)
 */
export const MbResultsList: React.FC<MbResultsListProps> = ({
  results,
  searching,
  onSelect,
  variant = 'default',
  searchingLabel = 'buscando…',
}) => {
  const isCompact = variant === 'compact';

  if (searching) {
    return (
      <p
        className={`font-body text-xs text-zine-burntOrange/60 ${isCompact ? 'animate-pulse' : ''}`}
      >
        {searchingLabel}
      </p>
    );
  }

  if (results.length === 0) return null;

  if (isCompact) {
    return (
      <ul className="border-2 border-zine-burntYellow/30 rounded max-h-48 overflow-y-auto divide-y divide-zine-burntYellow/20">
        {results.map((r) => (
          <li key={r.id}>
            <button
              type="button"
              onClick={() => onSelect(r)}
              className="w-full flex items-center gap-2 px-2 py-1.5 hover:bg-zine-burntYellow/10 text-left"
            >
              {r.coverUrl && (
                <img
                  src={r.coverUrl}
                  alt=""
                  loading="lazy"
                  className="w-8 h-8 rounded object-cover shrink-0"
                />
              )}
              <div className="min-w-0">
                <p className="font-body text-sm truncate">{r.title}</p>
                <p className="font-body text-xs text-zine-burntOrange/60 truncate">
                  {r.artistCredit}
                </p>
              </div>
            </button>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <ul className="border-4 border-zine-burntYellow bg-zine-cream dark:bg-zine-surface-dark max-h-64 overflow-y-auto">
      {results.map((r) => (
        <li key={r.id}>
          <button
            type="button"
            onClick={() => onSelect(r)}
            className="w-full text-left px-2 py-2 flex items-center gap-3 hover:bg-zine-mint dark:hover:bg-zine-mint-dark border-b border-zine-burntYellow/20"
          >
            <img
              src={r.coverUrl ?? ''}
              alt=""
              className="w-10 h-10 object-cover border-2 border-zine-cream bg-zine-periwinkle"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
            <div className="flex flex-col min-w-0">
              <span className="font-body font-bold text-zine-burntOrange dark:text-zine-cream text-sm truncate">
                {r.title}
              </span>
              <span className="font-body text-xs text-zine-burntOrange/70 dark:text-zine-cream/70 truncate">
                {r.artistCredit} {r.date ? `(${r.date.slice(0, 4)})` : ''}
              </span>
            </div>
          </button>
        </li>
      ))}
    </ul>
  );
};

export default MbResultsList;
