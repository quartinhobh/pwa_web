// Photo service — P3-G.
// Storage layout: event_photos/{eventId}/{category}/{photoId}.{ext}
// Firestore layout: event_photos/{eventId}/{category}/{photoId}
//
// listPhotos queries both category sub-collections, merges, and sorts by
// createdAt desc for the public archive view.

import { randomUUID } from 'node:crypto';
import { adminDb, adminStorage, STORAGE_BUCKET } from '../config/firebase';
import type { Photo, PhotoCategory } from '../types';

const EVENT_PHOTOS = 'event_photos';
const CATEGORIES: readonly PhotoCategory[] = ['category1', 'category2'] as const;

function extFromMime(mimeType: string): string {
  if (mimeType === 'image/jpeg' || mimeType === 'image/jpg') return 'jpg';
  if (mimeType === 'image/png') return 'png';
  if (mimeType === 'image/webp') return 'webp';
  return 'bin';
}

function photoDocRef(
  eventId: string,
  category: PhotoCategory,
  photoId: string,
): FirebaseFirestore.DocumentReference {
  return adminDb
    .collection(EVENT_PHOTOS)
    .doc(eventId)
    .collection(category)
    .doc(photoId);
}

export async function uploadPhoto(
  eventId: string,
  category: PhotoCategory,
  userId: string,
  fileBuffer: Buffer,
  mimeType: string,
): Promise<Photo> {
  const photoId = randomUUID();
  const ext = extFromMime(mimeType);
  const objectPath = `event_photos/${eventId}/${category}/${photoId}.${ext}`;

  const bucket = adminStorage.bucket(STORAGE_BUCKET);
  const file = bucket.file(objectPath);
  await file.save(fileBuffer, {
    contentType: mimeType,
    resumable: false,
    metadata: { metadata: { uploadedBy: userId, eventId, category } },
  });
  await file.makePublic().catch(() => {
    // swallow — emulator or private bucket; URL still constructed below.
  });

  const url = `https://storage.googleapis.com/${bucket.name}/${objectPath}`;
  const now = Date.now();
  const photo: Photo = {
    id: photoId,
    url,
    category,
    uploadedBy: userId,
    createdAt: now,
  };
  await photoDocRef(eventId, category, photoId).set(photo);
  return photo;
}

export async function deletePhoto(
  eventId: string,
  category: PhotoCategory,
  photoId: string,
): Promise<boolean> {
  const ref = photoDocRef(eventId, category, photoId);
  const snap = await ref.get();
  if (!snap.exists) return false;
  const data = snap.data() as Photo;

  // Best-effort Storage cleanup — URL suffix is the object path.
  try {
    const bucket = adminStorage.bucket(STORAGE_BUCKET);
    const marker = `/${bucket.name}/`;
    const idx = data.url.indexOf(marker);
    if (idx >= 0) {
      const objectPath = data.url.slice(idx + marker.length);
      await bucket.file(objectPath).delete({ ignoreNotFound: true });
    }
  } catch {
    // swallow — Firestore doc is the source of truth for the list view.
  }

  await ref.delete();
  return true;
}

export async function listPhotos(eventId: string): Promise<Photo[]> {
  const results: Photo[] = [];
  for (const category of CATEGORIES) {
    const snap = await adminDb
      .collection(EVENT_PHOTOS)
      .doc(eventId)
      .collection(category)
      .get();
    snap.forEach((doc) => {
      results.push(doc.data() as Photo);
    });
  }
  results.sort((a, b) => b.createdAt - a.createdAt);
  return results;
}
