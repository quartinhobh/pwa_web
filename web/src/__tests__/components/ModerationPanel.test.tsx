import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ModerationPanel } from '@/components/admin/ModerationPanel';

type FetchCall = { ok?: boolean; status?: number; body: unknown };

function queueFetch(responses: FetchCall[]): ReturnType<typeof vi.fn> {
  const queue = [...responses];
  const fn = vi.fn(async () => {
    const next = queue.shift();
    // Exhausted queue returns a permissive default (handles user-profile
    // lookups from the useUserNames helper).
    if (!next) {
      return {
        ok: true,
        status: 200,
        json: async () => ({ userId: 'unknown', displayName: null, email: null, role: 'guest' }),
      } as unknown as Response;
    }
    return {
      ok: next.ok ?? true,
      status: next.status ?? 200,
      json: async () => next.body,
    } as unknown as Response;
  });
  globalThis.fetch = fn as unknown as typeof fetch;
  return fn;
}

beforeEach(() => vi.restoreAllMocks());
afterEach(() => vi.restoreAllMocks());

describe('ModerationPanel', () => {
  it('renders empty state when no bans/logs', async () => {
    queueFetch([
      { body: { bans: [] } },
      { body: { logs: [] } },
    ]);
    render(<ModerationPanel idToken="tok" />);
    await waitFor(() =>
      expect(screen.getByText(/Nenhum banimento ativo/)).toBeInTheDocument(),
    );
    expect(screen.getByText(/Sem entradas/)).toBeInTheDocument();
  });

  it('lists bans and logs', async () => {
    queueFetch([
      {
        body: {
          bans: [
            {
              userId: 'u1',
              bannedBy: 'm',
              reason: 'abuse',
              createdAt: 1,
              expiresAt: null,
            },
          ],
        },
      },
      {
        body: {
          logs: [
            {
              id: 'l1',
              action: 'ban_user',
              targetUserId: 'u1',
              performedBy: 'm',
              eventId: null,
              messageId: null,
              reason: 'abuse',
              createdAt: 1,
            },
          ],
        },
      },
    ]);
    render(<ModerationPanel idToken="tok" />);
    await waitFor(() =>
      expect(screen.getByTestId('ban-row-u1')).toBeInTheDocument(),
    );
    expect(screen.getByTestId('log-row-l1')).toBeInTheDocument();
    expect(screen.getByText('ban_user')).toBeInTheDocument();
  });

  it('unban button triggers DELETE and refetches', async () => {
    const fn = queueFetch([
      // 1. Initial fetchBans
      {
        body: {
          bans: [
            {
              userId: 'u1',
              bannedBy: 'm',
              reason: null,
              createdAt: 1,
              expiresAt: null,
            },
          ],
        },
      },
      // 2. Initial fetchModerationLogs
      { body: { logs: [] } },
      // 3. useUserNames profile lookup for u1
      { body: { userId: 'u1', displayName: 'User One', email: null, role: 'user' } },
      // 4. DELETE /moderation/ban/u1
      { body: { ok: true } },
      // 5. Refetch bans
      { body: { bans: [] } },
      // 6. Refetch logs
      { body: { logs: [] } },
    ]);
    render(<ModerationPanel idToken="tok" />);
    await waitFor(() =>
      expect(screen.getByTestId('ban-row-u1')).toBeInTheDocument(),
    );
    await userEvent.click(screen.getByRole('button', { name: /desbanir/i }));
    await waitFor(() =>
      expect(screen.getByText(/Nenhum banimento ativo/)).toBeInTheDocument(),
    );
    // Find the DELETE call regardless of index (user-profile fetches may
    // interleave with the main flow).
    const unbanCall = fn.mock.calls.find(
      (c: unknown[]) =>
        typeof c[0] === 'string' &&
        c[0].includes('/moderation/ban/u1') &&
        (c[1] as RequestInit)?.method === 'DELETE',
    );
    expect(unbanCall).toBeTruthy();
  });
});
