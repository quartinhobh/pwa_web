import React, { useState } from 'react';
import ZineFrame from '@/components/common/ZineFrame';
import Button from '@/components/common/Button';
import { STATUS_DISPLAY } from '@/types';
import type { SuggestionStatus } from '@/types';

const STATUS_ORDER: SuggestionStatus[] = ['suggested', 'liked', 'disliked'];

export interface AdminSuggestionCardProps {
  /** Optional left-side media slot (e.g. album cover). Render nothing for bars. */
  media?: React.ReactNode;
  title: string;
  /** Subtitle below title — artist name for albums, address/instagram for bars. */
  subtitle?: React.ReactNode;
  /** Inline meta items separated by `·` (status badge, count, links, date, email). */
  metaItems?: React.ReactNode[];
  /** Free-form notes shown collapsed to 2 lines with "ver mais" toggle. */
  notes?: string | null;
  status: SuggestionStatus;
  onMoveStatus: (status: SuggestionStatus) => void;
  onDelete?: () => void;
}

export const AdminSuggestionCard: React.FC<AdminSuggestionCardProps> = ({
  media,
  title,
  subtitle,
  metaItems,
  notes,
  status,
  onMoveStatus,
  onDelete,
}) => {
  const [notesOpen, setNotesOpen] = useState(false);
  const items = (metaItems ?? []).filter(Boolean);

  return (
    <ZineFrame bg="cream">
      <div className="flex gap-3">
        {media && <div className="shrink-0">{media}</div>}

        <div className="flex-1 min-w-0 flex flex-col gap-1">
          <div className="flex items-baseline gap-2 min-w-0 flex-wrap">
            <h3
              className="font-display text-base text-zine-burntOrange dark:text-zine-cream truncate"
              title={title}
            >
              {title}
            </h3>
            {subtitle && (
              <span className="font-body text-xs text-zine-burntOrange/70 dark:text-zine-cream/70 truncate">
                {subtitle}
              </span>
            )}
          </div>

          {items.length > 0 && (
            <div className="flex items-center gap-x-2 gap-y-1 flex-wrap font-body text-xs text-zine-burntOrange/70">
              {items.map((item, i) => (
                <React.Fragment key={i}>
                  {i > 0 && <span aria-hidden="true">·</span>}
                  <span className="inline-flex items-center">{item}</span>
                </React.Fragment>
              ))}
            </div>
          )}

          {notes && (
            <p
              className={`font-body text-xs text-zine-burntOrange/80 dark:text-zine-cream/80 ${
                notesOpen ? '' : 'line-clamp-2'
              } whitespace-pre-wrap break-words`}
            >
              {notes}
              {notes.length > 80 && (
                <>
                  {' '}
                  <button
                    type="button"
                    onClick={() => setNotesOpen((v) => !v)}
                    className="underline font-bold not-italic"
                  >
                    {notesOpen ? 'ver menos' : 'ver mais'}
                  </button>
                </>
              )}
            </p>
          )}
        </div>
      </div>

      <div className="mt-3 pt-2 border-t-2 border-zine-burntYellow/30 flex items-center gap-2 flex-wrap">
        <div
          role="group"
          aria-label="mover status"
          className="flex border-2 border-zine-burntYellow"
        >
          {STATUS_ORDER.map((s) => {
            const active = s === status;
            return (
              <button
                key={s}
                type="button"
                onClick={() => onMoveStatus(s)}
                aria-pressed={active}
                className={[
                  'font-body text-xs font-bold px-3 py-1.5 min-h-[36px] transition-colors',
                  active
                    ? 'bg-zine-burntOrange text-zine-cream'
                    : 'bg-zine-cream text-zine-burntOrange hover:bg-zine-burntYellow/40',
                ].join(' ')}
              >
                {STATUS_DISPLAY[s]}
              </button>
            );
          })}
        </div>

        {onDelete && (
          <Button
            type="button"
            onClick={onDelete}
            className="ml-auto text-xs px-3 py-1 border-2"
          >
            apagar
          </Button>
        )}
      </div>
    </ZineFrame>
  );
};

export default AdminSuggestionCard;
