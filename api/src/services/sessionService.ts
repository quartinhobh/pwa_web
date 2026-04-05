// Session service — Firestore-backed.
// Owner: feature-builder. Pure domain logic; no HTTP concerns.

import { adminDb } from '../config/firebase';
import type { Session, SessionType, User, UserRole } from '../types';
import { generateGuestName } from '../utils/guestName';

const SESSIONS = 'sessions';
const USERS = 'users';

export async function createGuestSession(): Promise<Session> {
  const now = Date.now();
  const ref = adminDb.collection(SESSIONS).doc();
  const session: Session = {
    id: ref.id,
    userId: null,
    type: 'anonymous' satisfies SessionType,
    guestName: generateGuestName(),
    createdAt: now,
    lastActiveAt: now,
  };
  await ref.set(session);
  return session;
}

export async function getSession(sessionId: string): Promise<Session | null> {
  const snap = await adminDb.collection(SESSIONS).doc(sessionId).get();
  if (!snap.exists) return null;
  return snap.data() as Session;
}

export interface LinkResult {
  sessionId: string;
  userId: string;
}

/**
 * Link an existing guest session to an authenticated user.
 * - Creates the user doc if it doesn't exist.
 * - Migrates the session from anonymous -> authenticated.
 */
export async function linkSessionToUser(
  sessionId: string,
  uid: string,
  email: string | null,
  displayName: string | null,
): Promise<LinkResult> {
  const now = Date.now();
  const sessionRef = adminDb.collection(SESSIONS).doc(sessionId);
  const userRef = adminDb.collection(USERS).doc(uid);

  const [sessionSnap, userSnap] = await Promise.all([
    sessionRef.get(),
    userRef.get(),
  ]);

  if (!sessionSnap.exists) {
    throw new Error('session_not_found');
  }

  const existingSession = sessionSnap.data() as Session;
  const resolvedDisplayName =
    displayName ?? existingSession.guestName ?? 'user';

  if (!userSnap.exists) {
    const user: User = {
      id: uid,
      email: email ?? null,
      displayName: resolvedDisplayName,
      role: 'user' satisfies UserRole,
      linkedSessionId: sessionId,
      createdAt: now,
      updatedAt: now,
    };
    await userRef.set(user);
  } else {
    await userRef.update({
      linkedSessionId: sessionId,
      updatedAt: now,
    });
  }

  await sessionRef.update({
    userId: uid,
    type: 'authenticated' satisfies SessionType,
    lastActiveAt: now,
  });

  return { sessionId, userId: uid };
}
