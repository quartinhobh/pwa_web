/**
 * LinkTree Integration Tests — exercises the composite query used by
 * GET /linktree/ so firestore-index-gen picks up the required index.
 */

import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import request from 'supertest';

const FIRESTORE_HOST = process.env.FIRESTORE_EMULATOR_HOST;
const SKIP = !FIRESTORE_HOST;
const PROJECT_ID = process.env.FIREBASE_PROJECT_ID ?? 'quartinho-emulator';

describe.skipIf(SKIP)('LinkTree Integration', () => {
  let adminDb: FirebaseFirestore.Firestore;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let app: any;

  beforeAll(async () => {
    const firebase = await import('../../config/firebase');
    adminDb = firebase.adminDb;
    app = (await import('../../index')).default;
  });

  beforeEach(async () => {
    await fetch(
      `http://${FIRESTORE_HOST}/emulator/v1/projects/${PROJECT_ID}/databases/(default)/documents`,
      { method: 'DELETE' },
    );
  });

  it('GET /linktree runs the active+sortOrder composite query', async () => {
    await adminDb.collection('linktree').doc('l1').set({
      id: 'l1',
      title: 'Instagram',
      url: 'https://instagram.com/quartinho',
      emoji: '📷',
      active: true,
      sortOrder: 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    const res = await request(app).get('/linktree/');
    expect(res.status).toBeLessThan(500);
    expect(res.body.links).toHaveLength(1);
  });
});
