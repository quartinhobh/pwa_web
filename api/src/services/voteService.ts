// Vote service — P3-D.
// Firestore transaction guarantees atomic "revert old vote + apply new vote"
// semantics. Doc shape lives at `votes/{eventId}`:
//
//   {
//     favorites:  { [trackId]: { count, voterIds[] } },
//     leastLiked: { [trackId]: { count, voterIds[] } },
//     userVotes:  { [userId]:  { favoriteTrackId, leastLikedTrackId, updatedAt } },
//     updatedAt:  number
//   }
//
// `userVotes` is stored alongside tallies so a single transaction read/write
// is sufficient to revert + reapply. The public `VoteTallies` response omits
// `userVotes` (read via GET /:eventId/user instead).

import { adminDb } from '../config/firebase';
import type { VoteBucket, VoteTallies, UserVote, VoteSubmission } from '../types';

const COLLECTION = 'votes';

interface VoteDoc {
  favorites: Record<string, VoteBucket>;
  leastLiked: Record<string, VoteBucket>;
  userVotes: Record<string, UserVote>;
  updatedAt: number;
}

function emptyDoc(): VoteDoc {
  return { favorites: {}, leastLiked: {}, userVotes: {}, updatedAt: 0 };
}

function decrement(
  buckets: Record<string, VoteBucket>,
  trackId: string,
  userId: string,
): void {
  const b = buckets[trackId];
  if (!b) return;
  b.voterIds = b.voterIds.filter((id) => id !== userId);
  b.count = Math.max(0, b.count - 1);
  if (b.count === 0 && b.voterIds.length === 0) {
    delete buckets[trackId];
  }
}

function increment(
  buckets: Record<string, VoteBucket>,
  trackId: string,
  userId: string,
): void {
  const b = buckets[trackId] ?? { count: 0, voterIds: [] };
  if (!b.voterIds.includes(userId)) {
    b.voterIds = [...b.voterIds, userId];
    b.count = b.count + 1;
  }
  buckets[trackId] = b;
}

export async function submitVote(
  eventId: string,
  userId: string,
  submission: Pick<VoteSubmission, 'favoriteTrackId' | 'leastLikedTrackId'>,
): Promise<VoteTallies> {
  const ref = adminDb.collection(COLLECTION).doc(eventId);
  const updated = await adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const doc: VoteDoc = snap.exists ? (snap.data() as VoteDoc) : emptyDoc();

    const prior = doc.userVotes[userId];
    if (prior) {
      decrement(doc.favorites, prior.favoriteTrackId, userId);
      decrement(doc.leastLiked, prior.leastLikedTrackId, userId);
    }

    increment(doc.favorites, submission.favoriteTrackId, userId);
    increment(doc.leastLiked, submission.leastLikedTrackId, userId);

    const now = Date.now();
    doc.userVotes[userId] = {
      favoriteTrackId: submission.favoriteTrackId,
      leastLikedTrackId: submission.leastLikedTrackId,
      updatedAt: now,
    };
    doc.updatedAt = now;

    tx.set(ref, doc);
    return doc;
  });

  return {
    favorites: updated.favorites,
    leastLiked: updated.leastLiked,
    updatedAt: updated.updatedAt,
  };
}

export async function getTallies(eventId: string): Promise<VoteTallies> {
  const snap = await adminDb.collection(COLLECTION).doc(eventId).get();
  if (!snap.exists) {
    return { favorites: {}, leastLiked: {}, updatedAt: 0 };
  }
  const data = snap.data() as VoteDoc;
  return {
    favorites: data.favorites ?? {},
    leastLiked: data.leastLiked ?? {},
    updatedAt: data.updatedAt ?? 0,
  };
}

export async function getUserVote(
  eventId: string,
  userId: string,
): Promise<UserVote | null> {
  const snap = await adminDb.collection(COLLECTION).doc(eventId).get();
  if (!snap.exists) return null;
  const data = snap.data() as VoteDoc;
  return data.userVotes?.[userId] ?? null;
}
