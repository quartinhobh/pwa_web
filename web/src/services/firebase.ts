import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';
import {
  getDatabase,
  connectDatabaseEmulator,
  type Database,
} from 'firebase/database';
import { getStorage, type FirebaseStorage } from 'firebase/storage';

interface FirebaseClientConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  databaseURL: string;
}

function loadConfig(): FirebaseClientConfig {
  const raw = import.meta.env.VITE_FIREBASE_CONFIG as string | undefined;
  if (!raw) {
    // Fallback stub so that unrelated tests that transitively import this file
    // don't crash during module init. Real app usage requires the env var.
    return {
      apiKey: 'stub',
      authDomain: 'stub.firebaseapp.com',
      projectId: 'stub',
      storageBucket: 'stub.appspot.com',
      messagingSenderId: '0',
      appId: 'stub',
      databaseURL: 'https://stub.firebaseio.com',
    };
  }
  try {
    return JSON.parse(raw) as FirebaseClientConfig;
  } catch (err) {
    throw new Error(`VITE_FIREBASE_CONFIG is not valid JSON: ${(err as Error).message}`);
  }
}

export const firebaseApp: FirebaseApp = initializeApp(loadConfig());
export const auth: Auth = getAuth(firebaseApp);
export const firestore: Firestore = getFirestore(firebaseApp);
export const realtimeDb: Database = getDatabase(firebaseApp);
export const storage: FirebaseStorage = getStorage(firebaseApp);

if (import.meta.env.VITE_USE_EMULATOR === 'true') {
  try {
    connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });
  } catch {
    // already connected
  }
  try {
    connectDatabaseEmulator(realtimeDb, 'localhost', 9000);
  } catch {
    // already connected
  }
}
