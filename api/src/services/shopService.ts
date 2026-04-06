import { adminDb } from '../config/firebase';
import type { PixConfig, Product } from '../types';

const PRODUCTS = 'products';
const CONFIG_DOC = 'config/pix';

// ── PIX Config ──────────────────────────────────────────────────────────

export async function getPixConfig(): Promise<PixConfig | null> {
  const snap = await adminDb.doc(CONFIG_DOC).get();
  if (!snap.exists) return null;
  return snap.data() as PixConfig;
}

export async function setPixConfig(config: PixConfig): Promise<PixConfig> {
  await adminDb.doc(CONFIG_DOC).set(config);
  return config;
}

// ── Products ────────────────────────────────────────────────────────────

export async function listProducts(activeOnly = false): Promise<Product[]> {
  let q = adminDb.collection(PRODUCTS).orderBy('sortOrder', 'asc');
  if (activeOnly) q = q.where('active', '==', true);
  const snap = await q.get();
  return snap.docs.map((d) => d.data() as Product);
}

export async function createProduct(
  data: Pick<Product, 'emoji' | 'name' | 'description' | 'price' | 'imageUrl'>,
): Promise<Product> {
  const now = Date.now();
  const ref = adminDb.collection(PRODUCTS).doc();
  const product: Product = {
    id: ref.id,
    emoji: data.emoji ?? '',
    name: data.name,
    description: data.description ?? '',
    price: data.price,
    imageUrl: data.imageUrl ?? null,
    active: true,
    sortOrder: Date.now(),
    createdAt: now,
    updatedAt: now,
  };
  await ref.set(product);
  return product;
}

export async function reorderProducts(orderedIds: string[]): Promise<void> {
  const batch = adminDb.batch();
  orderedIds.forEach((id, i) => {
    batch.update(adminDb.collection(PRODUCTS).doc(id), {
      sortOrder: i,
      updatedAt: Date.now(),
    });
  });
  await batch.commit();
}

export async function updateProduct(
  id: string,
  patch: Partial<Pick<Product, 'name' | 'price' | 'imageUrl' | 'active'>>,
): Promise<Product | null> {
  const ref = adminDb.collection(PRODUCTS).doc(id);
  const snap = await ref.get();
  if (!snap.exists) return null;
  await ref.update({ ...patch, updatedAt: Date.now() });
  const updated = await ref.get();
  return updated.data() as Product;
}

export async function deleteProduct(id: string): Promise<boolean> {
  const ref = adminDb.collection(PRODUCTS).doc(id);
  const snap = await ref.get();
  if (!snap.exists) return false;
  await ref.delete();
  return true;
}
