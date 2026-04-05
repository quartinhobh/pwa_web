// Firebase Admin SDK initialization.
// Owner: architect (stub) / feature-builder (wiring). No business logic here.
//
// Supports two modes:
//   1. Production: service-account credentials from env vars.
//   2. Emulator: when FIREBASE_AUTH_EMULATOR_HOST / FIRESTORE_EMULATOR_HOST /
//      FIREBASE_DATABASE_EMULATOR_HOST are set, Admin SDK auto-detects them.
//      A projectId is still required — we fall back to 'quartinho-emulator'.

import {
  applicationDefault,
  cert,
  getApps,
  initializeApp,
  type App,
} from 'firebase-admin/app';
import { getAuth, type Auth } from 'firebase-admin/auth';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { getDatabase, type Database } from 'firebase-admin/database';

function buildApp(): App {
  const existing = getApps()[0];
  if (existing) return existing;

  const emulating =
    !!process.env.FIREBASE_AUTH_EMULATOR_HOST ||
    !!process.env.FIRESTORE_EMULATOR_HOST ||
    !!process.env.FIREBASE_DATABASE_EMULATOR_HOST;

  const projectId =
    process.env.FIREBASE_PROJECT_ID ??
    (emulating ? 'quartinho-emulator' : undefined);

  if (emulating) {
    return initializeApp({
      projectId,
      databaseURL:
        process.env.FIREBASE_DATABASE_URL ??
        `http://${process.env.FIREBASE_DATABASE_EMULATOR_HOST ?? '127.0.0.1:9000'}/?ns=${projectId}`,
    });
  }

  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (projectId && clientEmail && privateKey) {
    return initializeApp({
      credential: cert({ projectId, clientEmail, privateKey }),
      databaseURL: process.env.FIREBASE_DATABASE_URL,
    });
  }

  if (process.env.NODE_ENV === 'test') {
    // Inert stub app for unit tests that don't touch Firestore/Auth.
    return initializeApp({
      projectId: 'quartinho-test',
      databaseURL: 'http://127.0.0.1:9000/?ns=quartinho-test',
    });
  }

  return initializeApp({ credential: applicationDefault() });
}

const app: App = buildApp();

export const adminAuth: Auth = getAuth(app);
export const adminDb: Firestore = getFirestore(app);
export const adminRtdb: Database = getDatabase(app);
export const adminApp: App = app;
