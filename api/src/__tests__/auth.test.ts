// Integration tests for P3-A auth routes.
// Hits the Firebase emulator suite — no mocks.
// Required env:
//   FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099
//   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080
//   FIREBASE_DATABASE_EMULATOR_HOST=127.0.0.1:9000
//   GCLOUD_PROJECT=quartinho-emulator

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { adminAuth, adminDb } from '../config/firebase';
import app from '../index';

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

const EMULATOR = !!process.env.FIRESTORE_EMULATOR_HOST;
if (!EMULATOR) {
   
  console.log('[auth.test] skipping: FIRESTORE_EMULATOR_HOST not set');
}

describe.skipIf(!EMULATOR)('POST /auth/guest', () => {
  beforeAll(async () => {
    await clearFirestore();
    await clearAuth();
  });

  beforeEach(async () => {
    await clearFirestore();
  });

  it('creates a guest session and returns sessionId + guestName', async () => {
    const res = await request(app).post('/auth/guest').send({});
    expect(res.status).toBe(200);
    expect(res.body).toBeDefined();
    expect(typeof res.body.sessionId).toBe('string');
    expect(res.body.sessionId.length).toBeGreaterThan(0);
    expect(typeof res.body.guestName).toBe('string');
    expect(res.body.guestName).toMatch(/^[a-z-]+$/);
    expect(res.body.type).toBe('anonymous');
  });

  it('persists the session document in Firestore', async () => {
    const res = await request(app).post('/auth/guest').send({});
    expect(res.status).toBe(200);
    const { sessionId } = res.body;
    const snap = await adminDb.collection('sessions').doc(sessionId).get();
    expect(snap.exists).toBe(true);
    const data = snap.data();
    expect(data?.type).toBe('anonymous');
    expect(data?.userId).toBeNull();
    expect(typeof data?.guestName).toBe('string');
    expect(typeof data?.createdAt).toBe('number');
    expect(typeof data?.lastActiveAt).toBe('number');
  });

  it('returns unique sessionIds on repeated calls', async () => {
    const a = await request(app).post('/auth/guest').send({});
    const b = await request(app).post('/auth/guest').send({});
    expect(a.body.sessionId).not.toEqual(b.body.sessionId);
  });
});

describe.skipIf(!EMULATOR)('POST /auth/link', () => {
  let uid: string;
  let idToken: string;
  let sessionId: string;

  beforeAll(async () => {
    await clearFirestore();
    await clearAuth();
  });

  beforeEach(async () => {
    await clearFirestore();
    await clearAuth();

    // Create a test user in the auth emulator and mint a custom token,
    // then exchange it for an ID token via the emulator REST endpoint.
    const user = await adminAuth.createUser({
      email: `tester-${Date.now()}@example.com`,
      password: 'testpass123',
      displayName: 'Tester',
    });
    uid = user.uid;
    const customToken = await adminAuth.createCustomToken(uid);

    const authHost = process.env.FIREBASE_AUTH_EMULATOR_HOST ?? '127.0.0.1:9099';
    const exchangeRes = await fetch(
      `http://${authHost}/identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=fake-api-key`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: customToken, returnSecureToken: true }),
      },
    );
    const exchanged = (await exchangeRes.json()) as { idToken: string };
    idToken = exchanged.idToken;

    // Create a guest session to link.
    const guestRes = await request(app).post('/auth/guest').send({});
    sessionId = guestRes.body.sessionId;
  });

  it('verifies ID token, migrates session, and creates user doc', async () => {
    const res = await request(app)
      .post('/auth/link')
      .set('Authorization', `Bearer ${idToken}`)
      .send({ sessionId });

    expect(res.status).toBe(200);
    expect(res.body.userId).toBe(uid);
    expect(res.body.sessionId).toBe(sessionId);

    // Session should now belong to uid.
    const sessionSnap = await adminDb.collection('sessions').doc(sessionId).get();
    expect(sessionSnap.exists).toBe(true);
    const sessionData = sessionSnap.data();
    expect(sessionData?.userId).toBe(uid);
    expect(sessionData?.type).toBe('authenticated');

    // User doc should exist with role 'user'.
    const userSnap = await adminDb.collection('users').doc(uid).get();
    expect(userSnap.exists).toBe(true);
    const userData = userSnap.data();
    expect(userData?.role).toBe('user');
    expect(userData?.linkedSessionId).toBe(sessionId);
    expect(typeof userData?.createdAt).toBe('number');
  });

  it('rejects missing bearer token with 401', async () => {
    const res = await request(app).post('/auth/link').send({ sessionId });
    expect(res.status).toBe(401);
  });

  it('rejects invalid bearer token with 401', async () => {
    const res = await request(app)
      .post('/auth/link')
      .set('Authorization', 'Bearer not-a-real-token')
      .send({ sessionId });
    expect(res.status).toBe(401);
  });

  it('returns 400 when sessionId is missing', async () => {
    const res = await request(app)
      .post('/auth/link')
      .set('Authorization', `Bearer ${idToken}`)
      .send({});
    expect(res.status).toBe(400);
  });
});

describe('GET /auth/me (unconditional)', () => {
  it('returns 401 without bearer token', async () => {
    const res = await request(app).get('/auth/me');
    expect(res.status).toBe(401);
  });

  it('returns 401 with invalid bearer token', async () => {
    const res = await request(app)
      .get('/auth/me')
      .set('Authorization', 'Bearer not-a-token');
    expect(res.status).toBe(401);
  });
});

describe.skipIf(!EMULATOR)('GET /auth/me (emulator)', () => {
  beforeEach(async () => {
    await clearFirestore();
    await clearAuth();
  });

  it('returns the linked user with role=user after /auth/link', async () => {
    const user = await adminAuth.createUser({
      email: `me-${Date.now()}@example.com`,
      password: 'testpass123',
      displayName: 'MeTester',
    });
    const customToken = await adminAuth.createCustomToken(user.uid);
    const authHost = process.env.FIREBASE_AUTH_EMULATOR_HOST ?? '127.0.0.1:9099';
    const exchange = await fetch(
      `http://${authHost}/identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=fake-api-key`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: customToken, returnSecureToken: true }),
      },
    );
    const { idToken } = (await exchange.json()) as { idToken: string };

    // Before linking, /me should still succeed with guest fallback.
    const beforeLink = await request(app)
      .get('/auth/me')
      .set('Authorization', `Bearer ${idToken}`);
    expect(beforeLink.status).toBe(200);
    expect(beforeLink.body.userId).toBe(user.uid);
    expect(beforeLink.body.role).toBe('guest');

    // Link creates the users/{uid} doc with role=user.
    const guestRes = await request(app).post('/auth/guest').send({});
    await request(app)
      .post('/auth/link')
      .set('Authorization', `Bearer ${idToken}`)
      .send({ sessionId: guestRes.body.sessionId });

    const afterLink = await request(app)
      .get('/auth/me')
      .set('Authorization', `Bearer ${idToken}`);
    expect(afterLink.status).toBe(200);
    expect(afterLink.body.userId).toBe(user.uid);
    expect(afterLink.body.role).toBe('user');
    expect(afterLink.body.displayName).toBe('MeTester');
  });
});

afterAll(async () => {
  // best-effort cleanup
});
