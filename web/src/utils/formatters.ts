const DATE_FMT = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

/**
 * Format a timestamp (epoch ms or Firestore-style { seconds }) as pt-BR datetime.
 */
export function formatDate(ts: number | { seconds: number }): string {
  const ms = typeof ts === 'number' ? ts : ts.seconds * 1000;
  return DATE_FMT.format(new Date(ms));
}

/**
 * Format a duration in milliseconds as mm:ss.
 */
export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return '00:00';
  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

/**
 * Zero-pad a track position to 2 digits.
 */
export function formatTrackPosition(pos: number): string {
  return String(Math.max(0, Math.floor(pos))).padStart(2, '0');
}
