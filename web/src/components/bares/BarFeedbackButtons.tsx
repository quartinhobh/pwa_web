import React from 'react';
import { useBarFeedback } from '@/hooks/useBarFeedback';

export interface BarFeedbackButtonsProps {
  barId: string;
  idToken: string | null;
  firebaseUid: string | null;
  onRequestLogin?: () => void;
}

export const BarFeedbackButtons: React.FC<BarFeedbackButtonsProps> = ({
  barId,
  idToken,
  firebaseUid,
  onRequestLogin,
}) => {
  const {
    likedCount,
    dislikedCount,
    userVote,
    handleVote,
    handleRemoveVote,
    error,
  } = useBarFeedback(barId, idToken, firebaseUid);

  const isAnonymous = !firebaseUid;

  const handleLikeClick = async () => {
    if (isAnonymous) {
      onRequestLogin?.();
      return;
    }
    if (userVote === 'liked') {
      await handleRemoveVote();
    } else {
      await handleVote('liked');
    }
  };

  const handleDislikeClick = async () => {
    if (isAnonymous) {
      onRequestLogin?.();
      return;
    }
    if (userVote === 'disliked') {
      await handleRemoveVote();
    } else {
      await handleVote('disliked');
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-3 items-center">
        <button
          type="button"
          onClick={() => void handleLikeClick()}
          aria-pressed={!isAnonymous && userVote === 'liked'}
          aria-label={`curti, ${likedCount} votos`}
          className={[
            'font-body text-sm px-3 py-2 min-h-[44px] border-2 border-zine-burntYellow',
            !isAnonymous && userVote === 'liked'
              ? 'bg-zine-burntYellow text-zine-cream'
              : 'bg-transparent text-zine-burntOrange hover:bg-zine-burntYellow/20',
            'focus-visible:ring-2 focus-visible:ring-zine-burntOrange',
          ].join(' ')}
        >
          ❤️ curti ({likedCount})
        </button>

        <button
          type="button"
          onClick={() => void handleDislikeClick()}
          aria-pressed={!isAnonymous && userVote === 'disliked'}
          aria-label={`nao gostei, ${dislikedCount} votos`}
          className={[
            'font-body text-sm px-3 py-2 min-h-[44px] border-2 border-zine-burntYellow',
            !isAnonymous && userVote === 'disliked'
              ? 'bg-zine-burntYellow text-zine-cream'
              : 'bg-transparent text-zine-burntOrange hover:bg-zine-burntYellow/20',
            'focus-visible:ring-2 focus-visible:ring-zine-burntOrange',
          ].join(' ')}
        >
          💀 nao gostei ({dislikedCount})
        </button>

        {isAnonymous && onRequestLogin && (
          <button
            type="button"
            onClick={onRequestLogin}
            className="font-body text-xs text-zine-burntOrange/70 underline min-h-[44px] px-2"
          >
            entrar pra votar →
          </button>
        )}

        {isAnonymous && !onRequestLogin && (
          <span className="font-body text-xs text-zine-burntOrange/70">
            faca login pra votar
          </span>
        )}
      </div>

      {error && (
        <p
          role="alert"
          aria-live="assertive"
          className="font-body text-xs text-zine-burntOrange font-bold dark:text-zine-burntYellow"
        >
          {error}
        </p>
      )}
    </div>
  );
};

export default BarFeedbackButtons;
