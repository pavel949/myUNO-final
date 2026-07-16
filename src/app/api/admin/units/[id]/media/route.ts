import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { handleError, createPublicError } from '@/app/libs/errorHandler';

/**
 * POST /api/admin/units/[id]/media — attach an uploaded MediaAsset to a
 * unit's gallery; { mediaAssetId, cover?: boolean } sets it as the cover.
 * Admin-only.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      throw createPublicError('unauthorized', 401);
    }
    if (!user.isAdmin) {
      throw createPublicError('Access denied.', 403);
    }

    const { mediaAssetId, cover } = await req.json();
    if (!mediaAssetId) {
      throw createPublicError('invalid request: mediaAssetId is required', 400);
    }

    const [unit, asset] = await Promise.all([
      prisma.unit.findUnique({ where: { id: params.id }, select: { id: true } }),
      prisma.mediaAsset.findUnique({ where: { id: mediaAssetId }, select: { id: true } }),
    ]);
    if (!unit || !asset) {
      throw createPublicError('not found', 404);
    }

    await prisma.unitMedia.upsert({
      where: { unitId_mediaId: { unitId: unit.id, mediaId: asset.id } },
      create: { unitId: unit.id, mediaId: asset.id, sort: 0 },
      update: {},
    });

    if (cover) {
      await prisma.unit.update({
        where: { id: unit.id },
        data: { coverMediaId: asset.id },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleError(error);
  }
}
