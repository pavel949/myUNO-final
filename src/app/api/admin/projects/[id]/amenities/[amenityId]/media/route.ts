import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { managedMediaAccess, assertPublicPhoto } from '@/app/libs/managedMediaGuard';
import { handleError, createPublicError } from '@/app/libs/errorHandler';
import { validateGalleryOrder, nextCover } from '@/modules/media/gallery-policy';

async function guard(projectId: string, amenityId: string) {
  const amenity = await prisma.projectAmenity.findFirst({
    where: { id: amenityId, projectId },
    select: { id: true },
  });
  if (!amenity) return { error: NextResponse.json({ error: 'Amenity not found' }, { status: 404 }) } as const;
  return managedMediaAccess({ projectId });
}

export async function POST(req: NextRequest, { params }: { params: { id: string; amenityId: string } }) {
  try {
    const access = await guard(params.id, params.amenityId);
    if ('error' in access) return access.error;
    const { mediaAssetId, cover } = await req.json();
    if (typeof mediaAssetId !== 'string' || !mediaAssetId) {
      throw createPublicError('mediaAssetId is required', 400);
    }
    if (!await assertPublicPhoto(mediaAssetId, access.user.identityId, access.user.isAdmin)) {
      throw createPublicError('Use a non-encrypted photo you uploaded.', 403);
    }
    await prisma.$transaction(async tx => {
      const asset = await tx.mediaAsset.findUnique({
        where: { id: mediaAssetId }, select: { id: true, kind: true },
      });
      if (!asset || asset.kind !== 'photo') throw createPublicError('Only photo assets can join an amenity gallery', 400);
      const count = await tx.projectAmenityMedia.count({ where: { amenityId: params.amenityId } });
      await tx.projectAmenityMedia.upsert({
        where: { amenityId_mediaId: { amenityId: params.amenityId, mediaId: mediaAssetId } },
        create: { amenityId: params.amenityId, mediaId: mediaAssetId, sort: count },
        update: {},
      });
      if (cover || count === 0) {
        await tx.projectAmenity.update({ where: { id: params.amenityId }, data: { coverMediaId: mediaAssetId } });
      }
    });
    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    return handleError(error);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string; amenityId: string } }) {
  try {
    const access = await guard(params.id, params.amenityId);
    if ('error' in access) return access.error;
    const body = await req.json();
    await prisma.$transaction(async tx => {
      const existing = await tx.projectAmenityMedia.findMany({
        where: { amenityId: params.amenityId }, select: { mediaId: true },
      });
      let order: ReturnType<typeof validateGalleryOrder>;
      try {
        order = validateGalleryOrder(existing.map(row => row.mediaId), body.orderedMediaIds, body.coverMediaId);
      } catch (error) {
        throw createPublicError(error instanceof Error ? error.message : 'Invalid amenity gallery order', 400);
      }
      for (const [sort, mediaId] of order.ordered.entries()) {
        await tx.projectAmenityMedia.update({
          where: { amenityId_mediaId: { amenityId: params.amenityId, mediaId } },
          data: { sort },
        });
      }
      if (order.cover !== undefined) {
        await tx.projectAmenity.update({ where: { id: params.amenityId }, data: { coverMediaId: order.cover } });
      }
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleError(error);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string; amenityId: string } }) {
  try {
    const access = await guard(params.id, params.amenityId);
    if ('error' in access) return access.error;
    const mediaId = req.nextUrl.searchParams.get('mediaId');
    if (!mediaId) throw createPublicError('mediaId is required', 400);
    await prisma.$transaction(async tx => {
      const link = await tx.projectAmenityMedia.findUnique({
        where: { amenityId_mediaId: { amenityId: params.amenityId, mediaId } },
      });
      if (!link) throw createPublicError('Photo not attached to this amenity', 404);
      await tx.projectAmenityMedia.delete({
        where: { amenityId_mediaId: { amenityId: params.amenityId, mediaId } },
      });
      const amenity = await tx.projectAmenity.findUnique({
        where: { id: params.amenityId }, select: { coverMediaId: true },
      });
      const remaining = await tx.projectAmenityMedia.findMany({
        where: { amenityId: params.amenityId },
        select: { mediaId: true }, orderBy: [{ sort: 'asc' }, { mediaId: 'asc' }],
      });
      const replacement = nextCover(amenity?.coverMediaId ?? null, mediaId, remaining);
      if (replacement !== amenity?.coverMediaId) {
        await tx.projectAmenity.update({ where: { id: params.amenityId }, data: { coverMediaId: replacement } });
      }
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleError(error);
  }
}
