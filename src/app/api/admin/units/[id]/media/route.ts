import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { managedMediaAccess, assertPublicPhoto } from '@/app/libs/managedMediaGuard';
import { handleError, createPublicError } from '@/app/libs/errorHandler';
import { validateGalleryOrder, nextCover } from '@/modules/media/gallery-policy';

async function guard(id: string) {
  const unit = await prisma.unit.findUnique({ where: { id }, select: { id: true, projectId: true } });
  if (!unit) return { error: NextResponse.json({ error: 'Unit not found' }, { status: 404 }) } as const;
  return managedMediaAccess({ projectId: unit.projectId, unitId: unit.id });
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const access = await guard(params.id);
  if ('error' in access) return access.error;
  const target = await prisma.unit.findUnique({
    where: { id: params.id },
    select: { coverMediaId: true,
      media: { include: { media: true }, orderBy: [{ sort: 'asc' }, { mediaId: 'asc' }] },
    },
  });
  return target ? NextResponse.json(target) : NextResponse.json({ error: 'Unit not found' }, { status: 404 });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const access = await guard(params.id);
    if ('error' in access) return access.error;
    const { mediaAssetId, cover } = await req.json();
    if (typeof mediaAssetId !== 'string' || !mediaAssetId) {
      throw createPublicError('mediaAssetId is required', 400);
    }
    if (!await assertPublicPhoto(mediaAssetId, access.user.identityId, access.user.isAdmin))
      throw createPublicError('Use a non-encrypted photo you uploaded.', 403);
    await prisma.$transaction(async tx => {
      const [target, asset] = await Promise.all([
        tx.unit.findUnique({ where: { id: params.id }, select: { id: true } }),
        tx.mediaAsset.findUnique({ where: { id: mediaAssetId }, select: { id: true, kind: true } }),
      ]);
      if (!target || !asset) throw createPublicError('not found', 404);
      if (asset.kind !== 'photo') throw createPublicError('Only photo assets can join a gallery', 400);
      const count = await tx.unitMedia.count({ where: { unitId: params.id } });
      await tx.unitMedia.upsert({
        where: { unitId_mediaId: { unitId: params.id, mediaId: mediaAssetId } },
        create: { unitId: params.id, mediaId: mediaAssetId, sort: count },
        update: {},
      });
      if (cover || count === 0) await tx.unit.update({
        where: { id: params.id }, data: { coverMediaId: mediaAssetId },
      });
    });
    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) { return handleError(error); }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const access = await guard(params.id);
    if ('error' in access) return access.error;
    const body = await req.json();
    await prisma.$transaction(async tx => {
      const target = await tx.unit.findUnique({ where: { id: params.id }, select: { id: true } });
      if (!target) throw createPublicError('Unit not found', 404);
      const existing = await tx.unitMedia.findMany({
        where: { unitId: params.id }, select: { mediaId: true },
      });
      let order: ReturnType<typeof validateGalleryOrder>;
      try {
        order = validateGalleryOrder(existing.map(link => link.mediaId), body.orderedMediaIds, body.coverMediaId);
      } catch (error) {
        throw createPublicError(error instanceof Error ? error.message : 'Invalid gallery order', 400);
      }
      for (const [sort, mediaId] of order.ordered.entries()) {
        await tx.unitMedia.update({
          where: { unitId_mediaId: { unitId: params.id, mediaId } }, data: { sort },
        });
      }
      if (order.cover !== undefined) await tx.unit.update({
        where: { id: params.id }, data: { coverMediaId: order.cover },
      });
    });
    return NextResponse.json({ success: true });
  } catch (error) { return handleError(error); }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const access = await guard(params.id);
    if ('error' in access) return access.error;
    const mediaId = req.nextUrl.searchParams.get('mediaId');
    if (!mediaId) throw createPublicError('mediaId is required', 400);
    await prisma.$transaction(async tx => {
      const link = await tx.unitMedia.findUnique({
        where: { unitId_mediaId: { unitId: params.id, mediaId } },
      });
      if (!link) throw createPublicError('Photo not attached to this gallery', 404);
      await tx.unitMedia.delete({
        where: { unitId_mediaId: { unitId: params.id, mediaId } },
      });
      const target = await tx.unit.findUnique({
        where: { id: params.id }, select: { coverMediaId: true },
      });
      const remaining = await tx.unitMedia.findMany({
        where: { unitId: params.id }, select: { mediaId: true },
        orderBy: [{ sort: 'asc' }, { mediaId: 'asc' }],
      });
      const replacement = nextCover(target?.coverMediaId ?? null, mediaId, remaining);
      if (replacement !== target?.coverMediaId) await tx.unit.update({
        where: { id: params.id }, data: { coverMediaId: replacement },
      });
    });
    // Safe unlink: shared MediaAsset remains available in other galleries.
    return NextResponse.json({ success: true });
  } catch (error) { return handleError(error); }
}
