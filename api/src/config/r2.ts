import { S3Client } from '@aws-sdk/client-s3';

export const R2_BUCKET = process.env.R2_BUCKET ?? 'qbh';
export const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID ?? '';
export const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID ?? 'minioadmin';
export const R2_SECRET_ACCESS_KEY =
  process.env.R2_SECRET_ACCESS_KEY ?? 'minioadmin';

const isLocal = !R2_ACCOUNT_ID;
const MINIO_ENDPOINT = process.env.MINIO_ENDPOINT ?? 'http://localhost:9002';

export function createR2Client(): S3Client {
  if (isLocal) {
    return new S3Client({
      region: 'us-east-1',
      endpoint: MINIO_ENDPOINT,
      forcePathStyle: true,
      credentials: {
        accessKeyId: R2_ACCESS_KEY_ID,
        secretAccessKey: R2_SECRET_ACCESS_KEY,
      },
    });
  }
  return new S3Client({
    region: 'auto',
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY,
    },
  });
}

const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL ?? MINIO_ENDPOINT;

export function getR2PublicUrl(key: string): string {
  if (isLocal) {
    return `${R2_PUBLIC_URL}/${R2_BUCKET}/${key}`;
  }
  // In production, R2_PUBLIC_URL MUST be set to either the bucket's public
  // r2.dev URL (e.g. https://pub-<hash>.r2.dev) or a custom domain. The S3
  // API endpoint (<account>.r2.cloudflarestorage.com) always requires SigV4
  // auth and will return "InvalidArgument / Authorization" for plain <img>
  // requests, so we never use it for public asset URLs.
  if (process.env.R2_PUBLIC_URL) {
    return `${process.env.R2_PUBLIC_URL.replace(/\/$/, '')}/${key}`;
  }
  return `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${R2_BUCKET}/${key}`;
}
