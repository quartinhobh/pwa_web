// RSVP service — Firestore-backed, single-doc per event (same pattern as voteService).
// Doc shape at `rsvps/{eventId}`:
//
//   {
//     entries:        { [entryKey]: RsvpEntry },
//     confirmedCount: number,
//     waitlistCount:  number,
//     updatedAt:      number
//   }
//
// entryKey format:
//   - `firebase:${uid}`                — authenticated user
//   - `guest:${sha256(email)[0..32]}`  — anonymous submission

import { createHash } from 'crypto';
import jsPDF from 'jspdf';
import { adminDb } from '../config/firebase';
import type {
  Event,
  RsvpAuthMode,
  RsvpConfig,
  RsvpDoc,
  RsvpEntry,
  RsvpStatus,
  RsvpSummary,
} from '../types';

const COLLECTION = 'rsvps';

// ── entryKey helpers ─────────────────────────────────────────────────

export type SubmitRsvpInput =
  | {
      type: 'firebase';
      uid: string;
      email: string;
      displayName: string;
      instagram?: string;
      plusOne?: boolean;
      plusOneName?: string;
    }
  | {
      type: 'guest';
      email: string;
      displayName: string;
      instagram?: string;
      plusOne?: boolean;
      plusOneName?: string;
    };

export function buildEntryKey(
  input: { type: 'firebase'; uid: string } | { type: 'guest'; email: string },
): string {
  if (input.type === 'firebase') return `firebase:${input.uid}`;
  const hash = createHash('sha256')
    .update(input.email.toLowerCase().trim())
    .digest('hex')
    .slice(0, 32);
  return `guest:${hash}`;
}

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
function oldestWaitlisted(doc: RsvpDoc): { entryKey: string; entry: RsvpEntry } | null {
  let oldest: { entryKey: string; entry: RsvpEntry } | null = null;
  for (const [key, entry] of Object.entries(doc.entries)) {
    if (entry.status !== 'waitlisted') continue;
    if (!oldest || entry.createdAt < oldest.entry.createdAt) {
      oldest = { entryKey: key, entry };
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

  // Fetch avatars for confirmed users (first 8). Only firebase entries have
  // a user doc to join against — guests contribute displayName directly.
  const confirmed = Object.entries(doc.entries)
    .filter(([, e]) => e.status === 'confirmed')
    .sort((a, b) => a[1].createdAt - b[1].createdAt)
    .slice(0, 8);

  const avatars: RsvpSummary['confirmedAvatars'] = [];
  const firebaseUidsToJoin: string[] = [];
  const orderedKeys: string[] = [];
  for (const [key, entry] of confirmed) {
    orderedKeys.push(key);
    if (key.startsWith('firebase:')) {
      firebaseUidsToJoin.push(key.slice('firebase:'.length));
    }
    avatars.push({
      id: key,
      displayName: entry.displayName || 'anônimo',
      avatarUrl: null,
    });
  }

  if (firebaseUidsToJoin.length > 0) {
    const userSnaps = await Promise.all(
      firebaseUidsToJoin.map((id) => adminDb.collection('users').doc(id).get()),
    );
    const userMap = new Map<string, { displayName?: string; avatarUrl?: string | null }>();
    for (const snap of userSnaps) {
      if (!snap.exists) continue;
      userMap.set(snap.id, snap.data() as { displayName?: string; avatarUrl?: string | null });
    }
    for (let i = 0; i < avatars.length; i++) {
      const key = orderedKeys[i]!;
      if (!key.startsWith('firebase:')) continue;
      const uid = key.slice('firebase:'.length);
      const u = userMap.get(uid);
      if (!u) continue;
      avatars[i] = {
        id: key,
        displayName: u.displayName ?? avatars[i]!.displayName,
        avatarUrl: u.avatarUrl ?? null,
      };
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
  entryKey: string,
): Promise<RsvpEntry | null> {
  const snap = await adminDb.collection(COLLECTION).doc(eventId).get();
  if (!snap.exists) return null;
  const doc = snap.data() as RsvpDoc;
  return doc.entries[entryKey] ?? null;
}

// ── Writes (transactional) ──────────────────────────────────────────

export interface SubmitRsvpResult {
  entry: RsvpEntry;
  entryKey: string;
}

/** Returns true if any existing (non-cancelled/rejected) entry in the doc matches the given email. */
function hasEmailCollision(doc: RsvpDoc, email: string, selfKey: string): boolean {
  const norm = email.toLowerCase().trim();
  if (!norm) return false;
  for (const [key, entry] of Object.entries(doc.entries)) {
    if (key === selfKey) continue;
    if (entry.status === 'cancelled' || entry.status === 'rejected') continue;
    if ((entry.email ?? '').toLowerCase().trim() === norm) return true;
  }
  return false;
}

export async function submitRsvp(
  eventId: string,
  input: SubmitRsvpInput,
): Promise<SubmitRsvpResult> {
  const eventRef = adminDb.collection('events').doc(eventId);
  const rsvpRef = adminDb.collection(COLLECTION).doc(eventId);

  const entryKey = buildEntryKey(
    input.type === 'firebase'
      ? { type: 'firebase', uid: input.uid }
      : { type: 'guest', email: input.email },
  );
  const authMode: RsvpAuthMode = input.type;
  const email = input.email.trim();
  const displayName = input.displayName.trim() || 'anônimo';

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

    // Claim flow: a logged-in user submitting with an email that matches a
    // pre-existing guest entry inherits that entry instead of erroring out.
    // Preserves status/+1/timestamps so Maria-as-guest becomes Maria-as-account
    // with no loss of position in the waitlist or confirmation.
    if (input.type === 'firebase') {
      const guestKey = buildEntryKey({ type: 'guest', email });
      const guestEntry = doc.entries[guestKey];
      if (
        guestEntry &&
        guestEntry.status !== 'cancelled' &&
        guestEntry.status !== 'rejected'
      ) {
        const claimedAt = Date.now();
        const claimed: RsvpEntry = {
          ...guestEntry,
          authMode: 'firebase',
          email,
          displayName: displayName || guestEntry.displayName,
          updatedAt: claimedAt,
        };
        delete doc.entries[guestKey];
        doc.entries[entryKey] = claimed;
        doc.updatedAt = claimedAt;
        tx.set(rsvpRef, doc);
        return { entry: claimed, entryKey };
      }
    }

    const existing = doc.entries[entryKey];
    if (existing && existing.status !== 'cancelled' && existing.status !== 'rejected') {
      throw new Error('already_rsvped');
    }

    if (hasEmailCollision(doc, email, entryKey)) {
      throw new Error('email_already_rsvped');
    }

    const wantsPlusOne = config.plusOneAllowed && !!input.plusOne;
    if (wantsPlusOne && !input.plusOneName?.trim()) {
      throw new Error('plus_one_requires_name');
    }
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
      plusOneName: wantsPlusOne ? (input.plusOneName?.trim() || null) : null,
      email,
      displayName,
      instagram: input.instagram?.trim() || null,
      authMode,
      createdAt: now,
      updatedAt: now,
    };

    doc.entries[entryKey] = entry;
    if (status === 'confirmed') doc.confirmedCount += wantsPlusOne ? 2 : 1;
    if (status === 'waitlisted') doc.waitlistCount += 1;
    doc.updatedAt = now;

    tx.set(rsvpRef, doc);
    return { entry, entryKey };
  });

  return result;
}

export interface CancelRsvpResult {
  promotedEntryKey: string | null;
}

export async function cancelRsvp(
  eventId: string,
  entryKey: string,
): Promise<CancelRsvpResult> {
  const rsvpRef = adminDb.collection(COLLECTION).doc(eventId);

  const result = await adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(rsvpRef);
    if (!snap.exists) throw new Error('no_rsvp');
    const doc = snap.data() as RsvpDoc;

    const entry = doc.entries[entryKey];
    if (!entry || entry.status === 'cancelled') throw new Error('not_rsvped');

    const wasConfirmed = entry.status === 'confirmed';
    const wasWaitlisted = entry.status === 'waitlisted';

    doc.entries[entryKey] = {
      ...entry,
      status: 'cancelled',
      updatedAt: Date.now(),
    };

    if (wasConfirmed) {
      const seats = entry.plusOne ? 2 : 1;
      doc.confirmedCount = Math.max(0, doc.confirmedCount - seats);
    }
    if (wasWaitlisted) doc.waitlistCount = Math.max(0, doc.waitlistCount - 1);

    // Auto-promote from waitlist if a confirmed spot opened
    let promotedEntryKey: string | null = null;
    if (wasConfirmed) {
      const next = oldestWaitlisted(doc);
      if (next) {
        doc.entries[next.entryKey] = {
          ...next.entry,
          status: 'confirmed',
          updatedAt: Date.now(),
        };
        doc.confirmedCount += next.entry.plusOne ? 2 : 1;
        doc.waitlistCount = Math.max(0, doc.waitlistCount - 1);
        promotedEntryKey = next.entryKey;
      }
    }

    doc.updatedAt = Date.now();
    tx.set(rsvpRef, doc);
    return { promotedEntryKey };
  });

  return result;
}

