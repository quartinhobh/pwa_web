import React from 'react';
import { Link } from 'react-router-dom';
import ZineFrame from '@/components/common/ZineFrame';
import BarFeedbackButtons from '@/components/bares/BarFeedbackButtons';
import AdminSuggestionCard from '@/components/admin/AdminSuggestionCard';
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

function instagramHandleFrom(value: string | null): string | null {
  if (!value) return null;
  return value
    .replace(/^@/, '')
    .replace(/^https?:\/\/(www\.)?instagram\.com\//, '')
    .replace(/\/$/, '');
}

function instagramHrefFrom(value: string | null): string | null {
  if (!value) return null;
  return value.startsWith('http')
    ? value
    : `https://instagram.com/${value.replace(/^@/, '')}`;
}

export const BarCard: React.FC<BarCardProps> = ({
  bar,
  idToken,
  firebaseUid,
  asDetail = false,
  onMoveStatus,
  onDelete,
  onRequestLogin,
}) => {
  const instagramHandle = instagramHandleFrom(bar.instagram);
  const instagramHref = instagramHrefFrom(bar.instagram);

  if (onMoveStatus) {
    const barWithStatus = bar as PublicBarSuggestion & { status?: SuggestionStatus };
    const status: SuggestionStatus = barWithStatus.status ?? 'suggested';

    const meta: React.ReactNode[] = [];
    if (bar.isClosed) {
      meta.push(
        <span
          key="closed"
          className="font-body text-xs px-2 py-0.5 border-2 border-zine-burntOrange text-zine-burntOrange dark:text-zine-burntYellow"
        >
          fechado
        </span>,
      );
    }
    if (bar.hasSoundSystem) {
      meta.push(
        <span
          key="som"
          className="font-body text-xs px-2 py-0.5 border-2 border-zine-burntYellow text-zine-burntOrange dark:text-zine-burntYellow"
        >
          som
        </span>,
      );
    }
    if (instagramHref && instagramHandle) {
      meta.push(
        <a
          key="ig"
          href={instagramHref}
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-zine-burntOrange"
        >
          @{instagramHandle}
        </a>,
      );
    }
    meta.push(
      <span key="date">{new Date(bar.createdAt).toLocaleDateString('pt-BR')}</span>,
    );
    meta.push(
      bar.suggestedByEmail ? (
        <a
          key="by"
          href={`mailto:${bar.suggestedByEmail}`}
          className="underline truncate max-w-[18ch]"
          title={bar.suggestedByEmail}
        >
          {bar.suggestedByEmail}
        </a>
      ) : (
        <span key="by" className="italic">
          anônimo
        </span>
      ),
    );

    return (
      <AdminSuggestionCard
        title={bar.name}
        subtitle={bar.address ? `📍 ${bar.address}` : undefined}
        metaItems={meta}
        status={status}
        onMoveStatus={(s) => onMoveStatus(bar.id, s)}
        onDelete={onDelete ? () => onDelete(bar.id) : undefined}
      />
    );
  }

  return (
    <ZineFrame bg="cream">
      <div className="flex flex-col gap-3">
        <h3 className="font-display text-lg text-zine-burntOrange dark:text-zine-cream">
          {bar.name}
        </h3>

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

        <BarFeedbackButtons
          barId={bar.id}
          idToken={idToken}
          firebaseUid={firebaseUid}
          onRequestLogin={onRequestLogin}
          trailingAction={
            !asDetail && (
              <Link
                to={`/local/${bar.id}`}
                className="font-body text-sm font-bold text-zine-burntOrange underline hover:text-zine-burntOrange/70 min-h-[44px] flex items-center"
              >
                ver comentários →
              </Link>
            )
          }
        />
      </div>
    </ZineFrame>
  );
};

export default BarCard;
