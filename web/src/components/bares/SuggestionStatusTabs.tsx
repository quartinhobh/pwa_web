import React from 'react';
import type { SuggestionStatus } from '@/types';

export interface SuggestionStatusTabsProps {
  activeStatus: SuggestionStatus;
  onChange: (s: SuggestionStatus) => void;
  counts?: {
    suggested?: number;
    liked?: number;
    disliked?: number;
  };
}

const TABS: { status: SuggestionStatus; label: string }[] = [
  { status: 'suggested', label: 'sugeridos' },
  { status: 'liked', label: '❤️ curti' },
  { status: 'disliked', label: '💀 nao gostei' },
];

const COUNT_KEY: Record<SuggestionStatus, keyof NonNullable<SuggestionStatusTabsProps['counts']>> = {
  suggested: 'suggested',
  liked: 'liked',
  disliked: 'disliked',
};

export const SuggestionStatusTabs: React.FC<SuggestionStatusTabsProps> = ({
  activeStatus,
  onChange,
  counts,
}) => {
  return (
    <div className="flex gap-2 flex-wrap">
      {TABS.map(({ status, label }) => {
        const count = counts?.[COUNT_KEY[status]];
        const displayLabel = count !== undefined ? `${label} (${count})` : label;
        const isActive = activeStatus === status;

        return (
          <button
            key={status}
            type="button"
            onClick={() => onChange(status)}
            aria-pressed={isActive}
            className={[
              'font-body text-xs px-3 py-1.5 border-2 border-zine-burntYellow min-h-[44px]',
              isActive
                ? 'bg-zine-burntYellow text-zine-cream'
                : 'bg-transparent text-zine-burntOrange hover:bg-zine-burntYellow/20',
              'focus-visible:ring-2 focus-visible:ring-zine-burntOrange',
            ].join(' ')}
          >
            {displayLabel}
          </button>
        );
      })}
    </div>
  );
};

export default SuggestionStatusTabs;
