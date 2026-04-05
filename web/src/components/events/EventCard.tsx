import React from 'react';
import { ZineFrame } from '@/components/common/ZineFrame';
import type { Event } from '@/types';

export interface EventCardProps {
  event: Event;
  onClick?: (id: string) => void;
}

/**
 * EventCard — archive grid card. Uses ZineFrame(bg=periwinkle).
 */
export const EventCard: React.FC<EventCardProps> = ({ event, onClick }) => {
  return (
    <button
      type="button"
      onClick={() => onClick?.(event.id)}
      className="text-left"
    >
      <ZineFrame bg="periwinkle" borderColor="cream">
        <div className="flex flex-col gap-2">
          <h3 className="font-display text-xl text-zine-cream">{event.title}</h3>
          <p className="font-body text-zine-cream text-sm">{event.date}</p>
          <p className="font-body text-zine-cream text-xs uppercase">
            {event.status}
          </p>
        </div>
      </ZineFrame>
    </button>
  );
};

export default EventCard;