export async function updatePlusOne(
  eventId: string,
  entryKey: string,
  plusOne: boolean,
  plusOneName: string | null,
): Promise<RsvpEntry> {
  const rsvpRef = adminDb.collection(COLLECTION).doc(eventId);

  const result = await adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(rsvpRef);
    if (!snap.exists) throw new Error('no_rsvp');
    const doc = snap.data() as RsvpDoc;

    const entry = doc.entries[entryKey];
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
    const updated: RsvpEntry = {
      ...entry,
      plusOne,
      plusOneName: plusOne ? (plusOneName?.trim() || null) : null,
      updatedAt: Date.now(),
    };
    doc.entries[entryKey] = updated;

    // Adjust confirmedCount when +1 changes on a confirmed entry
    if (updated.status === 'confirmed') {
      if (plusOne && !hadPlusOne) doc.confirmedCount += 1;
      if (!plusOne && hadPlusOne) doc.confirmedCount = Math.max(0, doc.confirmedCount - 1);
    }

    doc.updatedAt = Date.now();
    tx.set(rsvpRef, doc);
    return updated;
  });

  return result;
}

// ── Admin actions ───────────────────────────────────────────────────

export async function approveOrReject(
  eventId: string,
  targetEntryKey: string,
  newStatus: 'confirmed' | 'rejected',
): Promise<RsvpEntry> {
  const rsvpRef = adminDb.collection(COLLECTION).doc(eventId);

  const result = await adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(rsvpRef);
    if (!snap.exists) throw new Error('no_rsvp');
    const doc = snap.data() as RsvpDoc;

    const entry = doc.entries[targetEntryKey];
    if (!entry) throw new Error('entry_not_found');

    // Only allow transitions from pending_approval or waitlisted
    if (entry.status !== 'pending_approval' && entry.status !== 'waitlisted') {
      throw new Error('invalid_transition');
    }

    const wasWaitlisted = entry.status === 'waitlisted';

    const updated: RsvpEntry = {
      ...entry,
      status: newStatus,
      updatedAt: Date.now(),
    };
    doc.entries[targetEntryKey] = updated;

    if (newStatus === 'confirmed') {
      doc.confirmedCount += 1;
      if (wasWaitlisted) doc.waitlistCount = Math.max(0, doc.waitlistCount - 1);
    } else if (newStatus === 'rejected') {
      if (wasWaitlisted) doc.waitlistCount = Math.max(0, doc.waitlistCount - 1);
    }

    doc.updatedAt = Date.now();
    tx.set(rsvpRef, doc);
    return updated;
  });

  return result;
}

