import React from 'react';
import { Link } from 'react-router-dom';
import { useEvent } from '@/hooks/useEvent';
import { useVotes } from '@/hooks/useVotes';
import { useRsvp } from '@/hooks/useRsvp';
import { useAuth } from '@/hooks/useAuth';
import { useIdToken } from '@/hooks/useIdToken';
import { useSessionStore } from '@/store/sessionStore';
import { AlbumDisplay } from '@/components/events/AlbumDisplay';
import { TrackList } from '@/components/events/TrackList';
import { RsvpButton } from '@/components/rsvp/RsvpButton';
import { RsvpStatus } from '@/components/rsvp/RsvpStatus';
import { EventDetailSkeleton } from '@/components/common/LoadingState';
import ZineFrame from '@/components/common/ZineFrame';
import { isChatAvailable, chatStatusText } from '@/utils/chatAvailability';

const DEFAULT_LOCATION_REVEAL_DAYS = 7;

function shouldShowLocation(eventDate: string, revealDays: number): boolean {
  const event = new Date(eventDate + 'T00:00:00');
  const now = new Date();
  const diff = event.getTime() - now.getTime();
  const days = diff / (1000 * 60 * 60 * 24);
  return days <= revealDays;
}

export const Listen: React.FC = () => {
  const { event, album, tracks, initialRsvpSummary, loading, error } = useEvent(null);

  const { user } = useAuth();
  const idToken = useIdToken();
  const { role } = useSessionStore();

  const { userVote, submitVote } = useVotes(
    event?.id ?? null,
    idToken,
    user?.uid ?? null,
  );

  const rsvpEnabled = !!event?.rsvp?.enabled;
  const { summary: rsvpSummary, userEntry: rsvpEntry, submit: rsvpSubmit, cancel: rsvpCancel } = useRsvp(
    rsvpEnabled ? event?.id ?? null : null,
    idToken,
    initialRsvpSummary,
  );

  if (loading) {
    return <EventDetailSkeleton />;
  }

  if (error) {
    return <main className="font-body text-zine-burntOrange p-4">erro: {error}</main>;
  }

  // No current event — show upcoming/empty state + link to archive.
  if (!event) {
    return (
      <main className="flex flex-col gap-4 p-4">
        <ZineFrame bg="mint">
          <div className="text-center py-4">
            <h2 className="font-display text-2xl text-zine-cream mb-2">
              sem evento no momento
            </h2>
            <p className="font-body text-zine-cream">
              fique ligado — o próximo quartinho vem aí.
            </p>
          </div>
        </ZineFrame>
        <Link
          to="/archive"
          className="font-body font-bold italic text-center text-zine-burntYellow underline"
        >
          ver eventos passados →
        </Link>
      </main>
    );
  }

  const isLive = event.status === 'live';
  const isUpcoming = event.status === 'upcoming';
  const revealDays = event.venueRevealDaysBefore ?? DEFAULT_LOCATION_REVEAL_DAYS;
  const showLocation =
    !!event.location && (isLive || (isUpcoming && shouldShowLocation(event.date, revealDays)));

  return (
    <main className="flex flex-col gap-4 p-4">
      {/* Status badge */}
      {isLive && (
        <div className="flex justify-center">
          <span className="font-display text-sm tracking-widest bg-zine-burntOrange text-zine-cream px-3 py-1 uppercase">
            ao vivo
          </span>
        </div>
      )}
      {isUpcoming && (
        <div className="flex justify-center">
          <span className="font-display text-sm tracking-widest bg-zine-periwinkle text-zine-cream px-3 py-1 uppercase">
            próximo evento
          </span>
        </div>
      )}

      <AlbumDisplay event={event} album={album} coverUrl={event.album?.coverUrl} />

      {/* Date + time + location */}
      <ZineFrame bg="cream" borderColor="burntYellow">
        <div className="flex flex-col gap-1 text-center font-body text-zine-burntOrange">
          <span className="font-bold">
            {new Date(event.date + 'T00:00:00').toLocaleDateString('pt-BR', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </span>
          <span>{event.startTime} — {event.endTime}</span>
          {showLocation && (
            <span className="text-zine-burntYellow font-bold italic mt-1">
              {event.location}
            </span>
          )}
          {isUpcoming && event.location && !showLocation && (
            <span className="text-zine-burntOrange/60 text-sm italic mt-1">
              local revelado {revealDays} dias antes
            </span>
          )}
        </div>
      </ZineFrame>

      {/* RSVP — render the frame as soon as we know RSVP is enabled, even
          before the summary lands. The frame keeps its slot in the layout so
          the page doesn't shift when counts arrive a moment later. */}
      {rsvpEnabled && event.rsvp && (isUpcoming || isLive) && (
        <ZineFrame bg="cream" borderColor="burntYellow">
          <div className="flex flex-col gap-3">
            {rsvpSummary ? (
              <RsvpStatus summary={rsvpSummary} isAdmin={role === 'admin' || role === 'moderator'} />
            ) : (
              <div className="font-body text-sm text-zine-burntOrange/60 italic text-center py-2">
                carregando lista…
              </div>
            )}
            {isUpcoming && rsvpSummary && (
              <RsvpButton
                eventId={event.id}
                config={event.rsvp}
                summary={rsvpSummary}
                userEntry={rsvpEntry}
                isAuthenticated={!!idToken}
                onSubmit={rsvpSubmit}
                onCancel={rsvpCancel}
              />
            )}
          </div>
        </ZineFrame>
      )}

      {/* Event links — Spotify, extras */}
      {(event.spotifyPlaylistUrl || event.extras.links.length > 0) && (
        <div className="flex flex-wrap justify-center gap-3">
          {event.spotifyPlaylistUrl && (
            <a
              href={event.spotifyPlaylistUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-body font-bold text-sm bg-zine-burntYellow text-zine-cream px-4 py-2 border-4 border-zine-cream dark:border-zine-cream/30 hover:bg-zine-burntOrange"
            >
              ouvir no Spotify
            </a>
          )}
          {event.extras.links.map((link, i) => (
            <a
              key={i}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="font-body font-bold text-sm bg-zine-periwinkle dark:bg-zine-periwinkle-dark text-zine-cream px-4 py-2 border-4 border-zine-cream dark:border-zine-cream/30 hover:bg-zine-burntOrange"
            >
              {link.label || link.url}
            </a>
          ))}
        </div>
      )}

      {/* Tracks — live events get inline emoji voting */}
      {isLive && (
        <TrackList
          tracks={tracks}
          artistCredit={album?.artistCredit}
          canVote={!!idToken}
          userVote={userVote}
          onVote={submitVote}
        />
      )}

      {/* Upcoming: tracklist preview, no voting */}
      {isUpcoming && tracks.length > 0 && (
        <TrackList tracks={tracks} artistCredit={album?.artistCredit} />
      )}

      {/* Chat link — gated by chatEnabled + window */}
      {event.chatEnabled !== false && (
        isChatAvailable(event) ? (
          <Link
            to={`/chat/${event.id}`}
            className="font-body font-bold text-center bg-zine-burntYellow dark:bg-zine-burntYellow-bright text-zine-cream dark:text-zine-surface-dark px-4 py-3 border-4 border-zine-cream dark:border-zine-cream/30 hover:bg-zine-burntOrange block"
          >
            💬 entrar no chat
          </Link>
        ) : (
          <button
            type="button"
            disabled
            className="font-body font-bold text-center bg-zine-burntYellow/40 text-zine-cream/70 dark:text-zine-surface-dark/70 px-4 py-3 border-4 border-zine-cream dark:border-zine-cream/30 block cursor-not-allowed"
          >
            💬 {chatStatusText(event) ?? 'chat indisponível'}
          </button>
        )
      )}

      {/* Link to past events */}
      <Link
        to="/archive"
        className="font-body font-bold italic text-center text-zine-burntYellow underline"
      >
        ver eventos passados →
      </Link>
    </main>
  );
};

export default Listen;
