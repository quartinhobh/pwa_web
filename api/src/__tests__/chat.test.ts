// Chat config route tests — hit Firebase emulator. Skipped unless FIRESTORE_EMULATOR_HOST set.

import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { adminAuth, adminDb } from '../config/firebase';
import app from '../index';

const EMULATOR = !!process.env.FIRESTORE_EMULATOR_HOST;
if (!EMULATOR) {
  console.log('[chat.test] skipping: FIRESTORE_EMULATOR_HOST not set');
}

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

async function createUserWithRole(
  role: 'admin' | 'user',
): Promise<{ uid: string; token: string }> {
  const user = await adminAuth.createUser({
    email: `${role}-${Date.now()}-${Math.random()}@example.com`,
    password: 'testpass123',
    displayName: role,
  });
  await adminDb.collection('users').doc(user.uid).set({
    id: user.uid,
    email: user.email,
    displayName: role,
    role,
    linkedSessionId: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });
  const token = await mintIdTokenForUid(user.uid);
  return { uid: user.uid, token };
}

describe.skipIf(!EMULATOR)('Chat config API', () => {
  beforeAll(async () => {
    await clearFirestore();
    await clearAuth();
  });

  beforeEach(async () => {
    await clearFirestore();
    await clearAuth();
  });

  it('GET /chat/config returns default pauseAll=false', async () => {
    const res = await request(app).get('/chat/config');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ pauseAll: false });
  });

  it('PUT /chat/config requires auth', async () => {
    const res = await request(app).put('/chat/config').send({ pauseAll: true });
    expect(res.status).toBe(401);
  });

  it('PUT /chat/config forbids non-admin', async () => {
    const { token } = await createUserWithRole('user');
    const res = await request(app)
      .put('/chat/config')
      .set('Authorization', `Bearer ${token}`)
      .send({ pauseAll: true });
    expect(res.status).toBe(403);
  });

  it('PUT /chat/config rejects invalid body', async () => {
    const { token } = await createUserWithRole('admin');
    const res = await request(app)
      .put('/chat/config')
      .set('Authorization', `Bearer ${token}`)
      .send({ pauseAll: 'yes' });
    expect(res.status).toBe(400);
  });

  it('PUT /chat/config persists and GET reflects change', async () => {
    const { token } = await createUserWithRole('admin');
    const put = await request(app)
      .put('/chat/config')
      .set('Authorization', `Bearer ${token}`)
      .send({ pauseAll: true });
    expect(put.status).toBe(200);
    expect(put.body.pauseAll).toBe(true);

    const get = await request(app).get('/chat/config');
    expect(get.status).toBe(200);
    expect(get.body.pauseAll).toBe(true);
  });
});
