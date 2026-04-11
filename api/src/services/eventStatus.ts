import type { Event, EventStatus } from '../types';

/**
 * Derive an event's status from its date + time fields. The stored `status`
 * column is ignored — date is the single source of truth so we don't need a
 * cron to flip events from upcoming → live → archived.
 *
 * Rules (all times interpreted in the server's local zone, which Render runs
 * as UTC; the YYYY-MM-DDTHH:mm format produces a local-time Date so this is
 * consistent across reads):
 *   - now < startTime  → upcoming
 *   - start ≤ now ≤ end → live
 *   - now > endTime    → archived
 */
export function computeEventStatus(
  event: Pick<Event, 'date' | 'startTime' | 'endTime'> & { status?: EventStatus },
): EventStatus {
  // Cancelled is a terminal, admin-authored state — never overridden by date.
  if (event.status === 'cancelled') return 'cancelled';
  const now = Date.now();
  const start = new Date(`${event.date}T${event.startTime}:00`).getTime();
  const end = new Date(`${event.date}T${event.endTime}:00`).getTime();
  if (Number.isNaN(start) || Number.isNaN(end)) return 'upcoming';
  if (now < start) return 'upcoming';
  if (now > end) return 'archived';
  return 'live';
}

/** Same event, with `status` overwritten by the date-derived value. */
export function withDerivedStatus<
  T extends Pick<Event, 'date' | 'startTime' | 'endTime'> & { status?: EventStatus },
>(event: T): T & { status: EventStatus } {
  return { ...event, status: computeEventStatus(event) };
}
