import { randomUUID } from 'node:crypto';
import type { PrismaClient, MediaAssetKind } from '@prisma/client';
import { mediaStorageCredentials } from './storage-config';

/**
 * Media storage seam (doc 14 media seam; MediaAsset schema doc 02 §2.5).
 *
 * Production: Vercel Blob (BLOB_READ_WRITE_TOKEN set) — storageKey is the
 * public blob URL. Development fallback: a data URI in storageKey, so the
 * app works with zero storage infrastructure (small images only).
 * Swapping to S3/R2 later means changing ONLY this file.
 */

const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']);
export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024; // 8 MB

export interface StoreMediaInput {
  buffer: Buffer;
  mimeType: string;
  kind: MediaAssetKind;
  uploadedByIdentityId: string;
  fileName?: string;
}

export function isAllowedImageType(mimeType: string): boolean {
  return ALLOWED_MIME_TYPES.has(mimeType);
}

async function putToStorage(
  buffer: Buffer,
  mimeType: string,
  fileName: string
): Promise<string> {
  const { put } = await import('@vercel/blob');
  const credentials = mediaStorageCredentials();
  if (credentials?.mode === 'token') {
    const blob = await put(`media/${fileName}`, buffer, {
      access: 'public',
      contentType: mimeType,
      addRandomSuffix: true,
      token: credentials.token,
    });
    return blob.url;
  }

  // Vercel deployments receive a short-lived OIDC token automatically.
  // Use it with the configured canonical Blob store so production never
  // falls back to embedding image bytes in the database.
  if (credentials?.mode === 'oidc') {
    const blob = await put(`media/${fileName}`, buffer, {
      access: 'public',
      contentType: mimeType,
      addRandomSuffix: true,
      oidcToken: credentials.oidcToken,
      storeId: credentials.storeId,
    });
    return blob.url;
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('Durable media storage is not configured');
  }

  // Local-development fallback only. A URL fragment keeps each upload asset
  // distinct (including uploader ownership) without changing the image bytes.
  return `data:${mimeType};base64,${buffer.toString('base64')}#media-${randomUUID()}`;
}

/**
 * Store a media file and create its MediaAsset row.
 */
export async function storeMedia(db: PrismaClient, input: StoreMediaInput) {
  const { buffer, mimeType, kind, uploadedByIdentityId } = input;

  if (!isAllowedImageType(mimeType)) {
    throw new Error(`Unsupported media type: ${mimeType}`);
  }
  if (buffer.byteLength === 0 || buffer.byteLength > MAX_UPLOAD_BYTES) {
    throw new Error(`File size must be between 1 byte and ${MAX_UPLOAD_BYTES} bytes`);
  }

  const ext = mimeType === 'image/jpeg' ? 'jpg' : mimeType.split('/')[1].split('+')[0];
  const fileName = input.fileName?.replace(/[^a-zA-Z0-9._-]/g, '') || `upload.${ext}`;

  const storageKey = await putToStorage(buffer, mimeType, fileName);

  return db.mediaAsset.create({
    data: {
      storageKey,
      kind,
      mimeType,
      sizeBytes: buffer.byteLength,
      uploadedByIdentityId,
    },
  });
}

/**
 * Resolve a MediaAsset's public URL. storageKey already IS the URL
 * (blob URL, data URI, or an app-relative path like /demo/villa.svg).
 */
export function mediaUrl(storageKey: string): string {
  return storageKey;
}
