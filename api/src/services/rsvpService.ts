// RSVP service — Firestore-backed, single-doc per event (same pattern as voteService).
// Doc shape at `rsvps/{eventId}`:
//
//   {
//     entries:        { [userId]: RsvpEntry },
//     confirmedCount: number,
//     waitlistCount:  number,
//     updatedAt:      number
//   }

import { adminDb } from '../config/firebase';
import type { Event, RsvpConfig, RsvpDoc, RsvpEntry, RsvpStatus, RsvpSummary } from '../types';

const COLLECTION = 'rsvps';

function emptyDoc(): RsvpDoc {
  return { entries: {}, confirmedCount: 0, waitlistCount: 0, updatedAt: 0 };
}

/** Effective confirmed headcount including +1 guests. */
function effectiveConfirmed(doc: RsvpDoc): number {
  let count = 0;
  for (const entry of Object.values(doc.entries)) {
    if (entry.status === 'confirmed') {
      count += entry.plusOne ? 2 : 1;
    }
  }
  return count;
}

function isWindowOpen(config: RsvpConfig): boolean {
  const now = Date.now();
  if (config.opensAt && now < config.opensAt) return false;
  if (config.closesAt && now > config.closesAt) return false;
  return true;
}

/** Find the oldest waitlisted entry. */
function oldestWaitlisted(doc: RsvpDoc): { userId: string; entry: RsvpEntry } | null {
  let oldest: { userId: string; entry: RsvpEntry } | null = null;
  for (const [userId, entry] of Object.entries(doc.entries)) {
    if (entry.status !== 'waitlisted') continue;
    if (!oldest || entry.createdAt < oldest.entry.createdAt) {
      oldest = { userId, entry };
    }
  }
  return oldest;
}

// ── Public reads ─────────────────────────────────────────────────────

export async function getRsvpSummary(eventId: string): Promise<RsvpSummary> {
  const [rsvpSnap, eventSnap] = await Promise.all([
    adminDb.collection(COLLECTION).doc(eventId).get(),
    adminDb.collection('events').doc(eventId).get(),
  ]);

  const event = eventSnap.exists ? (eventSnap.data() as Event) : null;
  const doc = rsvpSnap.exists ? (rsvpSnap.data() as RsvpDoc) : emptyDoc();

  // Fetch avatars for confirmed users (first 8)
  const confirmedIds = Object.entries(doc.entries)
    .filter(([, e]) => e.status === 'confirmed')
    .sort((a, b) => a[1].createdAt - b[1].createdAt)
    .slice(0, 8)
    .map(([id]) => id);

  const avatars: RsvpSummary['confirmedAvatars'] = [];
  if (confirmedIds.length > 0) {
    const userSnaps = await Promise.all(
      confirmedIds.map((id) => adminDb.collection('users').doc(id).get()),
    );
    for (const snap of userSnaps) {
      if (!snap.exists) continue;
      const u = snap.data() as { displayName?: string; avatarUrl?: string | null };
      avatars.push({
        id: snap.id,
        displayName: u.displayName ?? 'anônimo',
        avatarUrl: u.avatarUrl ?? null,
      });
    }
  }

  return {
    confirmedCount: doc.confirmedCount,
    waitlistCount: doc.waitlistCount,
    capacity: event?.rsvp?.capacity ?? null,
    confirmedAvatars: avatars,
  };
}

export async function getUserRsvp(
  eventId: string,
  userId: string,
): Promise<RsvpEntry | null> {
  const snap = await adminDb.collection(COLLECTION).doc(eventId).get();
  if (!snap.exists) return null;
  const doc = snap.data() as RsvpDoc;
  return doc.entries[userId] ?? null;
}

// ── Writes (transactional) ──────────────────────────────────────────

export interface SubmitRsvpResult {
  entry: RsvpEntry;
}

