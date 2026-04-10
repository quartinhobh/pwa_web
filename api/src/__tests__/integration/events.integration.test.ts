/**
 * Events Integration Tests — exercises the composite query used by
 * GET /events/current so firestore-index-gen picks up the required
 * `events (status, date)` index.
 *
 * The existing `events.test.ts` covers this at the route level but lives
 * outside `__tests__/integration/` and is therefore skipped by the
 * `test:integration` script used by check-indexes.sh.
 */

import { describe, it, expect, beforeAll, beforeEach } from 'vitest';

const FIRESTORE_HOST = process.env.FIRESTORE_EMULATOR_HOST;
const SKIP = !FIRESTORE_HOST;
const PROJECT_ID = process.env.FIREBASE_PROJECT_ID ?? 'quartinho-emulator';

describe.skipIf(SKIP)('Events Integration', () => {
  let adminDb: FirebaseFirestore.Firestore;

  beforeAll(async () => {
    const firebase = await import('../../config/firebase');
    adminDb = firebase.adminDb;
  });

  beforeEach(async () => {
    await fetch(
      `http://${FIRESTORE_HOST}/emulator/v1/projects/${PROJECT_ID}/databases/(default)/documents`,
      { method: 'DELETE' },
    );
  });

  it('getCurrentEvent runs the status+date composite query', async () => {
    const { getCurrentEvent } = await import('../../services/eventService');

    await adminDb.collection('events').doc('e1').set({
      id: 'e1',
      mbAlbumId: 'mb',
      title: 'Quartinho Test',
      date: '2026-05-15',
      startTime: '19:00',
      endTime: '22:00',
      location: null,
      status: 'upcoming',
      album: null,
      extras: { text: '', links: [], images: [] },
      spotifyPlaylistUrl: null,
      createdBy: 'admin1',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    const event = await getCurrentEvent();
    expect(event).not.toBeNull();
    expect(event?.id).toBe('e1');
  });
});
