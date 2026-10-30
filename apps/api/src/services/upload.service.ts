import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env } from '../config/env.js';

const s3 = new S3Client({
  region: env.S3_REGION || 'ap-south-1',
  credentials: {
    accessKeyId: env.S3_ACCESS_KEY || '',
    secretAccessKey: env.S3_SECRET_KEY || '',
  },
  // Disable SDK-level checksum injection — the browser fetch() cannot send
  // the x-amz-checksum-* headers that the SDK adds by default, which causes
  // a 403 SignatureDoesNotMatch when the presigned URL is used from the browser.
  requestChecksumCalculation: 'WHEN_REQUIRED',
  responseChecksumValidation: 'WHEN_REQUIRED',
});

export const UploadService = {
  async getPresignedUrl(fileName: string, contentType: string) {
    const key = `uploads/${Date.now()}-${fileName.replace(/\s+/g, '-')}`;

    const command = new PutObjectCommand({
      Bucket: env.S3_BUCKET || 'aurazone-uploads',
      Key: key,
      ContentType: contentType,
    });

    // unhoistableHeaders keeps Content-Type in the signed headers (not query string),
    // preventing a browser mismatch that causes 403 SignatureDoesNotMatch.
    const url = await getSignedUrl(s3, command, {
      expiresIn: 3600,
      unhoistableHeaders: new Set(['content-type']),
    });

    return {
      uploadUrl: url,
      publicUrl: `https://${env.S3_BUCKET}.s3.${env.S3_REGION}.amazonaws.com/${key}`,
    };
  },
};