export async function submitRsvp(
  eventId: string,
  userId: string,
  opts: { plusOne?: boolean; plusOneName?: string },
): Promise<SubmitRsvpResult> {
  const eventRef = adminDb.collection('events').doc(eventId);
  const rsvpRef = adminDb.collection(COLLECTION).doc(eventId);

  const result = await adminDb.runTransaction(async (tx) => {
    const [eventSnap, rsvpSnap] = await Promise.all([
      tx.get(eventRef),
      tx.get(rsvpRef),
    ]);

    if (!eventSnap.exists) throw new Error('event_not_found');
    const event = eventSnap.data() as Event;
    const config = event.rsvp;
    if (!config?.enabled) throw new Error('rsvp_disabled');
    if (!isWindowOpen(config)) throw new Error('rsvp_closed');

    const doc: RsvpDoc = rsvpSnap.exists ? (rsvpSnap.data() as RsvpDoc) : emptyDoc();

    const existing = doc.entries[userId];
    if (existing && existing.status !== 'cancelled' && existing.status !== 'rejected') {
      throw new Error('already_rsvped');
    }

    const wantsPlusOne = config.plusOneAllowed && !!opts.plusOne;
    const seatsNeeded = wantsPlusOne ? 2 : 1;
    const now = Date.now();

    let status: RsvpStatus;
    if (config.approvalMode === 'manual') {
      status = 'pending_approval';
    } else if (config.capacity === null || effectiveConfirmed(doc) + seatsNeeded <= config.capacity) {
      status = 'confirmed';
    } else if (config.waitlistEnabled) {
      status = 'waitlisted';
    } else {
      throw new Error('event_full');
    }

    const entry: RsvpEntry = {
      status,
      plusOne: wantsPlusOne,
      plusOneName: wantsPlusOne ? (opts.plusOneName?.trim() || null) : null,
      createdAt: now,
      updatedAt: now,
    };

    doc.entries[userId] = entry;
    if (status === 'confirmed') doc.confirmedCount += 1;
    if (status === 'waitlisted') doc.waitlistCount += 1;
    doc.updatedAt = now;

    tx.set(rsvpRef, doc);
    return { entry };
  });

  return result;
}

export interface CancelRsvpResult {
  promotedUserId: string | null;
}

export async function cancelRsvp(
  eventId: string,
  userId: string,
): Promise<CancelRsvpResult> {
  const rsvpRef = adminDb.collection(COLLECTION).doc(eventId);

  const result = await adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(rsvpRef);
    if (!snap.exists) throw new Error('no_rsvp');
    const doc = snap.data() as RsvpDoc;

    const entry = doc.entries[userId];
    if (!entry || entry.status === 'cancelled') throw new Error('not_rsvped');

    const wasConfirmed = entry.status === 'confirmed';
    const wasWaitlisted = entry.status === 'waitlisted';

    entry.status = 'cancelled';
    entry.updatedAt = Date.now();
    doc.entries[userId] = entry;

    if (wasConfirmed) doc.confirmedCount = Math.max(0, doc.confirmedCount - 1);
    if (wasWaitlisted) doc.waitlistCount = Math.max(0, doc.waitlistCount - 1);

    // Auto-promote from waitlist if a confirmed spot opened
    let promotedUserId: string | null = null;
    if (wasConfirmed) {
      const next = oldestWaitlisted(doc);
      if (next) {
        next.entry.status = 'confirmed';
        next.entry.updatedAt = Date.now();
        doc.entries[next.userId] = next.entry;
        doc.confirmedCount += 1;
        doc.waitlistCount = Math.max(0, doc.waitlistCount - 1);
        promotedUserId = next.userId;
      }
    }

    doc.updatedAt = Date.now();
    tx.set(rsvpRef, doc);
    return { promotedUserId };
  });

  return result;
}

export async function updatePlusOne(
  eventId: string,
  userId: string,
  plusOne: boolean,
  plusOneName: string | null,
): Promise<RsvpEntry> {
  const rsvpRef = adminDb.collection(COLLECTION).doc(eventId);

  const result = await adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(rsvpRef);
    if (!snap.exists) throw new Error('no_rsvp');
    const doc = snap.data() as RsvpDoc;

    const entry = doc.entries[userId];
    if (!entry || entry.status === 'cancelled' || entry.status === 'rejected') {
      throw new Error('not_rsvped');
    }

    // If adding +1 to a confirmed entry, check capacity
    if (plusOne && !entry.plusOne && entry.status === 'confirmed') {
      const eventSnap = await tx.get(adminDb.collection('events').doc(eventId));
      const event = eventSnap.exists ? (eventSnap.data() as Event) : null;
      const capacity = event?.rsvp?.capacity;
      if (capacity !== null && capacity !== undefined && effectiveConfirmed(doc) + 1 > capacity) {
        throw new Error('event_full');
      }
    }

    const hadPlusOne = entry.plusOne;
    entry.plusOne = plusOne;
    entry.plusOneName = plusOne ? (plusOneName?.trim() || null) : null;
    entry.updatedAt = Date.now();
    doc.entries[userId] = entry;

    // Adjust confirmedCount when +1 changes on a confirmed entry
    if (entry.status === 'confirmed') {
      if (plusOne && !hadPlusOne) doc.confirmedCount += 1;
      if (!plusOne && hadPlusOne) doc.confirmedCount = Math.max(0, doc.confirmedCount - 1);
    }

    doc.updatedAt = Date.now();
    tx.set(rsvpRef, doc);
    return entry;
  });

  return result;
}

