import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/app/libs/onboardingGuard';
import { handleError, createPublicError } from '@/app/libs/errorHandler';
import { validateGalleryOrder, nextCover } from '@/modules/media/gallery-policy';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.error;
  const target = await prisma.project.findUnique({
    where: { id: params.id },
    select: { coverMediaId: true,
      galleryMedia: { include: { media: true }, orderBy: [{ sort: 'asc' }, { mediaId: 'asc' }] },
    },
  });
  return target ? NextResponse.json(target) : NextResponse.json({ error: 'Project not found' }, { status: 404 });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const guard = await requireAdmin();
    if (!guard.ok) return guard.error;
    const { mediaAssetId, cover } = await req.json();
    if (typeof mediaAssetId !== 'string' || !mediaAssetId) {
      throw createPublicError('mediaAssetId is required', 400);
    }
    await prisma.$transaction(async tx => {
      const [target, asset] = await Promise.all([
        tx.project.findUnique({ where: { id: params.id }, select: { id: true } }),
        tx.mediaAsset.findUnique({ where: { id: mediaAssetId }, select: { id: true, kind: true } }),
      ]);
      if (!target || !asset) throw createPublicError('not found', 404);
      if (asset.kind !== 'photo') throw createPublicError('Only photo assets can join a gallery', 400);
      const count = await tx.projectMedia.count({ where: { projectId: params.id } });
      await tx.projectMedia.upsert({
        where: { projectId_mediaId: { projectId: params.id, mediaId: mediaAssetId } },
        create: { projectId: params.id, mediaId: mediaAssetId, sort: count },
        update: {},
      });
      if (cover || count === 0) await tx.project.update({
        where: { id: params.id }, data: { coverMediaId: mediaAssetId },
      });
    });
    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) { return handleError(error); }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const guard = await requireAdmin();
    if (!guard.ok) return guard.error;
    const body = await req.json();
    await prisma.$transaction(async tx => {
      const target = await tx.project.findUnique({ where: { id: params.id }, select: { id: true } });
      if (!target) throw createPublicError('Project not found', 404);
      const existing = await tx.projectMedia.findMany({
        where: { projectId: params.id }, select: { mediaId: true },
      });
      let order: ReturnType<typeof validateGalleryOrder>;
      try {
        order = validateGalleryOrder(existing.map(link => link.mediaId), body.orderedMediaIds, body.coverMediaId);
      } catch (error) {
        throw createPublicError(error instanceof Error ? error.message : 'Invalid gallery order', 400);
      }
      for (const [sort, mediaId] of order.ordered.entries()) {
        await tx.projectMedia.update({
          where: { projectId_mediaId: { projectId: params.id, mediaId } }, data: { sort },
        });
      }
      if (order.cover !== undefined) await tx.project.update({
        where: { id: params.id }, data: { coverMediaId: order.cover },
      });
    });
    return NextResponse.json({ success: true });
  } catch (error) { return handleError(error); }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const guard = await requireAdmin();
    if (!guard.ok) return guard.error;
    const mediaId = req.nextUrl.searchParams.get('mediaId');
    if (!mediaId) throw createPublicError('mediaId is required', 400);
    await prisma.$transaction(async tx => {
      const link = await tx.projectMedia.findUnique({
        where: { projectId_mediaId: { projectId: params.id, mediaId } },
      });
      if (!link) throw createPublicError('Photo not attached to this gallery', 404);
      await tx.projectMedia.delete({
        where: { projectId_mediaId: { projectId: params.id, mediaId } },
      });
      const target = await tx.project.findUnique({
        where: { id: params.id }, select: { coverMediaId: true },
      });
      const remaining = await tx.projectMedia.findMany({
        where: { projectId: params.id }, select: { mediaId: true },
        orderBy: [{ sort: 'asc' }, { mediaId: 'asc' }],
      });
      const replacement = nextCover(target?.coverMediaId ?? null, mediaId, remaining);
      if (replacement !== target?.coverMediaId) await tx.project.update({
        where: { id: params.id }, data: { coverMediaId: replacement },
      });
    });
    // Safe unlink: shared MediaAsset remains available in other galleries.
    return NextResponse.json({ success: true });
  } catch (error) { return handleError(error); }
}
