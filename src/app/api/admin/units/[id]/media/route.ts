import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/app/libs/onboardingGuard';
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
    const guard = await requireAdmin();
    if (!guard.ok) return guard.error;

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

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.error;
  const unit = await prisma.unit.findUnique({
    where: { id: params.id },
    select: {
      coverMediaId: true,
      media: { include: { media: true }, orderBy: { sort: 'asc' } },
    },
  });
  return unit ? NextResponse.json(unit) : NextResponse.json({ error: 'not found' }, { status: 404 });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const guard = await requireAdmin();
    if (!guard.ok) return guard.error;
    const body = await req.json();
    const orderedIds = Array.isArray(body.orderedMediaIds) ? body.orderedMediaIds : [];
    await prisma.$transaction([
      ...orderedIds.map((mediaId: string, sort: number) =>
        prisma.unitMedia.update({ where: { unitId_mediaId: { unitId: params.id, mediaId } }, data: { sort } })
      ),
      ...(body.coverMediaId ? [prisma.unit.update({ where: { id: params.id }, data: { coverMediaId: body.coverMediaId } })] : []),
    ]);
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleError(error);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const guard = await requireAdmin();
    if (!guard.ok) return guard.error;
    const mediaId = req.nextUrl.searchParams.get('mediaId');
    if (!mediaId) throw createPublicError('invalid request: mediaId is required', 400);
    await prisma.$transaction(async (tx) => {
      await tx.unitMedia.delete({ where: { unitId_mediaId: { unitId: params.id, mediaId } } });
      const unit = await tx.unit.findUnique({ where: { id: params.id }, select: { coverMediaId: true } });
      if (unit?.coverMediaId === mediaId) await tx.unit.update({ where: { id: params.id }, data: { coverMediaId: null } });
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleError(error);
  }
}
