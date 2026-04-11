import type { Event } from '@/types';

export type ChatWindowFields = Pick<
  Event,
  'chatEnabled' | 'chatOpensAt' | 'chatClosesAt'
>;

function normalizeEnabled(event: ChatWindowFields): boolean {
  // default: chat is enabled unless explicitly set to false.
  return event.chatEnabled !== false;
}

export function isChatAvailable(event: ChatWindowFields, now: number = Date.now()): boolean {
  if (!normalizeEnabled(event)) return false;
  if (event.chatOpensAt != null && now < event.chatOpensAt) return false;
  if (event.chatClosesAt != null && now > event.chatClosesAt) return false;
  return true;
}

function formatRelativePt(deltaMs: number): string {
  const abs = Math.abs(deltaMs);
  const minutes = Math.round(abs / 60_000);
  if (minutes < 1) return 'menos de 1 min';
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.round(hours / 24);
  return `${days}d`;
}

export function chatStatusText(
  event: ChatWindowFields,
  now: number = Date.now(),
): string | null {
  if (!normalizeEnabled(event)) return 'chat desativado';
  if (event.chatOpensAt != null && now < event.chatOpensAt) {
    return `chat abre em ${formatRelativePt(event.chatOpensAt - now)}`;
  }
  if (event.chatClosesAt != null && now > event.chatClosesAt) {
    return 'chat fechado';
  }
  return null;
}

function formatHour(ts: number): string {
  const d = new Date(ts);
  const hh = d.getHours();
  const mm = d.getMinutes();
  return mm === 0 ? `${hh}h` : `${hh}h${mm.toString().padStart(2, '0')}`;
}

export function formatChatWindow(event: ChatWindowFields): string | null {
  if (!normalizeEnabled(event)) return null;
  const { chatOpensAt, chatClosesAt } = event;
  if (chatOpensAt == null && chatClosesAt == null) return null;
  if (chatOpensAt != null && chatClosesAt != null) {
    return `aberto das ${formatHour(chatOpensAt)} às ${formatHour(chatClosesAt)}`;
  }
  if (chatOpensAt != null) {
    return `abre às ${formatHour(chatOpensAt)}`;
  }
  return `fecha às ${formatHour(chatClosesAt!)}`;
}
