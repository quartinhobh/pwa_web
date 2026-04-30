import type { Event, EventStatus } from '../types';

// Admins enter event times thinking in Brasília time (UTC-3, no DST since 2019).
// Render runs the server in UTC, so parsing `YYYY-MM-DDTHH:mm` without an offset
// would silently shift the window by 3h. Pin the offset explicitly.
const BR_OFFSET = '-03:00';

function parseBrasiliaTime(date: string, time: string): number {
  return new Date(`${date}T${time}:00${BR_OFFSET}`).getTime();
}

/**
 * Derive an event's status from its date + time fields. The stored `status`
 * column is ignored — date is the single source of truth so we don't need a
 * cron to flip events from upcoming → live → archived.
 *
 * Rules (all interpreted in America/Sao_Paulo):
 *   - now < startTime              → upcoming
 *   - startTime ≤ now < (D+1 00:00)→ live   (votes/chat open until end of day)
 *   - now ≥ next day 00:00 BRT     → archived
 *
 * `endTime` is kept on the event for display but is not used for the
 * live → archived transition: shows often run past the scheduled end and we
 * want voting open for the rest of the day, archiving only the next day.
 */
export function computeEventStatus(
  event: Pick<Event, 'date' | 'startTime' | 'endTime'> & { status?: EventStatus },
): EventStatus {
  // Cancelled is a terminal, admin-authored state — never overridden by date.
  if (event.status === 'cancelled') return 'cancelled';
  const now = Date.now();
  const start = parseBrasiliaTime(event.date, event.startTime);
  const archiveAt = parseBrasiliaTime(event.date, '24:00');
  if (Number.isNaN(start) || Number.isNaN(archiveAt)) return 'upcoming';
  if (now < start) return 'upcoming';
  if (now >= archiveAt) return 'archived';
  return 'live';
}

/** Same event, with `status` overwritten by the date-derived value. */
export function withDerivedStatus<
  T extends Pick<Event, 'date' | 'startTime' | 'endTime'> & { status?: EventStatus },
>(event: T): T & { status: EventStatus } {
  return { ...event, status: computeEventStatus(event) };
}