/** Admin-initiated cancel for any entryKey. Mirrors cancelRsvp's auto-promote. */
export async function adminCancelRsvp(
  eventId: string,
  entryKey: string,
): Promise<CancelRsvpResult> {
  return cancelRsvp(eventId, entryKey);
}

/** Move a confirmed entry to the waitlist and auto-promote the oldest waitlisted entry. */
export async function moveToWaitlist(
  eventId: string,
  entryKey: string,
): Promise<{ promotedEntryKey: string | null }> {
  const rsvpRef = adminDb.collection(COLLECTION).doc(eventId);

  const result = await adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(rsvpRef);
    if (!snap.exists) throw new Error('no_rsvp');
    const doc = snap.data() as RsvpDoc;

    const entry = doc.entries[entryKey];
    if (!entry) throw new Error('entry_not_found');
    if (entry.status !== 'confirmed') throw new Error('invalid_transition');

    const seats = entry.plusOne ? 2 : 1;
    const now = Date.now();

    doc.entries[entryKey] = {
      ...entry,
      status: 'waitlisted',
      updatedAt: now,
    };
    doc.confirmedCount = Math.max(0, doc.confirmedCount - seats);
    doc.waitlistCount += 1;

    // Auto-promote oldest waitlisted (skipping the one we just moved).
    let promotedEntryKey: string | null = null;
    let oldest: { entryKey: string; entry: RsvpEntry } | null = null;
    for (const [key, e] of Object.entries(doc.entries)) {
      if (key === entryKey) continue;
      if (e.status !== 'waitlisted') continue;
      if (!oldest || e.createdAt < oldest.entry.createdAt) {
        oldest = { entryKey: key, entry: e };
      }
    }
    if (oldest) {
      doc.entries[oldest.entryKey] = {
        ...oldest.entry,
        status: 'confirmed',
        updatedAt: now,
      };
      doc.confirmedCount += oldest.entry.plusOne ? 2 : 1;
      doc.waitlistCount = Math.max(0, doc.waitlistCount - 1);
      promotedEntryKey = oldest.entryKey;
    }

    doc.updatedAt = now;
    tx.set(rsvpRef, doc);
    return { promotedEntryKey };
  });

  return result;
}

