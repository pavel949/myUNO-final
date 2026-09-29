import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/app/libs/onboardingGuard';
import { handleError, createPublicError } from '@/app/libs/errorHandler';

/** Category gallery: one reusable photo collection per room/villa type. */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.error;
  const category = await prisma.inventoryCategory.findUnique({
    where: { id: params.id },
    select: { id: true, name: true, projectId: true, coverMediaId: true,
      galleryMedia: { include: { media: true }, orderBy: [{ sort: 'asc' }, { mediaId: 'asc' }] } },
  });
  return category ? NextResponse.json(category) :
    NextResponse.json({ error: 'Category not found' }, { status: 404 });
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
      const [category, asset] = await Promise.all([
        tx.inventoryCategory.findUnique({ where: { id: params.id }, select: { id: true } }),
        tx.mediaAsset.findUnique({ where: { id: mediaAssetId }, select: { id: true, kind: true } }),
      ]);
      if (!category || !asset) throw createPublicError('not found', 404);
      if (asset.kind !== 'photo') throw createPublicError('Only photo assets are allowed in a gallery', 400);
      const count = await tx.inventoryCategoryMedia.count({ where: { categoryId: params.id } });
      await tx.inventoryCategoryMedia.upsert({
        where: { categoryId_mediaId: { categoryId: params.id, mediaId: mediaAssetId } },
        create: { categoryId: params.id, mediaId: mediaAssetId, sort: count },
        update: {},
      });
      if (cover || count === 0) await tx.inventoryCategory.update({
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
    if (!Array.isArray(body.orderedMediaIds) ||
        !body.orderedMediaIds.every((id: unknown) => typeof id === 'string') ||
        new Set(body.orderedMediaIds).size !== body.orderedMediaIds.length) {
      throw createPublicError('orderedMediaIds must be a unique array of IDs', 400);
    }
    await prisma.$transaction(async tx => {
      const existing = await tx.inventoryCategoryMedia.findMany({
        where: { categoryId: params.id }, select: { mediaId: true },
      });
      const ids = existing.map(row => row.mediaId);
      if (ids.length !== body.orderedMediaIds.length ||
          ids.some(id => !body.orderedMediaIds.includes(id))) {
        throw createPublicError('Gallery order must include exactly the attached photos', 400);
      }
      if (body.coverMediaId !== undefined &&
          body.coverMediaId !== null && !ids.includes(body.coverMediaId)) {
        throw createPublicError('Cover must belong to this gallery', 400);
      }
      for (const [sort, mediaId] of body.orderedMediaIds.entries()) {
        await tx.inventoryCategoryMedia.update({
          where: { categoryId_mediaId: { categoryId: params.id, mediaId } }, data: { sort },
        });
      }
      if (body.coverMediaId !== undefined) await tx.inventoryCategory.update({
        where: { id: params.id }, data: { coverMediaId: body.coverMediaId },
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
      const link = await tx.inventoryCategoryMedia.findUnique({
        where: { categoryId_mediaId: { categoryId: params.id, mediaId } },
      });
      if (!link) throw createPublicError('Gallery photo not found', 404);
      await tx.inventoryCategoryMedia.delete({
        where: { categoryId_mediaId: { categoryId: params.id, mediaId } },
      });
      const category = await tx.inventoryCategory.findUnique({
        where: { id: params.id }, select: { coverMediaId: true },
      });
      if (category?.coverMediaId === mediaId) {
        const first = await tx.inventoryCategoryMedia.findFirst({
          where: { categoryId: params.id }, orderBy: [{ sort: 'asc' }, { mediaId: 'asc' }],
        });
        await tx.inventoryCategory.update({
          where: { id: params.id }, data: { coverMediaId: first?.mediaId ?? null },
        });
      }
    });
    // Unlink only; the shared MediaAsset remains available to other galleries.
    return NextResponse.json({ success: true });
  } catch (error) { return handleError(error); }
}
