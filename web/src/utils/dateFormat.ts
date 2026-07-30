/**
 * formatPtDate — render an ISO YYYY-MM-DD string as a pt-BR long date.
 * Parses as local noon to avoid TZ shifts pushing the date to ±1 day.
 */
export function formatPtDate(d: string): string {
  return new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}
