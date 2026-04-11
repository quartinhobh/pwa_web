import { describe, expect, it } from 'vitest';
import {
  isChatAvailable,
  chatStatusText,
  formatChatWindow,
} from '@/utils/chatAvailability';

const NOW = new Date('2026-04-11T20:00:00').getTime();
const ONE_HOUR = 60 * 60 * 1000;

describe('isChatAvailable', () => {
  it('returns false when chatEnabled is explicitly false', () => {
    expect(isChatAvailable({ chatEnabled: false }, NOW)).toBe(false);
    expect(chatStatusText({ chatEnabled: false }, NOW)).toBe('chat desativado');
  });

  it('returns false when chatOpensAt is in the future + status shows countdown', () => {
    const event = { chatEnabled: true, chatOpensAt: NOW + 2 * ONE_HOUR, chatClosesAt: null };
    expect(isChatAvailable(event, NOW)).toBe(false);
    expect(chatStatusText(event, NOW)).toBe('chat abre em 2h');
  });

  it('returns false when chatClosesAt is in the past + status says closed', () => {
    const event = { chatEnabled: true, chatOpensAt: null, chatClosesAt: NOW - ONE_HOUR };
    expect(isChatAvailable(event, NOW)).toBe(false);
    expect(chatStatusText(event, NOW)).toBe('chat fechado');
  });

  it('returns true inside the window and status is null', () => {
    const event = {
      chatEnabled: true,
      chatOpensAt: NOW - ONE_HOUR,
      chatClosesAt: NOW + ONE_HOUR,
    };
    expect(isChatAvailable(event, NOW)).toBe(true);
    expect(chatStatusText(event, NOW)).toBeNull();
  });

  it('returns true when both timestamps are null (always open)', () => {
    const event = { chatEnabled: true, chatOpensAt: null, chatClosesAt: null };
    expect(isChatAvailable(event, NOW)).toBe(true);
    expect(chatStatusText(event, NOW)).toBeNull();
  });

  it('returns true when only chatOpensAt in the past and no chatClosesAt', () => {
    const event = { chatEnabled: true, chatOpensAt: NOW - ONE_HOUR, chatClosesAt: null };
    expect(isChatAvailable(event, NOW)).toBe(true);
    expect(chatStatusText(event, NOW)).toBeNull();
  });

  it('defaults chatEnabled to true when undefined', () => {
    expect(isChatAvailable({}, NOW)).toBe(true);
  });
});

describe('formatChatWindow', () => {
  it('returns null when both timestamps are null', () => {
    expect(formatChatWindow({ chatEnabled: true, chatOpensAt: null, chatClosesAt: null })).toBeNull();
  });

  it('returns null when chat is disabled', () => {
    expect(formatChatWindow({ chatEnabled: false })).toBeNull();
  });

  it('formats full window "aberto das Xh às Yh"', () => {
    const opens = new Date('2026-04-11T19:00:00').getTime();
    const closes = new Date('2026-04-11T23:00:00').getTime();
    expect(
      formatChatWindow({ chatEnabled: true, chatOpensAt: opens, chatClosesAt: closes }),
    ).toBe('aberto das 19h às 23h');
  });

  it('formats open-only window "abre às Xh"', () => {
    const opens = new Date('2026-04-11T19:30:00').getTime();
    expect(formatChatWindow({ chatEnabled: true, chatOpensAt: opens, chatClosesAt: null })).toBe(
      'abre às 19h30',
    );
  });

  it('formats close-only window "fecha às Yh"', () => {
    const closes = new Date('2026-04-11T23:00:00').getTime();
    expect(
      formatChatWindow({ chatEnabled: true, chatOpensAt: null, chatClosesAt: closes }),
    ).toBe('fecha às 23h');
  });
});
