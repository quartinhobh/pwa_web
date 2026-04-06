import { S3Client } from '@aws-sdk/client-s3';

export const R2_BUCKET = process.env.R2_BUCKET ?? 'qbh';
export const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID ?? '';
export const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID ?? 'minioadmin';
export const R2_SECRET_ACCESS_KEY =
  process.env.R2_SECRET_ACCESS_KEY ?? 'minioadmin';

export function createR2Client(): S3Client {
  return new S3Client({
    region: 'auto',
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY,
    },
  });
}

export function getR2PublicUrl(key: string): string {
  return `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${R2_BUCKET}/${key}`;
}
