import React, { useEffect, useState } from 'react';
import ZineFrame from '@/components/common/ZineFrame';
import { LoadingState } from '@/components/common/LoadingState';
import EventCard from '@/components/events/EventCard';
import { fetchEvents } from '@/services/api';
import type { Event } from '@/types';

export interface ArchiveProps {
  onOpenEvent?: (id: string) => void;
}

/**
 * Archive — public read view of past (archived) events. Grid of EventCards,
 * each wrapped in its own ZineFrame via the card component.
 */
export const Archive: React.FC<ArchiveProps> = ({ onOpenEvent }) => {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetchEvents('archived')
      .then((list) => {
        if (!cancelled) setEvents(list);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return (): void => {
      cancelled = true;
    };
  }, []);

  return (
    <ZineFrame bg="mint">
      <h1 className="font-display text-3xl text-zine-cream mb-2">Arquivo</h1>
      {loading && <LoadingState />}
      {error && (
        <p role="alert" className="font-body text-zine-cream">
          erro: {error}
        </p>
      )}
      {!loading && events.length === 0 && !error && (
        <p className="font-body text-zine-cream italic">
          Nenhum evento arquivado.
        </p>
      )}
      <div
        aria-label="archive-grid"
        className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4"
      >
        {events.map((evt) => (
          <EventCard key={evt.id} event={evt} onClick={onOpenEvent} />
        ))}
      </div>
    </ZineFrame>
  );
};

export default Archive;