export interface AdminRsvpEntry extends RsvpEntry {
  entryKey: string;
  userId: string; // legacy alias: bare uid for firebase entries, entryKey otherwise
  avatarUrl: string | null;
}

export async function getAdminList(eventId: string): Promise<AdminRsvpEntry[]> {
  const snap = await adminDb.collection(COLLECTION).doc(eventId).get();
  if (!snap.exists) return [];
  const doc = snap.data() as RsvpDoc;

  const keys = Object.keys(doc.entries);
  if (!keys.length) return [];

  // Collect firebase uids that still need a user-doc join (for avatar).
  const firebaseUids: string[] = [];
  for (const key of keys) {
    const entry = doc.entries[key]!;
    if (entry.authMode === 'firebase' && key.startsWith('firebase:')) {
      firebaseUids.push(key.slice('firebase:'.length));
    }
  }

  const userMap = new Map<
    string,
    { displayName?: string; email?: string | null; avatarUrl?: string | null }
  >();
  if (firebaseUids.length) {
    const userSnaps = await Promise.all(
      firebaseUids.map((id) => adminDb.collection('users').doc(id).get()),
    );
    for (const uSnap of userSnaps) {
      if (!uSnap.exists) continue;
      userMap.set(uSnap.id, uSnap.data() as {
        displayName?: string;
        email?: string | null;
        avatarUrl?: string | null;
      });
    }
  }

  return keys
    .map<AdminRsvpEntry>((key) => {
      const entry = doc.entries[key]!;
      let displayName = entry.displayName || 'anônimo';
      let email: string = entry.email || '';
      let avatarUrl: string | null = null;

      if (entry.authMode === 'firebase' && key.startsWith('firebase:')) {
        const uid = key.slice('firebase:'.length);
        const user = userMap.get(uid);
        if (user) {
          displayName = user.displayName ?? displayName;
          email = email || user.email || '';
          avatarUrl = user.avatarUrl ?? null;
        }
      }

      return {
        ...entry,
        displayName,
        email,
        entryKey: key,
        userId: key.startsWith('firebase:') ? key.slice('firebase:'.length) : key,
        avatarUrl,
      };
    })
    .sort((a, b) => a.createdAt - b.createdAt);
}

