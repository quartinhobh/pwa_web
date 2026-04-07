import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';

// ── Mock firebase/database at the boundary ──────────────────────────────
// We capture the handler passed to onChildAdded so tests can push messages,
// and we record push() calls so sendMessage can be asserted.
type Handler = (snap: { key: string; val: () => unknown }) => void;

const state: {
  handler: Handler | null;
  pushed: Array<{ path: string; value: unknown }>;
  offCalled: boolean;
} = { handler: null, pushed: [], offCalled: false };

vi.mock('firebase/database', () => ({
  getDatabase: vi.fn(() => ({ __kind: 'db' })),
  connectDatabaseEmulator: vi.fn(),
  ref: vi.fn((_db: unknown, path: string) => ({ __kind: 'ref', path })),
  onChildAdded: vi.fn((_ref: unknown, handler: Handler) => {
    state.handler = handler;
    return () => {
      state.offCalled = true;
    };
  }),
  onChildChanged: vi.fn(),
  off: vi.fn(() => {
    state.offCalled = true;
  }),
  push: vi.fn((refObj: { path: string }, value: unknown) => {
    state.pushed.push({ path: refObj.path, value });
    return Promise.resolve({ key: `k${state.pushed.length}` });
  }),
  serverTimestamp: vi.fn(() => 1234567890),
}));

// Mock the firebase service module so importing useChat doesn't spin up
// real Firebase SDK init.
vi.mock('@/services/firebase', () => ({
  realtimeDb: { __kind: 'db' },
}));

import { useChat } from '@/hooks/useChat';
import { useSessionStore } from '@/store/sessionStore';

beforeEach(() => {
  state.handler = null;
  state.pushed = [];
  state.offCalled = false;
  useSessionStore.getState().clear();
  useSessionStore
    .getState()
    .setSession({ sessionId: 's-1', guestName: 'Guest One' });
  useSessionStore.getState().setFirebaseUid('uid-abc');
});

afterEach(() => {
  vi.clearAllMocks();
});

function emit(key: string, msg: Record<string, unknown>): void {
  state.handler?.({ key, val: () => msg });
}

describe('useChat', () => {
  it('subscribes to RTDB path and accumulates messages', async () => {
    const { result } = renderHook(() => useChat('event-1'));
    await waitFor(() => expect(state.handler).not.toBeNull());

    act(() => {
      emit('m1', {
        uid: 'u1',
        displayName: 'Alice',
        text: 'hello',
        timestamp: 1,
        isDeleted: false,
      });
      emit('m2', {
        uid: 'u2',
        displayName: 'Bob',
        text: 'hi',
        timestamp: 2,
        isDeleted: false,
      });
    });

    expect(result.current.messages).toHaveLength(2);
    expect(result.current.messages[0].text).toBe('hello');
    expect(result.current.messages[1].displayName).toBe('Bob');
  });

  it('filters out messages with isDeleted === true', async () => {
    const { result } = renderHook(() => useChat('event-1'));
    await waitFor(() => expect(state.handler).not.toBeNull());

    act(() => {
      emit('m1', {
        uid: 'u1',
        displayName: 'A',
        text: 'ok',
        timestamp: 1,
        isDeleted: false,
      });
      emit('m2', {
        uid: 'u2',
        displayName: 'B',
        text: 'bad',
        timestamp: 2,
        isDeleted: true,
      });
    });

    expect(result.current.messages).toHaveLength(1);
    expect(result.current.messages[0].text).toBe('ok');
  });

  it('sendMessage writes identity + text to RTDB', async () => {
    const { result } = renderHook(() => useChat('event-1'));
    await waitFor(() => expect(state.handler).not.toBeNull());

    await act(async () => {
      await result.current.sendMessage('hey there');
    });

    expect(state.pushed).toHaveLength(1);
    const { path, value } = state.pushed[0];
    expect(path).toBe('chats/event-1/messages');
    expect(value).toMatchObject({
      uid: 'uid-abc',
      displayName: 'Guest One',
      text: 'hey there',
      isDeleted: false,
    });
    expect(typeof (value as { timestamp: unknown }).timestamp).toBeDefined();
  });

  it('falls back to sessionId when no firebase uid', async () => {
    useSessionStore.getState().setFirebaseUid(null);
    const { result } = renderHook(() => useChat('event-1'));
    await waitFor(() => expect(state.handler).not.toBeNull());

    await act(async () => {
      await result.current.sendMessage('yo');
    });

    expect(state.pushed[0].value).toMatchObject({ uid: 's-1' });
  });

  it('unsubscribes on unmount', async () => {
    const { unmount } = renderHook(() => useChat('event-1'));
    await waitFor(() => expect(state.handler).not.toBeNull());
    unmount();
    expect(state.offCalled).toBe(true);
  });
});
