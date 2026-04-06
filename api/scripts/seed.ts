// Dev seed — creates first admin user + a sample event in the running emulator.
//
// Security posture:
//   - Credentials MUST come from env (SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD).
//     No fallback defaults — a missing var is a hard error.
//   - Refuses to run unless FIRESTORE_EMULATOR_HOST is set. This script is
//     dev-only and must never touch a real project.
//   - Password is never logged. Only the email + uid are echoed.
//   - Idempotent: safe to re-run. Existing admin is reused.
//
// Usage (from repo root):
//   cp .env.seed.example .env.seed   # then edit secrets — .env.seed is gitignored
//   bun run seed

import { adminAuth, adminDb } from '../src/config/firebase';
import type { Event, EventAlbumSnapshot, User } from '../src/types';
import { fetchAlbum } from '../src/services/musicbrainzService';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === '') {
    throw new Error(
      `[seed] missing required env var: ${name}. ` +
        `Copy .env.seed.example to .env.seed and fill it in.`,
    );
  }
  return value;
}

function validateEmail(email: string): void {
  // Minimal RFC-5321 style check — we only need to reject obvious garbage.
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error(`[seed] SEED_ADMIN_EMAIL is not a valid email address.`);
  }
}

function validatePassword(pw: string): void {
  if (pw.length < 12) {
    throw new Error(
      `[seed] SEED_ADMIN_PASSWORD too short (min 12 chars). ` +
        `Even for dev, use a real password so emulator data isn't trivially guessable.`,
    );
  }
}

const SAMPLE_EVENT_ID = 'seed-sample-event';

async function ensureAdminUser(
  email: string,
  password: string,
  displayName: string,
): Promise<string> {
  try {
    const existing = await adminAuth.getUserByEmail(email);
    console.log(`[seed] admin already exists: uid=${existing.uid}`);
    return existing.uid;
  } catch {
    // not found — create
  }
  const created = await adminAuth.createUser({
    email,
    password,
    displayName,
    emailVerified: true,
  });
  console.log(`[seed] created admin auth user: uid=${created.uid}`);
  return created.uid;
}

async function ensureUserDoc(
  uid: string,
  email: string,
  displayName: string,
): Promise<void> {
  const ref = adminDb.collection('users').doc(uid);
  const snap = await ref.get();
  const now = Date.now();
  if (snap.exists) {
    await ref.update({ role: 'admin', updatedAt: now });
    console.log(`[seed] users/${uid} role=admin (updated)`);
    return;
  }
  const user: User = {
    id: uid,
    email,
    displayName,
    role: 'admin',
    linkedSessionId: null,
    createdAt: now,
    updatedAt: now,
  };
  await ref.set(user);
  console.log(`[seed] users/${uid} created with role=admin`);
}

async function ensureSampleEvent(adminUid: string): Promise<void> {
  const ref = adminDb.collection('events').doc(SAMPLE_EVENT_ID);
  const snap = await ref.get();
  if (snap.exists) {
    console.log(`[seed] events/${SAMPLE_EVENT_ID} already exists`);
    return;
  }
  const now = Date.now();
  const today = new Date().toISOString().slice(0, 10);
  const mbid = '1834eae1-741b-3c03-9ca5-0df3decb43ea';

  // Snapshot MB data so the app never re-fetches.
  let album: EventAlbumSnapshot | null = null;
  try {
    const mb = await fetchAlbum(mbid);
    album = {
      albumTitle: mb.title,
      artistCredit: mb.artistCredit,
      coverUrl: `https://coverartarchive.org/release/${mb.id}/front-250`,
      tracks: mb.tracks,
    };
    console.log(`[seed] MB snapshot: ${mb.title} (${mb.tracks.length} tracks)`);
  } catch (err) {
    console.log(`[seed] MB fetch failed (snapshot will be null): ${(err as Error).message}`);
  }

  const event: Event = {
    id: SAMPLE_EVENT_ID,
    mbAlbumId: mbid,
    title: 'Sessão inaugural — OK Computer',
    date: today,
    startTime: '20:00',
    endTime: '22:00',
    location: 'Quartinho BH — Rua Exemplo, 123',
    status: 'live',
    album,
    extras: {
      text: 'Primeiro quartinho. Traz cerveja.',
      links: [],
      images: [],
    },
    spotifyPlaylistUrl: null,
    createdBy: adminUid,
    createdAt: now,
    updatedAt: now,
  };
  await ref.set(event);
  console.log(`[seed] events/${SAMPLE_EVENT_ID} created (status=live)`);
}

async function main(): Promise<void> {
  if (!process.env.FIRESTORE_EMULATOR_HOST) {
    throw new Error(
      '[seed] refusing to run without FIRESTORE_EMULATOR_HOST. This script is dev-only ' +
        'and must never touch a real Firebase project.',
    );
  }

  const email = requireEnv('SEED_ADMIN_EMAIL');
  const password = requireEnv('SEED_ADMIN_PASSWORD');
  const displayName = process.env.SEED_ADMIN_NAME ?? 'Quartinho Admin';

  validateEmail(email);
  validatePassword(password);

  console.log(
    `[seed] target: project=${process.env.FIREBASE_PROJECT_ID ?? 'quartinho-emulator'} ` +
      `firestore=${process.env.FIRESTORE_EMULATOR_HOST} ` +
      `auth=${process.env.FIREBASE_AUTH_EMULATOR_HOST ?? '(unset)'}`,
  );
  console.log(`[seed] admin email: ${email}`);

  const uid = await ensureAdminUser(email, password, displayName);
  await ensureUserDoc(uid, email, displayName);
  await ensureSampleEvent(uid);
  console.log('[seed] done.');
}

main().then(
  () => process.exit(0),
  (err: Error) => {
    // Intentionally print the message only — never the env vars or stack frames
    // that might include the password value.
    console.error(err.message);
    process.exit(1);
  },
);