function csvField(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Export RSVP entries as CSV.
 * Status values:
 *   - confirmed: RSVP confirmado
 *   - waitlisted: Aguardando lugar, na fila de espera
 *   - pending_approval: Aguardando aprovação manual
 *   - rejected: RSVP recusado
 *   - cancelled: RSVP cancelado
 */
export function exportCsv(entries: AdminRsvpEntry[]): string {
  const header = 'nome,email,instagram,status,plus_one,nome_acompanhante,auth_mode,data_rsvp';
  const rows = entries.map((e) => {
    const date = new Date(e.createdAt).toISOString();
    return [
      csvField(e.displayName),
      csvField(e.email ?? ''),
      csvField(e.instagram ?? ''),
      csvField(e.status),
      csvField(e.plusOne ? 'sim' : 'não'),
      csvField(e.plusOneName ?? ''),
      csvField(e.authMode),
      csvField(date),
    ].join(',');
  });
  return [header, ...rows].join('\n');
}

/**
 * Bulk import RSVPs from CSV/Excel import.
 * Each entry is created as a guest RSVP with confirmed status.
 * Duplicate emails (already in the event) are skipped.
 */
export async function bulkImportRsvp(
  eventId: string,
  entries: Array<{ displayName: string; email: string; plusOne?: boolean; plusOneName?: string | null }>,
): Promise<{ imported: number; skipped: number }> {
  const snap = await adminDb.collection('rsvps').doc(eventId).get();
  const doc = snap.exists ? (snap.data() as RsvpDoc) : { entries: {} as Record<string, RsvpEntry> };

  let imported = 0;
  let skipped = 0;

  // Check which emails already exist
  const existingEmails = new Set<string>();
  Object.values(doc.entries).forEach((entry) => {
    if (entry.email) {
      existingEmails.add(entry.email.toLowerCase().trim());
    }
  });

  const now = Date.now();
  const newEntries: Record<string, RsvpEntry> = {};

  for (const input of entries) {
    const emailKey = input.email.toLowerCase().trim();

    // Skip if email already exists
    if (existingEmails.has(emailKey)) {
      skipped += 1;
      continue;
    }

    // Generate a unique guest entry key using email hash
    const emailHash = createHash('sha256')
      .update(emailKey)
      .digest('hex')
      .slice(0, 16);
    const entryKey = `guest:${emailHash}`;

    // Skip if this guest entry key already exists (shouldn't happen with hash, but be safe)
    if (doc.entries[entryKey] || newEntries[entryKey]) {
      skipped += 1;
      continue;
    }

    newEntries[entryKey] = {
      displayName: input.displayName,
      email: input.email,
      status: 'confirmed',
      authMode: 'guest',
      createdAt: now,
      updatedAt: now,
      plusOne: !!input.plusOne,
      plusOneName: input.plusOneName ?? null,
    };

    existingEmails.add(emailKey);
    imported += 1;
  }

  // Write all new entries in a single batch
  if (imported > 0) {
    await adminDb.collection('rsvps').doc(eventId).update({
      entries: { ...doc.entries, ...newEntries },
    });
  }

  return { imported, skipped };
}

/** Generate PDF with confirmed RSVPs for printing using Puppeteer */
export async function exportPdf(
  entries: AdminRsvpEntry[],
  eventTitle: string,
  eventDate: string,
): Promise<Buffer> {
  const confirmed = entries.filter((e) => e.status === 'confirmed');

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  // Page dimensions
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 16;
  let yPos = margin;

  // ─── Title (Alfa Slab One equivalent) ────────────
  doc.setFont('courier', 'bold');
  doc.setFontSize(26);
  doc.setTextColor(40, 40, 40);
  doc.text(eventTitle, margin, yPos);
  yPos += 10;

  // ─── Header Info (Bitter equivalent) ──────────────
  doc.setFont('times', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(120, 120, 120);
  doc.text(
    `${eventDate} · Quartinho | Confirmados: ${confirmed.length}`,
    margin,
    yPos,
  );
  yPos += 5;

  // ─── Divider Line ────────────────────────────────
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.5);
  doc.line(margin, yPos, pageWidth - margin, yPos);
  yPos += 5;

  // ─── Attendees List (Bitter equivalent) ──────────
  const lineHeight = 5.5;

  doc.setFont('times', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(40, 40, 40);

  let attendeeNumber = 1;
  confirmed.forEach((entry) => {
    // Check page break
    if (yPos + lineHeight > pageHeight - margin - 15) {
      doc.addPage();
      yPos = margin;
    }

    // Build full line: "1. Name - email - instagram"
    let fullLine = `${attendeeNumber}. ${entry.displayName}`;
    if (entry.email) fullLine += ` - ${entry.email}`;
    if (entry.instagram) fullLine += ` - @${entry.instagram}`;
    if (entry.plusOne && !entry.plusOneName) fullLine += ' - está levando acompanhante sem nome ⚠️';

    // Attendee with contact info on same line
    doc.setFont('times', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(40, 40, 40);
    doc.text(fullLine, margin + 2, yPos, { maxWidth: pageWidth - margin * 2 - 4 });
    yPos += lineHeight;
    attendeeNumber++;

    // Plus-one if exists (as separate numbered entry)
    if (entry.plusOneName) {
      if (yPos + lineHeight > pageHeight - margin - 15) {
        doc.addPage();
        yPos = margin;
      }

      doc.setFont('times', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(40, 40, 40);
      const plusOneText = `${attendeeNumber}. ${entry.plusOneName}`;
      doc.text(plusOneText, margin + 2, yPos);
      yPos += lineHeight;
      attendeeNumber++;
    }
  });

  // ─── Footer ──────────────────────────────────────
  yPos = pageHeight - 10;
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  const footerText = `${new Date().toLocaleDateString('pt-BR')} · ${confirmed.length} confirmados`;
  doc.text(footerText, pageWidth / 2, yPos, { align: 'center' });

  // Return PDF as buffer
  return Buffer.from(doc.output('arraybuffer'));
}
