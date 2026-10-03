import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { storeMedia, isAllowedImageType, isAllowedVideoType, MAX_UPLOAD_BYTES, MAX_VIDEO_UPLOAD_BYTES } from '@/modules/media';
import { handleError, createPublicError } from '@/app/libs/errorHandler';

/**
 * POST /api/media/upload — multipart form with a `file` field (+ optional
 * `kind`, default photo). Auth required. Photos use the 8 MB image cap;
 * video accepts direct-play MP4/WebM and requires configured blob storage.
 * Returns { mediaAssetId, url }.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      throw createPublicError('unauthorized', 401);
    }

    const form = await req.formData();
    const file = form.get('file');
    if (!(file instanceof File)) {
      throw createPublicError('invalid request: file field is required', 400);
    }
    const kindRaw = String(form.get('kind') || 'photo');
    const isVideo = kindRaw === 'video';
    if (isVideo ? !isAllowedVideoType(file.type) : !isAllowedImageType(file.type)) {
      throw createPublicError(
        isVideo
          ? 'invalid request: video must be MP4 or WebM'
          : 'invalid request: only JPEG/PNG/WebP/SVG images are allowed',
        400
      );
    }
    const maxBytes = isVideo ? MAX_VIDEO_UPLOAD_BYTES : MAX_UPLOAD_BYTES;
    if (file.size > maxBytes) {
      throw createPublicError(`invalid request: file too large (max ${Math.round(maxBytes / 1024 / 1024)} MB)`, 400);
    }

    const kind = isVideo
      ? ('video' as const)
      : ['photo', 'avatar', 'brand'].includes(kindRaw)
        ? (kindRaw as 'photo' | 'avatar' | 'brand')
        : 'photo';

    const buffer = Buffer.from(await file.arrayBuffer());
    const asset = await storeMedia(prisma, {
      buffer,
      mimeType: file.type,
      kind,
      uploadedByIdentityId: user.identityId,
      fileName: file.name,
    });

    return NextResponse.json(
      { mediaAssetId: asset.id, url: asset.storageKey },
      { status: 201 }
    );
  } catch (error) {
    return handleError(error);
  }
}
