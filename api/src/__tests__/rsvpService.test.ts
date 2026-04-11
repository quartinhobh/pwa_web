// rsvpService unit tests — mock Firestore via the firebase config module.
// The mock stores a single in-memory rsvps/{eventId} doc plus events/{id}
// doc, and supports runTransaction by running the callback against a shared
// tx object that proxies reads/writes into the in-memory store.

import { describe, expect, it, vi, beforeEach } from 'vitest';

interface Store {
  events: Map<string, Record<string, unknown>>;
  rsvps: Map<string, Record<string, unknown>>;
  users: Map<string, Record<string, unknown>>;
}

const store: Store = {
  events: new Map(),
  rsvps: new Map(),
  users: new Map(),
};

function collectionMap(name: string): Map<string, Record<string, unknown>> {
  if (name === 'events') return store.events;
  if (name === 'rsvps') return store.rsvps;
  if (name === 'users') return store.users;
  throw new Error(`unknown collection: ${name}`);
}

function makeSnap(col: string, id: string) {
  const m = collectionMap(col);
  const data = m.get(id);
  return {
    exists: data !== undefined,
    id,
    data: () => data,
  };
}

function makeDocRef(col: string, id: string) {
  return {
    id,
    get: () => Promise.resolve(makeSnap(col, id)),
    set: (value: Record<string, unknown>) => {
      collectionMap(col).set(id, structuredClone(value));
      return Promise.resolve();
    },
    update: (patch: Record<string, unknown>) => {
      const existing = collectionMap(col).get(id) ?? {};
      collectionMap(col).set(id, { ...existing, ...patch });
      return Promise.resolve();
    },
    delete: () => {
      collectionMap(col).delete(id);
      return Promise.resolve();
    },
  };
}

vi.mock('../config/firebase', () => {
  const adminDb = {
    collection: (name: string) => ({
      doc: (id: string) => makeDocRef(name, id),
      get: () => {
        const docs = Array.from(collectionMap(name).entries()).map(([id, data]) => ({
          id,
          data: () => data,
          exists: true,
        }));
        return Promise.resolve({ docs });
      },
    }),
    runTransaction: async (
      fn: (tx: {
        get: (ref: { id: string; get: () => Promise<unknown> }) => Promise<unknown>;
        set: (ref: { set: (v: Record<string, unknown>) => Promise<void> }, value: Record<string, unknown>) => void;
      }) => Promise<unknown>,
    ) => {
      // Shared snapshot + pending writes pattern.
      const pending: Array<() => Promise<void>> = [];
      const tx = {
        get: (ref: { get: () => Promise<unknown> }) => ref.get(),
        set: (ref: { set: (v: Record<string, unknown>) => Promise<void> }, value: Record<string, unknown>) => {
          pending.push(() => ref.set(value));
        },
      };
      const result = await fn(tx as never);
      for (const op of pending) await op();
      return result;
    },
  };
  return { adminDb, adminAuth: {} };
});

import {
  buildEntryKey,
  submitRsvp,
  getAdminList,
  getUserRsvp,
} from '../services/rsvpService';

function seedEvent(id: string) {
  store.events.set(id, {
    id,
    title: 'Quartinho Test',
    date: '2099-01-01',
    startTime: '20:00',
    endTime: '22:00',
    rsvp: {
      enabled: true,
      capacity: null,
      waitlistEnabled: true,
      plusOneAllowed: true,
      approvalMode: 'auto',
      opensAt: null,
      closesAt: null,
    },
  });
}

beforeEach(() => {
  store.events.clear();
  store.rsvps.clear();
  store.users.clear();
});

describe('buildEntryKey', () => {
  it('firebase key is deterministic and prefixed', () => {
    expect(buildEntryKey({ type: 'firebase', uid: 'abc' })).toBe('firebase:abc');
  });

  it('guest key is deterministic (same email → same hash)', () => {
    const a = buildEntryKey({ type: 'guest', email: 'Ana@Test.com' });
    const b = buildEntryKey({ type: 'guest', email: 'ana@test.com  ' });
    expect(a).toBe(b);
    expect(a.startsWith('guest:')).toBe(true);
    expect(a.length).toBe('guest:'.length + 32);
  });

  it('different emails produce different hashes', () => {
    expect(buildEntryKey({ type: 'guest', email: 'a@x.com' })).not.toBe(
      buildEntryKey({ type: 'guest', email: 'b@x.com' }),
    );
  });
});

