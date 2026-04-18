import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { MEDIA_PRESIGNED_URL_EXPIRY_SECONDS } from '@penyzen/shared';

const s3 = new S3Client({ region: process.env['AWS_REGION'] ?? 'us-east-1' });
const MEDIA_BUCKET = process.env['S3_MEDIA_BUCKET'] ?? '';

export type AllowedMediaType = 'image/jpeg' | 'image/png' | 'image/webp' | 'video/mp4';

const ALLOWED_TYPES: AllowedMediaType[] = ['image/jpeg', 'image/png', 'image/webp', 'video/mp4'];
const MAX_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB

export function isAllowedMediaType(contentType: string): contentType is AllowedMediaType {
  return ALLOWED_TYPES.includes(contentType as AllowedMediaType);
}

/**
 * Generates a presigned S3 URL that allows the client to upload a media file
 * directly to S3 without the file passing through our Lambda.
 */
export async function generateMediaUploadUrl(
  campaignId: string,
  filename: string,
  contentType: AllowedMediaType,
): Promise<{ uploadUrl: string; publicUrl: string; key: string }> {
  // Sanitize filename: only allow alphanumeric, dots, dashes
  const sanitized = filename.replace(/[^a-zA-Z0-9.\-_]/g, '_').slice(0, 100);
  const timestamp = Date.now();
  const key = `campaigns/${campaignId}/media/${timestamp}-${sanitized}`;

  const command = new PutObjectCommand({
    Bucket: MEDIA_BUCKET,
    Key: key,
    ContentType: contentType,
    ContentLengthRange: [1, MAX_SIZE_BYTES],
    // Objects are private; served through CloudFront OAC
    ACL: 'private',
  } as Parameters<typeof PutObjectCommand>[0]);

  const uploadUrl = await getSignedUrl(s3, command, {
    expiresIn: MEDIA_PRESIGNED_URL_EXPIRY_SECONDS,
  });

  const cloudfrontDomain = process.env['CLOUDFRONT_DOMAIN'] ?? '';
  const publicUrl = `${cloudfrontDomain}/${key}`;

  return { uploadUrl, publicUrl, key };
}
