import React, { useState } from 'react';
import { ZineFrameNoWobble } from '@/components/common/ZineFrame';
import { LyricsDisplay } from '@/components/events/LyricsDisplay';
import { useLyrics } from '@/hooks/useLyrics';
import type { MusicBrainzTrack, UserVote } from '@/types';

export interface TrackListProps {
  tracks: MusicBrainzTrack[];
  artistCredit?: string | null;
  /** When provided, enables inline voting with emoji toggles. */
  userVote?: UserVote | null;
  onVote?: (favoriteTrackId: string, leastLikedTrackId: string) => Promise<void>;
  canVote?: boolean;
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

export const TrackList: React.FC<TrackListProps> = ({
  tracks,
  artistCredit,
  userVote,
  onVote,
  canVote = false,
}) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [favorite, setFavorite] = useState<string | null>(userVote?.favoriteTrackId ?? null);
  const [least, setLeast] = useState<string | null>(userVote?.leastLikedTrackId ?? null);
  const [submitting, setSubmitting] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  async function copyTrack(track: MusicBrainzTrack) {
    const text = artistCredit ? `${artistCredit} — ${track.title}` : track.title;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(track.id);
      setTimeout(() => setCopiedId((curr) => (curr === track.id ? null : curr)), 1500);
    } catch {
      // clipboard blocked — silent
    }
  }

  const votingEnabled = canVote && !!onVote;

  async function trySubmit(fav: string | null, lst: string | null) {
    if (!fav || !lst || fav === lst || !onVote) return;
    setSubmitting(true);
    try {
      await onVote(fav, lst);
    } catch {
      // silent
    } finally {
      setSubmitting(false);
    }
  }

  function toggleFavorite(trackId: string) {
    if (submitting) return;
    const next = favorite === trackId ? null : trackId;
    const nextLeast = least === trackId ? null : least;
    setFavorite(next);
    setLeast(nextLeast);
    void trySubmit(next, nextLeast);
  }

  function toggleLeast(trackId: string) {
    if (submitting) return;
    const next = least === trackId ? null : trackId;
    const nextFav = favorite === trackId ? null : favorite;
    setLeast(next);
    setFavorite(nextFav);
    void trySubmit(nextFav, next);
  }

  return (
    <ZineFrameNoWobble bg="cream" borderColor="burntYellow">
      <ol className="font-body space-y-1" aria-label="tracks">
        {tracks.map((t) => {
          const isOpen = expandedId === t.id;
          const isFav = favorite === t.id;
          const isLeast = least === t.id;
          const isCopied = copiedId === t.id;

          return (
            <li key={t.id}>
              <div
                className="flex items-center gap-2 py-1 px-1 relative"
                style={{ filter: 'url(#zine-wobble)' }}>
                  {/* Track info — click to show lyrics */}
                  <button
                    type="button"
                    onClick={() => setExpandedId(isOpen ? null : t.id)}
                    className="flex-1 flex items-baseline gap-3 hover:bg-zine-mint/20 dark:hover:bg-zine-mint-dark/30 rounded text-left min-w-0"
                  >
                    <span className="font-display text-zine-burntYellow w-6 text-right shrink-0 text-sm">
                      {t.position}
                    </span>
                    <span className="flex-1 text-zine-burntOrange dark:text-zine-cream truncate">
                      {t.title}
                    </span>
                    {t.length ? (
                      <span className="text-zine-burntYellow text-xs shrink-0">
                        {formatDuration(t.length)}
                      </span>
                    ) : null}
                  </button>

                  <button
                    type="button"
                    onClick={() => void copyTrack(t)}
                    title={isCopied ? 'copiado!' : 'copiar nome'}
                    aria-label={`copiar ${t.title}`}
                    className="shrink-0 p-1 text-zine-burntOrange/60 hover:text-zine-burntOrange dark:text-zine-cream/60 dark:hover:text-zine-cream transition-colors"
                  >
                    {isCopied ? (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    ) : (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                      </svg>
                    )}
                  </button>

                  {/* Voting emojis */}
                  {votingEnabled && (
                    <div className="flex gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => toggleFavorite(t.id)}
                        disabled={submitting}
                        title="favorita"
                        className={[
                          'text-lg leading-none transition-transform',
                          isFav ? 'scale-125' : 'opacity-40 hover:opacity-80',
                        ].join(' ')}
                      >
                        {isFav ? '❤️' : '🤍'}
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleLeast(t.id)}
                        disabled={submitting}
                        title="menos gostei"
                        className={[
                          'text-lg leading-none transition-transform',
                          isLeast ? 'scale-125' : 'opacity-40 hover:opacity-80',
                        ].join(' ')}
                      >
                        {isLeast ? '💀' : '☠️'}
                      </button>
                    </div>
                  )}
                </div>

                {isOpen && (
                  <div className="mt-1 mb-2 ml-4">
                    <TrackLyrics track={t} artistCredit={artistCredit ?? null} />
                  </div>
                )}
              </li>
            );
          })}
      </ol>

      {submitting && (
        <p className="font-body text-sm text-zine-burntOrange/60 text-center mt-2">
          enviando voto…
        </p>
      )}
    </ZineFrameNoWobble>
  );
};

export default TrackList;
