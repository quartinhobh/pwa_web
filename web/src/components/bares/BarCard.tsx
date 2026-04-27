import React from 'react';
import { Link } from 'react-router-dom';
import ZineFrame from '@/components/common/ZineFrame';
import Button from '@/components/common/Button';
import BarFeedbackButtons from '@/components/bares/BarFeedbackButtons';
import { STATUS_DISPLAY } from '@/types';
import type { PublicBarSuggestion, SuggestionStatus } from '@/types';

export interface BarCardProps {
  bar: PublicBarSuggestion;
  idToken: string | null;
  firebaseUid: string | null;
  asDetail?: boolean;
  onMoveStatus?: (id: string, status: SuggestionStatus) => void;
  onDelete?: (id: string) => void;
  onRequestLogin?: () => void;
}

const STATUS_LABELS: SuggestionStatus[] = ['suggested', 'liked', 'disliked'];

export const BarCard: React.FC<BarCardProps> = ({
  bar,
  idToken,
  firebaseUid,
  asDetail = false,
  onMoveStatus,
  onDelete,
  onRequestLogin,
}) => {
  const instagramHandle = bar.instagram
    ? bar.instagram.replace(/^@/, '').replace(/^https?:\/\/(www\.)?instagram\.com\//, '').replace(/\/$/, '')
    : null;
  const instagramHref = bar.instagram
    ? (bar.instagram.startsWith('http')
      ? bar.instagram
      : `https://instagram.com/${bar.instagram.replace(/^@/, '')}`)
    : null;

  const cardContent = (
    <>
      <h3 className="font-display text-lg text-zine-burntOrange dark:text-zine-cream">
        {bar.name}
      </h3>

      {/* Status/tag badges — below name, no rounded-full */}
      <div className="flex gap-2 flex-wrap mt-1">
        {bar.isClosed && (
          <span className="font-body text-xs px-2 py-0.5 border-2 border-zine-burntOrange text-zine-burntOrange dark:text-zine-burntYellow">
            fechado
          </span>
        )}
        {bar.hasSoundSystem && (
          <span className="font-body text-xs px-2 py-0.5 border-2 border-zine-burntYellow text-zine-burntOrange dark:text-zine-burntYellow">
            som
          </span>
        )}
      </div>

      {bar.address && (
        <p className="font-body text-sm text-zine-burntOrange/80 dark:text-zine-cream/80 mt-1 line-clamp-1">
          📍 {bar.address}
        </p>
      )}

      {instagramHref && instagramHandle && (
        <a
          href={instagramHref}
          target="_blank"
          rel="noopener noreferrer"
          className="font-body text-sm text-zine-burntOrange underline hover:text-zine-burntOrange/70 mt-1 inline-block"
        >
          @{instagramHandle}
        </a>
      )}
    </>
  );

  return (
    <ZineFrame bg="cream">
      <div className="flex flex-col gap-3">
        {asDetail ? (
          <div>{cardContent}</div>
        ) : (
          <div>{cardContent}</div>
        )}

        {!onMoveStatus && (
          <BarFeedbackButtons
            barId={bar.id}
            idToken={idToken}
            firebaseUid={firebaseUid}
            onRequestLogin={onRequestLogin}
          />
        )}

        {!asDetail && !onMoveStatus && (
          <div className="flex justify-end">
            <Link
              to={`/bar/${bar.id}`}
              className="font-body text-sm font-bold text-zine-burntOrange underline hover:text-zine-burntOrange/70"
            >
              ver e votar →
            </Link>
          </div>
        )}

        {onMoveStatus && (
          <div className="flex flex-col gap-2 border-t-2 border-zine-burntYellow/30 pt-2">
            <span className="font-body text-xs text-zine-burntOrange/70 italic">
              mover para (curadoria do admin):
            </span>
            <div className="flex gap-2 flex-wrap">
              {STATUS_LABELS.map((status) => (
                <Button
                  key={status}
                  type="button"
                  onClick={() => onMoveStatus(bar.id, status)}
                  className="text-xs min-h-[44px]"
                >
                  {STATUS_DISPLAY[status]}
                </Button>
              ))}
            </div>
          </div>
        )}

        {onDelete && (
          <Button
            type="button"
            onClick={() => onDelete(bar.id)}
            className="text-xs min-h-[44px]"
          >
            apagar
          </Button>
        )}
      </div>
    </ZineFrame>
  );
};

export default BarCard;
