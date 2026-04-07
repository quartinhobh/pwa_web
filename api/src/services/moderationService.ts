// Moderation service — P3-F.
// Delete chat messages via Admin RTDB (soft delete: isDeleted=true).
// Ban / unban users via Firestore `bans/{userId}`.
// Every action writes a `moderation_logs` entry.

import { adminDb, adminRtdb } from '../config/firebase';
import type { Ban, ModerationAction, ModerationLog } from '../types';

const BANS = 'bans';
const LOGS = 'moderation_logs';

async function writeLog(entry: {
  action: ModerationAction;
  targetUserId: string;
  performedBy: string;
  eventId: string | null;
  messageId: string | null;
  reason: string | null;
}): Promise<void> {
  const now = Date.now();
  const ref = adminDb.collection(LOGS).doc();
  const log: ModerationLog = {
    id: ref.id,
    eventId: entry.eventId,
    action: entry.action,
    targetUserId: entry.targetUserId,
    performedBy: entry.performedBy,
    messageId: entry.messageId,
    reason: entry.reason,
    createdAt: now,
  };
  await ref.set(log);
}

export async function deleteMessage(
  eventId: string,
  messageId: string,
  performedBy: string,
  reason: string | null,
): Promise<void> {
  const path = `chats/${eventId}/messages/${messageId}`;
  const snap = await adminRtdb.ref(path).get();
  const existing = (snap.val() ?? {}) as { uid?: string };
  await adminRtdb.ref(`${path}/isDeleted`).set(true);
  await writeLog({
    action: 'delete_message',
    targetUserId: existing.uid ?? 'unknown',
    performedBy,
    eventId,
    messageId,
    reason,
  });
}

export async function banUser(
  userId: string,
  performedBy: string,
  eventId: string | null,
  reason: string | null,
): Promise<Ban> {
  const now = Date.now();
  const ban: Ban = {
    userId,
    bannedBy: performedBy,
    reason,
    createdAt: now,
    expiresAt: null,
  };
  await adminDb.collection(BANS).doc(userId).set(ban);
  // Mirror ban to RTDB so security rules can check /bans/{uid}
  await adminRtdb.ref(`bans/${userId}`).set(true);
  await writeLog({
    action: 'ban_user',
    targetUserId: userId,
    performedBy,
    eventId,
    messageId: null,
    reason,
  });
  return ban;
}

export async function unbanUser(
  userId: string,
  performedBy: string,
): Promise<void> {
  await adminDb.collection(BANS).doc(userId).delete();
  // Remove from RTDB mirror
  await adminRtdb.ref(`bans/${userId}`).remove();
  await writeLog({
    action: 'unban_user',
    targetUserId: userId,
    performedBy,
    eventId: null,
    messageId: null,
    reason: null,
  });
}

export async function listBans(): Promise<Ban[]> {
  const snap = await adminDb.collection(BANS).get();
  const now = Date.now();
  const out: Ban[] = [];
  snap.forEach((doc) => {
    const b = doc.data() as Ban;
    if (b.expiresAt === null || b.expiresAt > now) {
      out.push(b);
    }
  });
  return out;
}

export async function listLogs(
  limit: number,
  cursor?: number,
): Promise<ModerationLog[]> {
  let q = adminDb.collection(LOGS).orderBy('createdAt', 'desc').limit(limit);
  if (typeof cursor === 'number') {
    q = q.startAfter(cursor);
  }
  const snap = await q.get();
  return snap.docs.map((d) => d.data() as ModerationLog);
}
