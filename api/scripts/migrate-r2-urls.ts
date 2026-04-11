/**
 * migrate-r2-urls — one-shot rewrite of stored R2 asset URLs from the legacy
 * S3 API endpoint to the public r2.dev URL.
 *
 * Context: an earlier revision of api/src/config/r2.ts returned
 *   https://<account>.r2.cloudflarestorage.com/<bucket>/<key>
 * as the "public" URL. That's actually the S3 API endpoint and requires
 * SigV4 on every request, so the browser's `<img src>` received an
 * InvalidArgument/Authorization XML error. The code fix (see r2.ts) makes
 * new uploads use the `R2_PUBLIC_URL` env var, but existing Firestore
 * documents still carry the broken URL persisted in their fields.
 *
 * This script rewrites those fields in place. It is idempotent: documents
 * already using the new URL prefix are skipped.
 *
 * Usage:
 *   FIREBASE_SERVICE_ACCOUNT_PATH=../private_key.json \
 *   R2_PUBLIC_URL=https://pub-xxxxx.r2.dev \
 *   R2_BUCKET=qbh \
 *   bun run api/scripts/migrate-r2-urls.ts [--dry-run]
 *
 * Pass --dry-run first to see what would change without writing anything.
 *
 * Collections and fields covered:
 *   users      — avatarUrl
 *   banners    — imageUrl
 *   products   — imageUrl
 *
 * If more image-bearing collections are added later, append a handler to
 * `handlers` below.
 */

import { adminDb } from '../src/config/firebase';

const DRY_RUN = process.argv.includes('--dry-run');
const OLD_PREFIX_RE = /^https:\/\/[^/]+\.r2\.cloudflarestorage\.com\/[^/]+\//;

const newPublicUrl = process.env.R2_PUBLIC_URL?.replace(/\/$/, '');
if (!newPublicUrl) {
  console.error('R2_PUBLIC_URL env var is required');
  process.exit(1);
}

interface FieldPatch {
  collection: string;
  field: string;
}

const handlers: FieldPatch[] = [
  { collection: 'users', field: 'avatarUrl' },
  { collection: 'banners', field: 'imageUrl' },
  { collection: 'products', field: 'imageUrl' },
];

function rewrite(url: string | null | undefined): string | null {
  if (typeof url !== 'string') return null;
  const match = OLD_PREFIX_RE.exec(url);
  if (!match) return null;
  const key = url.slice(match[0].length);
  return `${newPublicUrl!}/${key}`;
}

async function migrateCollection(
  collection: string,
  field: string,
): Promise<{ scanned: number; updated: number }> {
  const snap = await adminDb.collection(collection).get();
  let updated = 0;
  for (const doc of snap.docs) {
    const data = doc.data();
    const current = data[field] as unknown;
    const next = rewrite(current as string | null | undefined);
    if (next === null) continue;
    console.log(`  ${collection}/${doc.id}.${field}`);
    console.log(`    - ${String(current)}`);
    console.log(`    + ${next}`);
    if (!DRY_RUN) {
      await doc.ref.update({ [field]: next });
    }
    updated++;
  }
  return { scanned: snap.size, updated };
}

(async () => {
  console.log(
    `[migrate-r2-urls] ${DRY_RUN ? 'DRY RUN — no writes' : 'LIVE — will write'}`,
  );
  console.log(`[migrate-r2-urls] new prefix: ${newPublicUrl}`);
  console.log('');

  let totalScanned = 0;
  let totalUpdated = 0;
  for (const h of handlers) {
    console.log(`scanning ${h.collection}.${h.field} ...`);
    const { scanned, updated } = await migrateCollection(h.collection, h.field);
    totalScanned += scanned;
    totalUpdated += updated;
    console.log(`  ${scanned.toString()} docs, ${updated.toString()} rewritten`);
    console.log('');
  }

  console.log(
    `[migrate-r2-urls] done — ${totalScanned.toString()} docs scanned, ${totalUpdated.toString()} ${DRY_RUN ? 'would be' : ''} rewritten`,
  );
  process.exit(0);
})().catch((err: unknown) => {
  console.error('[migrate-r2-urls] FAILED:', err);
  process.exit(1);
});