describe('submitRsvp (guest)', () => {
  it('persists email/displayName/authMode and returns entryKey', async () => {
    seedEvent('e1');
    const res = await submitRsvp('e1', {
      type: 'guest',
      email: 'Guest@Ex.com',
      displayName: 'Guest One',
    });
    expect(res.entry.status).toBe('confirmed');
    expect(res.entry.email).toBe('Guest@Ex.com');
    expect(res.entry.displayName).toBe('Guest One');
    expect(res.entry.authMode).toBe('guest');
    expect(res.entryKey.startsWith('guest:')).toBe(true);

    const entry = await getUserRsvp('e1', res.entryKey);
    expect(entry?.status).toBe('confirmed');
  });

  it('rejects duplicate email in the same event (guest collision)', async () => {
    seedEvent('e2');
    await submitRsvp('e2', { type: 'guest', email: 'dup@x.com', displayName: 'A' });
    await expect(
      submitRsvp('e2', { type: 'guest', email: 'DUP@x.com', displayName: 'B' }),
    ).rejects.toThrow('already_rsvped');
  });

  it('rejects when a firebase entry already uses the same email', async () => {
    seedEvent('e3');
    await submitRsvp('e3', {
      type: 'firebase',
      uid: 'u1',
      email: 'shared@x.com',
      displayName: 'Fbase',
    });
    await expect(
      submitRsvp('e3', { type: 'guest', email: 'shared@x.com', displayName: 'Guest' }),
    ).rejects.toThrow('email_already_rsvped');
  });
});

describe('submitRsvp (firebase)', () => {
  it('persists with authMode=firebase and key prefixed with firebase:', async () => {
    seedEvent('e4');
    const res = await submitRsvp('e4', {
      type: 'firebase',
      uid: 'user-123',
      email: 'u@ex.com',
      displayName: 'U',
    });
    expect(res.entryKey).toBe('firebase:user-123');
    expect(res.entry.authMode).toBe('firebase');
  });

  it('claims a pre-existing guest entry with the same email instead of erroring', async () => {
    seedEvent('claim1');
    const guestRes = await submitRsvp('claim1', {
      type: 'guest',
      email: 'maria@ex.com',
      displayName: 'Maria Guest',
      plusOne: true,
      plusOneName: 'João',
    });
    const guestCreatedAt = guestRes.entry.createdAt;
    expect(guestRes.entryKey.startsWith('guest:')).toBe(true);

    const claimRes = await submitRsvp('claim1', {
      type: 'firebase',
      uid: 'maria-uid',
      email: 'Maria@Ex.com',
      displayName: 'Maria Account',
    });

    expect(claimRes.entryKey).toBe('firebase:maria-uid');
    expect(claimRes.entry.authMode).toBe('firebase');
    expect(claimRes.entry.status).toBe('confirmed');
    expect(claimRes.entry.plusOne).toBe(true);
    expect(claimRes.entry.plusOneName).toBe('João');
    expect(claimRes.entry.createdAt).toBe(guestCreatedAt);
    expect(claimRes.entry.displayName).toBe('Maria Account');

    // Old guest entry must be gone (no duplicate after claim)
    const oldGuest = await getUserRsvp('claim1', guestRes.entryKey);
    expect(oldGuest).toBeNull();
  });

  it('does not claim cancelled guest entries (lets fresh RSVP proceed)', async () => {
    seedEvent('claim2');
    const guestRes = await submitRsvp('claim2', {
      type: 'guest',
      email: 'cancelled@ex.com',
      displayName: 'C',
    });
    await import('../services/rsvpService').then((m) => m.cancelRsvp('claim2', guestRes.entryKey));

    const fresh = await submitRsvp('claim2', {
      type: 'firebase',
      uid: 'fresh-uid',
      email: 'cancelled@ex.com',
      displayName: 'Fresh',
    });
    expect(fresh.entryKey).toBe('firebase:fresh-uid');
    expect(fresh.entry.status).toBe('confirmed');
  });
});

describe('getAdminList — mixed guest + firebase', () => {
  it('returns guest entries with email/displayName from entry and firebase entries joined with users/', async () => {
    seedEvent('eA');
    // Seed a firebase user doc (for avatar / fallback email)
    store.users.set('uFb', {
      id: 'uFb',
      displayName: 'Firebase User',
      email: 'fb@ex.com',
      avatarUrl: 'https://pic/fb.png',
    });

    await submitRsvp('eA', {
      type: 'firebase', uid: 'uFb', email: 'fb@ex.com', displayName: 'Firebase User',
    });
    await submitRsvp('eA', {
      type: 'guest', email: 'guesty@ex.com', displayName: 'Guesty',
    });

    const list = await getAdminList('eA');
    expect(list).toHaveLength(2);

    const fb = list.find((e) => e.authMode === 'firebase');
    const gt = list.find((e) => e.authMode === 'guest');
    expect(fb?.email).toBe('fb@ex.com');
    expect(fb?.avatarUrl).toBe('https://pic/fb.png');
    expect(gt?.email).toBe('guesty@ex.com');
    expect(gt?.displayName).toBe('Guesty');
    expect(gt?.entryKey.startsWith('guest:')).toBe(true);
  });
});

