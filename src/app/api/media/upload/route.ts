import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { storeMedia, isAllowedImageType, MAX_UPLOAD_BYTES } from '@/modules/media';
import { handleError, createPublicError } from '@/app/libs/errorHandler';
import { createDirectUploadService } from '@/modules/media/direct-upload.service';
import { DirectUploadError, readDirectUploadJson } from '@/modules/media/direct-upload.policy';
import { ContentProposalError } from '@/modules/onboarding/content-proposal.service';
import { ContentProposalValidationError } from '@/modules/onboarding/content-proposal.schema';

/**
 * POST /api/media/upload — multipart form with a `file` field (+ optional
 * `kind`, default photo). Auth required; images only; 8 MB cap.
 * JSON: authenticated, exact-content-target initiate/finalize protocol. File bytes
 * go directly to Blob. Legacy multipart remains compatible.
 * Finalization and legacy multipart return { mediaAssetId, url }.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      throw createPublicError('unauthorized', 401);
    }

    if (req.headers.get('content-type')?.split(';')[0].trim().toLowerCase() === 'application/json') {
      const result = await createDirectUploadService(prisma).execute(user.identityId, await readDirectUploadJson(req));
      return NextResponse.json(result, { status: 201, headers: { 'Cache-Control': 'no-store' } });
    }

    const form = await req.formData();
    const file = form.get('file');
    if (!(file instanceof File)) {
      throw createPublicError('invalid request: file field is required', 400);
    }
    if (!isAllowedImageType(file.type)) {
      throw createPublicError('invalid request: only JPEG/PNG/WebP/SVG images are allowed', 400);
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      throw createPublicError('invalid request: file too large (max 8 MB)', 400);
    }

    const kindRaw = String(form.get('kind') || 'photo');
    const kind = ['photo', 'avatar', 'brand'].includes(kindRaw)
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
    if (error instanceof DirectUploadError || error instanceof ContentProposalError) {
      return NextResponse.json({ error: error.message }, { status: error.status, headers: { 'Cache-Control': 'no-store' } });
    }
    if (error instanceof ContentProposalValidationError) {
      return NextResponse.json({ error: 'Invalid direct upload request.' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
    }
    return handleError(error);
  }
}