// ── Admin actions ───────────────────────────────────────────────────

export async function approveOrReject(
  eventId: string,
  targetUserId: string,
  newStatus: 'confirmed' | 'rejected',
): Promise<RsvpEntry> {
  const rsvpRef = adminDb.collection(COLLECTION).doc(eventId);

  const result = await adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(rsvpRef);
    if (!snap.exists) throw new Error('no_rsvp');
    const doc = snap.data() as RsvpDoc;

    const entry = doc.entries[targetUserId];
    if (!entry) throw new Error('entry_not_found');

    // Only allow transitions from pending_approval or waitlisted
    if (entry.status !== 'pending_approval' && entry.status !== 'waitlisted') {
      throw new Error('invalid_transition');
    }

    const wasWaitlisted = entry.status === 'waitlisted';

    entry.status = newStatus;
    entry.updatedAt = Date.now();
    doc.entries[targetUserId] = entry;

    if (newStatus === 'confirmed') {
      doc.confirmedCount += 1;
      if (wasWaitlisted) doc.waitlistCount = Math.max(0, doc.waitlistCount - 1);
    } else if (newStatus === 'rejected') {
      if (wasWaitlisted) doc.waitlistCount = Math.max(0, doc.waitlistCount - 1);
    }

    doc.updatedAt = Date.now();
    tx.set(rsvpRef, doc);
    return entry;
  });

  return result;
}

export interface AdminRsvpEntry extends RsvpEntry {
  userId: string;
  displayName: string;
  email: string | null;
  avatarUrl: string | null;
}

export async function getAdminList(eventId: string): Promise<AdminRsvpEntry[]> {
  const snap = await adminDb.collection(COLLECTION).doc(eventId).get();
  if (!snap.exists) return [];
  const doc = snap.data() as RsvpDoc;

  const userIds = Object.keys(doc.entries);
  if (!userIds.length) return [];

  const userSnaps = await Promise.all(
    userIds.map((id) => adminDb.collection('users').doc(id).get()),
  );

  const userMap = new Map<string, { displayName: string; email: string | null; avatarUrl: string | null }>();
  for (const uSnap of userSnaps) {
    if (!uSnap.exists) continue;
    const u = uSnap.data() as { displayName?: string; email?: string | null; avatarUrl?: string | null };
    userMap.set(uSnap.id, {
      displayName: u.displayName ?? 'anônimo',
      email: u.email ?? null,
      avatarUrl: u.avatarUrl ?? null,
    });
  }

  return userIds
    .map((userId) => {
      const entry = doc.entries[userId]!;
      const user = userMap.get(userId) ?? { displayName: 'anônimo', email: null, avatarUrl: null };
      return { ...entry, userId, ...user };
    })
    .sort((a, b) => a.createdAt - b.createdAt);
}

export function exportCsv(entries: AdminRsvpEntry[]): string {
  const header = 'nome,email,status,plus_one,nome_acompanhante,data_rsvp';
  const rows = entries.map((e) => {
    const date = new Date(e.createdAt).toISOString();
    const name = e.displayName.replace(/,/g, ' ');
    const email = e.email ?? '';
    const plusOneName = e.plusOneName?.replace(/,/g, ' ') ?? '';
    return `${name},${email},${e.status},${e.plusOne ? 'sim' : 'não'},${plusOneName},${date}`;
  });
  return [header, ...rows].join('\n');
}
