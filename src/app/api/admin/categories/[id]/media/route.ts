import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { managedMediaAccess, assertPublicPhoto } from '@/app/libs/managedMediaGuard';
import { handleError, createPublicError } from '@/app/libs/errorHandler';
import { validateGalleryOrder, nextCover } from '@/modules/media/gallery-policy';

async function guard(categoryId: string) {
  const category = await prisma.inventoryCategory.findUnique({
    where: { id: categoryId },
    select: { id: true, projectId: true },
  });
  if (!category) {
    return {
      error: NextResponse.json({ error: 'Category not found' }, { status: 404 }),
    } as const;
  }
  // Category media affects every unit sold as this type, so project-level
  // authority is required. Unit-only MC/self-listing access cannot rewrite it.
  return managedMediaAccess({ projectId: category.projectId });
}

/** Category gallery: one truthful representative photo collection per sellable room/villa type. */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const access = await guard(params.id);
  if ('error' in access) return access.error;
  const category = await prisma.inventoryCategory.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      name: true,
      projectId: true,
      coverMediaId: true,
      galleryMedia: {
        include: { media: true },
        orderBy: [{ sort: 'asc' }, { mediaId: 'asc' }],
      },
    },
  });
  return category
    ? NextResponse.json(category)
    : NextResponse.json({ error: 'Category not found' }, { status: 404 });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const access = await guard(params.id);
    if ('error' in access) return access.error;
    const { mediaAssetId, cover } = await req.json();
    if (typeof mediaAssetId !== 'string' || !mediaAssetId) {
      throw createPublicError('mediaAssetId is required', 400);
    }
    if (!await assertPublicPhoto(mediaAssetId, access.user.identityId, access.user.isAdmin)) {
      throw createPublicError('Use a non-encrypted public JPEG/PNG/WebP photo you uploaded.', 403);
    }

    await prisma.$transaction(async (tx) => {
      const [category, asset] = await Promise.all([
        tx.inventoryCategory.findUnique({ where: { id: params.id }, select: { id: true } }),
        tx.mediaAsset.findUnique({ where: { id: mediaAssetId }, select: { id: true, kind: true } }),
      ]);
      if (!category || !asset) throw createPublicError('not found', 404);
      if (asset.kind !== 'photo') {
        throw createPublicError('Only photo assets are allowed in a gallery', 400);
      }

      const count = await tx.inventoryCategoryMedia.count({
        where: { categoryId: params.id },
      });
      await tx.inventoryCategoryMedia.upsert({
        where: {
          categoryId_mediaId: { categoryId: params.id, mediaId: mediaAssetId },
        },
        create: { categoryId: params.id, mediaId: mediaAssetId, sort: count },
        update: {},
      });
      if (cover || count === 0) {
        await tx.inventoryCategory.update({
          where: { id: params.id },
          data: { coverMediaId: mediaAssetId },
        });
      }
    });

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    return handleError(error);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const access = await guard(params.id);
    if ('error' in access) return access.error;
    const body = await req.json();

    await prisma.$transaction(async (tx) => {
      const target = await tx.inventoryCategory.findUnique({
        where: { id: params.id },
        select: { id: true },
      });
      if (!target) throw createPublicError('Category not found', 404);

      const existing = await tx.inventoryCategoryMedia.findMany({
        where: { categoryId: params.id },
        select: { mediaId: true },
      });

      let order: ReturnType<typeof validateGalleryOrder>;
      try {
        order = validateGalleryOrder(
          existing.map((link) => link.mediaId),
          body.orderedMediaIds,
          body.coverMediaId
        );
      } catch (error) {
        throw createPublicError(
          error instanceof Error ? error.message : 'Invalid gallery order',
          400
        );
      }

      for (const [sort, mediaId] of order.ordered.entries()) {
        await tx.inventoryCategoryMedia.update({
          where: { categoryId_mediaId: { categoryId: params.id, mediaId } },
          data: { sort },
        });
      }

      if (order.cover !== undefined) {
        await tx.inventoryCategory.update({
          where: { id: params.id },
          data: { coverMediaId: order.cover },
        });
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleError(error);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const access = await guard(params.id);
    if ('error' in access) return access.error;
    const mediaId = req.nextUrl.searchParams.get('mediaId');
    if (!mediaId) throw createPublicError('mediaId is required', 400);

    await prisma.$transaction(async (tx) => {
      const link = await tx.inventoryCategoryMedia.findUnique({
        where: { categoryId_mediaId: { categoryId: params.id, mediaId } },
      });
      if (!link) throw createPublicError('Gallery photo not found', 404);

      await tx.inventoryCategoryMedia.delete({
        where: { categoryId_mediaId: { categoryId: params.id, mediaId } },
      });

      const category = await tx.inventoryCategory.findUnique({
        where: { id: params.id },
        select: { coverMediaId: true },
      });
      const remaining = await tx.inventoryCategoryMedia.findMany({
        where: { categoryId: params.id },
        select: { mediaId: true },
        orderBy: [{ sort: 'asc' }, { mediaId: 'asc' }],
      });
      const replacement = nextCover(
        category?.coverMediaId ?? null,
        mediaId,
        remaining
      );
      if (replacement !== category?.coverMediaId) {
        await tx.inventoryCategory.update({
          where: { id: params.id },
          data: { coverMediaId: replacement },
        });
      }
    });

    // Safe unlink: shared MediaAsset stays available to project/unit galleries.
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleError(error);
  }
}
