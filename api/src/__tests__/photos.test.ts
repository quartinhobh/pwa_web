// Photo route tests — P3-G.
// Auth/validation tests run unconditionally.
// Firestore/Storage-backed tests gated on FIRESTORE_EMULATOR_HOST.

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { adminAuth, adminDb } from '../config/firebase';
import app from '../index';

// Mock R2/S3 — no real object storage in CI.
vi.mock('../config/r2', () => ({
  R2_BUCKET: 'test-bucket',
  R2_ACCOUNT_ID: 'test-account',
  createR2Client: () => ({
    send: vi.fn().mockResolvedValue({}),
  }),
  getR2PublicUrl: (key: string) => `https://test-cdn.example.com/${key}`,
}));

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
  await fetch(`http://${host}/emulator/v1/projects/${PROJECT_ID}/accounts`, {
    method: 'DELETE',
  });
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

async function createUser(
  label: string,
  role: 'user' | 'moderator' | 'admin',
): Promise<{ uid: string; token: string }> {
  const user = await adminAuth.createUser({
    email: `${label}-${Date.now()}-${Math.random()}@example.com`,
    password: 'testpass123',
    displayName: label,
  });
  await adminDb.collection('users').doc(user.uid).set({
    id: user.uid,
    email: user.email ?? null,
    displayName: label,
    role,
    linkedSessionId: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });
  const token = await mintIdTokenForUid(user.uid);
  return { uid: user.uid, token };
}

// ── Unconditional auth/validation ───────────────────────────────────

describe('Photos — auth gates', () => {
  it('POST /photos/:id/category1/upload 401 without token', async () => {
    const res = await request(app).post('/photos/evt1/category1/upload');
    expect(res.status).toBe(401);
  });

  it('POST /photos/:id/category2/upload 401 without token', async () => {
    const res = await request(app).post('/photos/evt1/category2/upload');
    expect(res.status).toBe(401);
  });

  it('DELETE /photos/:id/:category/:photoId 401 without token', async () => {
    const res = await request(app).delete('/photos/evt1/category1/p1');
    expect(res.status).toBe(401);
  });

});

// ── Emulator-gated ──────────────────────────────────────────────────

describe.skipIf(!EMULATOR)('Photos API (emulator)', () => {
  beforeAll(async () => {
    await clearFirestore();
    await clearAuth();
  });

  beforeEach(async () => {
    await clearFirestore();
    await clearAuth();
  });

  const fakeJpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);

  it('POST upload — 403 for regular user', async () => {
    const { token } = await createUser('alice', 'user');
    const res = await request(app)
      .post('/photos/evt1/category1/upload')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', fakeJpeg, { filename: 'x.jpg', contentType: 'image/jpeg' });
    expect(res.status).toBe(403);
  });

  it('POST upload category1 — 201 for admin', async () => {
    const { token } = await createUser('admin', 'admin');
    const res = await request(app)
      .post('/photos/evt1/category1/upload')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', fakeJpeg, { filename: 'x.jpg', contentType: 'image/jpeg' });
    expect(res.status).toBe(201);
    expect(res.body.photo.category).toBe('category1');
    expect(res.body.photo.id).toBeDefined();
    expect(res.body.photo.url).toMatch(/category1/);
  });

  it('POST upload category2 — 201 for admin', async () => {
    const { token } = await createUser('admin', 'admin');
    const res = await request(app)
      .post('/photos/evt1/category2/upload')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', fakeJpeg, { filename: 'x.jpg', contentType: 'image/jpeg' });
    expect(res.status).toBe(201);
    expect(res.body.photo.category).toBe('category2');
  });

  it('POST upload — 400 when file missing', async () => {
    const { token } = await createUser('admin', 'admin');
    const res = await request(app)
      .post('/photos/evt1/category1/upload')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
  });

  it('POST upload — 400 on invalid category path', async () => {
    const { token } = await createUser('admin', 'admin');
    const res = await request(app)
      .post('/photos/evt1/category9/upload')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', fakeJpeg, { filename: 'x.jpg', contentType: 'image/jpeg' });
    expect(res.status).toBe(400);
  });

  it('DELETE — 403 for regular user', async () => {
    const { token } = await createUser('alice', 'user');
    const res = await request(app)
      .delete('/photos/evt1/category1/p1')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('DELETE — admin removes photo doc', async () => {
    const { token } = await createUser('admin', 'admin');
    await adminDb
      .collection('event_photos')
      .doc('evt1')
      .collection('category1')
      .doc('p1')
      .set({
        id: 'p1',
        url: 'https://example.com/evt1/category1/p1.jpg',
        category: 'category1',
        uploadedBy: 'admin',
        createdAt: 123,
      });
    const res = await request(app)
      .delete('/photos/evt1/category1/p1')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    const doc = await adminDb
      .collection('event_photos')
      .doc('evt1')
      .collection('category1')
      .doc('p1')
      .get();
    expect(doc.exists).toBe(false);
  });

  it('GET /photos/:id — merges both categories sorted desc', async () => {
    const base = adminDb.collection('event_photos').doc('evt1');
    await base
      .collection('category1')
      .doc('a')
      .set({
        id: 'a',
        url: 'u/a',
        category: 'category1',
        uploadedBy: 'admin',
        createdAt: 100,
      });
    await base
      .collection('category2')
      .doc('b')
      .set({
        id: 'b',
        url: 'u/b',
        category: 'category2',
        uploadedBy: 'admin',
        createdAt: 300,
      });
    await base
      .collection('category1')
      .doc('c')
      .set({
        id: 'c',
        url: 'u/c',
        category: 'category1',
        uploadedBy: 'admin',
        createdAt: 200,
      });
    const res = await request(app).get('/photos/evt1');
    expect(res.status).toBe(200);
    expect(res.body.photos.map((p: { id: string }) => p.id)).toEqual([
      'b',
      'c',
      'a',
    ]);
  });
});
