// Votes route tests — P3-D.
// Validation tests (400s, 401s) run unconditionally via supertest.
// Transaction tests (revert + reapply) require FIRESTORE_EMULATOR_HOST.

import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { adminAuth, adminDb } from '../config/firebase';
import app from '../index';

const EMULATOR = !!process.env.FIRESTORE_EMULATOR_HOST;
const PROJECT_ID = process.env.GCLOUD_PROJECT ?? 'quartinho-emulator';

async function clearFirestore(): Promise<void> {
  const host = process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080';
  await fetch(
    `http://${host}/emulator/v1/projects/${PROJECT_ID}/databases/(default)/documents`,
    { method: 'DELETE' },
  );
}

async function clearAuth(): Promise<void> {
  const host = process.env.FIREBASE_AUTH_EMULATOR_HOST ?? '127.0.0.1:9099';
  await fetch(
    `http://${host}/emulator/v1/projects/${PROJECT_ID}/accounts`,
    { method: 'DELETE' },
  );
}

async function mintIdTokenForUid(uid: string): Promise<string> {
  const customToken = await adminAuth.createCustomToken(uid);
  const authHost = process.env.FIREBASE_AUTH_EMULATOR_HOST ?? '127.0.0.1:9099';
  const exchange = await fetch(
    `http://${authHost}/identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=fake-api-key`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: customToken, returnSecureToken: true }),
    },
  );
  const json = (await exchange.json()) as { idToken: string };
  return json.idToken;
}

async function createUser(label: string): Promise<{ uid: string; token: string }> {
  const user = await adminAuth.createUser({
    email: `${label}-${Date.now()}-${Math.random()}@example.com`,
    password: 'testpass123',
    displayName: label,
  });
  const token = await mintIdTokenForUid(user.uid);
  return { uid: user.uid, token };
}

// ── Validation tests — unconditional (no emulator needed) ────────────

describe('POST /votes/:eventId — validation', () => {
  it('401 when missing auth', async () => {
    const res = await request(app)
      .post('/votes/evt1')
      .send({ favoriteTrackId: 'a', leastLikedTrackId: 'b' });
    expect(res.status).toBe(401);
  });
});

// ── Transaction tests — emulator-gated ───────────────────────────────

describe.skipIf(!EMULATOR)('Votes API (emulator)', () => {
  beforeAll(async () => {
    await clearFirestore();
    await clearAuth();
  });

  beforeEach(async () => {
    await clearFirestore();
    await clearAuth();
  });

  it('POST rejects 400 when favoriteTrackId === leastLikedTrackId', async () => {
    const { token } = await createUser('u');
    const res = await request(app)
      .post('/votes/evt1')
      .set('Authorization', `Bearer ${token}`)
      .send({ favoriteTrackId: 't1', leastLikedTrackId: 't1' });
    expect(res.status).toBe(400);
  });

  it('POST rejects 400 when fields missing', async () => {
    const { token } = await createUser('u');
    const res = await request(app)
      .post('/votes/evt1')
      .set('Authorization', `Bearer ${token}`)
      .send({ favoriteTrackId: 't1' });
    expect(res.status).toBe(400);
  });

  it('first vote creates doc with count=1 for both tracks', async () => {
    const { uid, token } = await createUser('u');
    const res = await request(app)
      .post('/votes/evt1')
      .set('Authorization', `Bearer ${token}`)
      .send({ favoriteTrackId: 'tFav', leastLikedTrackId: 'tLeast' });
    expect(res.status).toBe(200);
    expect(res.body.favorites.tFav.count).toBe(1);
    expect(res.body.favorites.tFav.voterIds).toContain(uid);
    expect(res.body.leastLiked.tLeast.count).toBe(1);
    expect(res.body.leastLiked.tLeast.voterIds).toContain(uid);

    const doc = await adminDb.collection('votes').doc('evt1').get();
    expect(doc.exists).toBe(true);
  });

  it('second vote from same user reverts old counts and applies new ones', async () => {
    const { uid, token } = await createUser('u');
    await request(app)
      .post('/votes/evt1')
      .set('Authorization', `Bearer ${token}`)
      .send({ favoriteTrackId: 'tA', leastLikedTrackId: 'tB' });

    const res = await request(app)
      .post('/votes/evt1')
      .set('Authorization', `Bearer ${token}`)
      .send({ favoriteTrackId: 'tC', leastLikedTrackId: 'tD' });
    expect(res.status).toBe(200);
    // Old tracks removed (count fell to 0)
    expect(res.body.favorites.tA).toBeUndefined();
    expect(res.body.leastLiked.tB).toBeUndefined();
    // New tracks with count 1
    expect(res.body.favorites.tC.count).toBe(1);
    expect(res.body.favorites.tC.voterIds).toEqual([uid]);
    expect(res.body.leastLiked.tD.count).toBe(1);
  });

  it('GET /votes/:eventId returns full tallies publicly', async () => {
    const { token } = await createUser('u');
    await request(app)
      .post('/votes/evt1')
      .set('Authorization', `Bearer ${token}`)
      .send({ favoriteTrackId: 'tFav', leastLikedTrackId: 'tLeast' });

    const res = await request(app).get('/votes/evt1');
    expect(res.status).toBe(200);
    expect(res.body.favorites.tFav.count).toBe(1);
    expect(res.body.leastLiked.tLeast.count).toBe(1);
  });

  it('GET /votes/:eventId/user returns current user vote or null', async () => {
    const { token } = await createUser('u');
    const before = await request(app)
      .get('/votes/evt1/user')
      .set('Authorization', `Bearer ${token}`);
    expect(before.status).toBe(200);
    expect(before.body.vote).toBeNull();

    await request(app)
      .post('/votes/evt1')
      .set('Authorization', `Bearer ${token}`)
      .send({ favoriteTrackId: 'tA', leastLikedTrackId: 'tB' });

    const after = await request(app)
      .get('/votes/evt1/user')
      .set('Authorization', `Bearer ${token}`);
    expect(after.status).toBe(200);
    expect(after.body.vote.favoriteTrackId).toBe('tA');
    expect(after.body.vote.leastLikedTrackId).toBe('tB');
  });
});
