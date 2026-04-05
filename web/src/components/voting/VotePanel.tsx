import React, { useState } from 'react';
import { ZineFrame } from '@/components/common/ZineFrame';
import { Button } from '@/components/common/Button';
import type { MusicBrainzTrack, UserVote } from '@/types';

export interface VotePanelProps {
  tracks: MusicBrainzTrack[];
  userVote: UserVote | null;
  onSubmit: (favoriteTrackId: string, leastLikedTrackId: string) => Promise<void>;
}

/**
 * VotePanel — lets a user pick a single favorite + single least-liked track.
 * Disabled when `userVote` is already present (shows the prior selection).
 * Wrapped in ZineFrame bg=mint per Section 13.
 */
export const VotePanel: React.FC<VotePanelProps> = ({
  tracks,
  userVote,
  onSubmit,
}) => {
  const [favorite, setFavorite] = useState<string | null>(
    userVote?.favoriteTrackId ?? null,
  );
  const [least, setLeast] = useState<string | null>(
    userVote?.leastLikedTrackId ?? null,
  );
  const [submitting, setSubmitting] = useState(false);
  const [confirmed, setConfirmed] = useState(!!userVote);
  const [localError, setLocalError] = useState<string | null>(null);

  const alreadyVoted = !!userVote;
  const sameTrack = favorite !== null && favorite === least;
  const canSubmit = !!favorite && !!least && !sameTrack && !submitting;

  const handleSubmit = async (): Promise<void> => {
    if (!favorite || !least) return;
    setSubmitting(true);
    setLocalError(null);
    try {
      await onSubmit(favorite, least);
      setConfirmed(true);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'vote_failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ZineFrame bg="mint">
      <div className="flex flex-col gap-3" aria-label="vote-panel">
        <h3 className="font-display text-zine-burntOrange text-xl">Votação</h3>

        <fieldset className="flex flex-col gap-1" disabled={alreadyVoted}>
          <legend className="font-body text-zine-burntOrange font-bold">
            Faixa favorita
          </legend>
          {tracks.map((t) => (
            <label
              key={`fav-${t.id}`}
              className="font-body text-zine-burntOrange flex items-center gap-2"
            >
              <input
                type="radio"
                name="favorite"
                value={t.id}
                checked={favorite === t.id}
                onChange={() => setFavorite(t.id)}
              />
              {t.title}
            </label>
          ))}
        </fieldset>

        <fieldset className="flex flex-col gap-1" disabled={alreadyVoted}>
          <legend className="font-body text-zine-burntOrange font-bold">
            Faixa menos preferida
          </legend>
          {tracks.map((t) => (
            <label
              key={`least-${t.id}`}
              className="font-body text-zine-burntOrange flex items-center gap-2"
            >
              <input
                type="radio"
                name="least"
                value={t.id}
                checked={least === t.id}
                onChange={() => setLeast(t.id)}
              />
              {t.title}
            </label>
          ))}
        </fieldset>

        {sameTrack ? (
          <p className="font-body text-zine-burntOrange" role="alert">
            Escolha faixas diferentes.
          </p>
        ) : null}

        {localError ? (
          <p className="font-body text-zine-burntOrange" role="alert">
            {localError}
          </p>
        ) : null}

        {confirmed ? (
          <p className="font-body text-zine-burntOrange" aria-live="polite">
            Voto registrado.
          </p>
        ) : (
          <Button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={!canSubmit || alreadyVoted}
          >
            Enviar voto
          </Button>
        )}
      </div>
    </ZineFrame>
  );
};

export default VotePanel;
