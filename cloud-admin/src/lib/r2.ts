import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';

export const R2_PUBLIC_URL = process.env.CLOUDFLARE_R2_PUBLIC_URL ?? 'https://cdn.non-turn.com';

const r2Client = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.CLOUDFLARE_R2_ACCOUNT_ID ?? 'placeholder'}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID ?? 'placeholder',
    secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY ?? 'placeholder',
  },
});

const BUCKET_NAME = process.env.CLOUDFLARE_R2_BUCKET_NAME ?? 'signage';

export interface PresignedUrlResult {
  uploadUrl: string;
  fileId: string;
  publicUrl: string;
}

export async function generatePresignedUrl(
  filename: string,
  contentType: string,
): Promise<PresignedUrlResult> {
  const fileId = `img_${randomUUID().replace(/-/g, '').slice(0, 8)}`;
  const ext = filename.split('.').pop() ?? '';
  const key = ext ? `${fileId}.${ext}` : fileId;

  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    ContentType: contentType,
  });

  const uploadUrl = await getSignedUrl(r2Client, command, { expiresIn: 3600 });
  const publicUrl = `${R2_PUBLIC_URL}/${key}`;

  return { uploadUrl, fileId, publicUrl };
}

export async function getDownloadUrl(key: string): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  });
  return getSignedUrl(r2Client, command, { expiresIn: 3600 });
}
