// Events route tests — hit Firebase emulator. Skipped unless FIRESTORE_EMULATOR_HOST set.

import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { adminAuth, adminDb } from '../config/firebase';
import app from '../index';

const EMULATOR = !!process.env.FIRESTORE_EMULATOR_HOST;
if (!EMULATOR) {
  // eslint-disable-next-line no-console
  console.log('[events.test] skipping: FIRESTORE_EMULATOR_HOST not set');
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

const samplePayload = {
  mbAlbumId: 'abc-123',
  title: 'Test Album',
  date: '2025-01-15',
  startTime: '20:00',
  endTime: '22:00',
  extras: { text: '', links: [], images: [] },
  spotifyPlaylistUrl: null,
};

describe.skipIf(!EMULATOR)('Events API', () => {
  beforeAll(async () => {
    await clearFirestore();
    await clearAuth();
  });

  beforeEach(async () => {
    await clearFirestore();
    await clearAuth();
  });

  it('GET /events returns empty list initially', async () => {
    const res = await request(app).get('/events');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.events)).toBe(true);
  });

  it('POST /events forbids guests (no auth)', async () => {
    const res = await request(app).post('/events').send(samplePayload);
    expect(res.status).toBe(401);
  });

  it('POST /events forbids non-admin users (403)', async () => {
    const { token } = await createUserWithRole('user');
    const res = await request(app)
      .post('/events')
      .set('Authorization', `Bearer ${token}`)
      .send(samplePayload);
    expect(res.status).toBe(403);
  });

  it('POST /events allows admin, then GET by id, PUT, DELETE', async () => {
    const { token } = await createUserWithRole('admin');

    const created = await request(app)
      .post('/events')
      .set('Authorization', `Bearer ${token}`)
      .send(samplePayload);
    expect(created.status).toBe(201);
    const id = created.body.event.id as string;
    expect(typeof id).toBe('string');

    const got = await request(app).get(`/events/${id}`);
    expect(got.status).toBe(200);
    expect(got.body.event.title).toBe('Test Album');

    const updated = await request(app)
      .put(`/events/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Renamed' });
    expect(updated.status).toBe(200);
    expect(updated.body.event.title).toBe('Renamed');

    const current = await request(app).get('/events/current');
    expect([200, 404]).toContain(current.status);

    const del = await request(app)
      .delete(`/events/${id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(del.status).toBe(204);

    const gone = await request(app).get(`/events/${id}`);
    expect(gone.status).toBe(404);
  });

  it('PUT /events/:id/spotify — admin sets valid URL, rejects bad ones', async () => {
    const { token } = await createUserWithRole('admin');
    const created = await request(app)
      .post('/events')
      .set('Authorization', `Bearer ${token}`)
      .send(samplePayload);
    const id = created.body.event.id as string;

    // Valid
    const ok = await request(app)
      .put(`/events/${id}/spotify`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        spotifyPlaylistUrl: 'https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M',
      });
    expect(ok.status).toBe(200);
    expect(ok.body.event.spotifyPlaylistUrl).toContain('open.spotify.com/playlist/');

    // Invalid URL
    const bad = await request(app)
      .put(`/events/${id}/spotify`)
      .set('Authorization', `Bearer ${token}`)
      .send({ spotifyPlaylistUrl: 'https://example.com/nope' });
    expect(bad.status).toBe(400);
  });
});

describe('PUT /events/:id/spotify (unconditional)', () => {
  it('rejects unauthenticated requests with 401', async () => {
    const res = await request(app)
      .put('/events/e1/spotify')
      .send({
        spotifyPlaylistUrl: 'https://open.spotify.com/playlist/abc123',
      });
    expect(res.status).toBe(401);
  });

  it('rejects invalid bearer token with 401', async () => {
    const res = await request(app)
      .put('/events/e1/spotify')
      .set('Authorization', 'Bearer nope')
      .send({
        spotifyPlaylistUrl: 'https://open.spotify.com/playlist/abc123',
      });
    expect(res.status).toBe(401);
  });
});
