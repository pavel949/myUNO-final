import type { PrismaClient, MediaAssetKind } from '@prisma/client';

/**
 * Media storage seam (doc 14 media seam; MediaAsset schema doc 02 §2.5).
 *
 * Production: Vercel Blob (BLOB_READ_WRITE_TOKEN set) — storageKey is the
 * public blob URL. Development fallback: a data URI in storageKey, so the
 * app works with zero storage infrastructure (small images only).
 * Swapping to S3/R2 later means changing ONLY this file.
 */

const ALLOWED_IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']);
const ALLOWED_VIDEO_MIME_TYPES = new Set(['video/mp4', 'video/webm']);
export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024; // 8 MB images
export const MAX_VIDEO_UPLOAD_BYTES = 200 * 1024 * 1024; // direct-play MP4/WebM only

export interface StoreMediaInput {
  buffer: Buffer;
  mimeType: string;
  kind: MediaAssetKind;
  uploadedByIdentityId: string;
  fileName?: string;
}

export function isAllowedImageType(mimeType: string): boolean {
  return ALLOWED_IMAGE_MIME_TYPES.has(mimeType);
}

export function isAllowedVideoType(mimeType: string): boolean {
  return ALLOWED_VIDEO_MIME_TYPES.has(mimeType);
}

export function isAllowedMediaType(mimeType: string): boolean {
  return isAllowedImageType(mimeType) || isAllowedVideoType(mimeType);
}

async function putToStorage(
  buffer: Buffer,
  mimeType: string,
  fileName: string
): Promise<string> {
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const { put } = await import('@vercel/blob');
    const blob = await put(`media/${fileName}`, buffer, {
      access: 'public',
      contentType: mimeType,
      addRandomSuffix: true,
    });
    return blob.url;
  }

  // Dev fallback: data URI (no storage service required)
  return `data:${mimeType};base64,${buffer.toString('base64')}`;
}

/**
 * Store a media file and create its MediaAsset row.
 */
export async function storeMedia(db: PrismaClient, input: StoreMediaInput) {
  const { buffer, mimeType, kind, uploadedByIdentityId } = input;

  const video = input.kind === 'video';
  if (video ? !isAllowedVideoType(mimeType) : !isAllowedImageType(mimeType)) {
    throw new Error(`Unsupported media type: ${mimeType}`);
  }
  const maxBytes = video ? MAX_VIDEO_UPLOAD_BYTES : MAX_UPLOAD_BYTES;
  if (buffer.byteLength === 0 || buffer.byteLength > maxBytes) {
    throw new Error(`File size must be between 1 byte and ${maxBytes} bytes`);
  }
  if (video && !process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error('Video upload requires configured blob storage; data-URI fallback is intentionally disabled');
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
