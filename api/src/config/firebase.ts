// Firebase Admin SDK initialization.
// Owner: architect (stub) / feature-builder (wiring). No business logic here.
//
// Credential resolution order (first match wins):
//   1. Emulator: FIREBASE_AUTH_EMULATOR_HOST / FIRESTORE_EMULATOR_HOST /
//      FIREBASE_DATABASE_EMULATOR_HOST set → no credentials needed.
//   2. FIREBASE_SERVICE_ACCOUNT_PATH → path to the service-account JSON
//      (e.g. ../private_key.json). Recommended for local dev.
//   3. FIREBASE_PROJECT_ID + FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY env
//      vars (useful for hosted deploys that only accept env).
//   4. GOOGLE_APPLICATION_CREDENTIALS via applicationDefault() (GCP runtime).

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
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
import { getStorage, type Storage } from 'firebase-admin/storage';

function buildApp(): App {
  const existing = getApps()[0];
  if (existing) return existing;

  // Preflight: real Firebase Admin pointed at the dedicated quartinho-preflight
  // project. Used by api/scripts/preflight.ts to exercise public routes against
  // real Firestore (which validates composite indexes, unlike the emulator).
  if (process.env.NODE_ENV === 'preflight') {
    const saJson = process.env.PREFLIGHT_FIREBASE_SERVICE_ACCOUNT;
    if (!saJson) {
      throw new Error(
        'PREFLIGHT_FIREBASE_SERVICE_ACCOUNT env var required when NODE_ENV=preflight',
      );
    }
    const sa = JSON.parse(saJson) as {
      project_id: string;
      client_email: string;
      private_key: string;
    };
    return initializeApp({
      credential: cert({
        projectId: sa.project_id,
        clientEmail: sa.client_email,
        privateKey: sa.private_key,
      }),
      databaseURL: `https://${sa.project_id}-default-rtdb.firebaseio.com`,
    });
  }

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

  // (2) Service-account JSON file on disk — recommended for local dev.
  const saPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  if (saPath) {
    const absolute = resolve(process.cwd(), saPath);
    const raw = readFileSync(absolute, 'utf8');
    const json = JSON.parse(raw) as {
      project_id: string;
      client_email: string;
      private_key: string;
    };
    return initializeApp({
      credential: cert({
        projectId: json.project_id,
        clientEmail: json.client_email,
        privateKey: json.private_key,
      }),
      databaseURL: process.env.FIREBASE_DATABASE_URL,
    });
  }

  // (3) Individual env vars (hosted deploys).
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
export const adminStorage: Storage = getStorage(app);
export const STORAGE_BUCKET: string =
  process.env.FIREBASE_STORAGE_BUCKET ??
  `${process.env.FIREBASE_PROJECT_ID ?? 'quartinho-emulator'}.appspot.com`;
export const adminApp: App = app;
