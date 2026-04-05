import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { getDatabase, type Database } from 'firebase/database';
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
  const raw = import.meta.env.VITE_FIREBASE_CONFIG;
  if (!raw) {
    throw new Error('VITE_FIREBASE_CONFIG env var is not set');
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
