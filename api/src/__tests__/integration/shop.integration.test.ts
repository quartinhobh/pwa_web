/**
 * Shop Integration Tests — exercises Firestore composite queries so that
 * firestore-index-gen can discover the indexes they require.
 *
 * Minimalist by design: the only goal is to execute the queries once under
 * the emulator so the undocumented `/emulator/v1/.../indexUsage` endpoint
 * registers them. Body assertions are deliberately loose.
 */

import { describe, it, expect, beforeAll, beforeEach } from 'vitest';

const FIRESTORE_HOST = process.env.FIRESTORE_EMULATOR_HOST;
const SKIP = !FIRESTORE_HOST;
const PROJECT_ID = process.env.FIREBASE_PROJECT_ID ?? 'quartinho-emulator';

describe.skipIf(SKIP)('Shop Integration', () => {
  let adminDb: FirebaseFirestore.Firestore;

  beforeAll(async () => {
    const firebase = await import('../../config/firebase');
    adminDb = firebase.adminDb;
  });

  beforeEach(async () => {
    await fetch(
      `http://${FIRESTORE_HOST}/emulator/v1/projects/${PROJECT_ID}/databases/(default)/documents`,
      { method: 'DELETE' },
    );
  });

  it('listProducts(activeOnly=true) runs the composite query', async () => {
    const { listProducts } = await import('../../services/shopService');

    // Seed one product so ordering path is exercised.
    await adminDb.collection('products').doc('p1').set({
      id: 'p1',
      emoji: '🍺',
      name: 'Cerveja',
      description: '',
      price: 10,
      imageUrl: null,
      active: true,
      sortOrder: 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    const products = await listProducts(true);
    expect(Array.isArray(products)).toBe(true);
    expect(products.length).toBe(1);
  });
});
