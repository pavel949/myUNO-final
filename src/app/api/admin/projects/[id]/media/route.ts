import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/app/libs/onboardingGuard';
import { handleError, createPublicError } from '@/app/libs/errorHandler';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.error;
  const project = await prisma.project.findUnique({
    where: { id: params.id },
    select: { coverMediaId: true, galleryMedia: { include: { media: true }, orderBy: { sort: 'asc' } } },
  });
  return project ? NextResponse.json(project) : NextResponse.json({ error: 'not found' }, { status: 404 });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const guard = await requireAdmin();
    if (!guard.ok) return guard.error;
    const { mediaAssetId, cover } = await req.json();
    if (!mediaAssetId) throw createPublicError('invalid request: mediaAssetId is required', 400);
    await prisma.$transaction(async (tx) => {
      await tx.projectMedia.upsert({
        where: { projectId_mediaId: { projectId: params.id, mediaId: mediaAssetId } },
        create: { projectId: params.id, mediaId: mediaAssetId, sort: 0 },
        update: {},
      });
      if (cover) await tx.project.update({ where: { id: params.id }, data: { coverMediaId: mediaAssetId } });
    });
    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    return handleError(error);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const guard = await requireAdmin();
    if (!guard.ok) return guard.error;
    const body = await req.json();
    const orderedIds = Array.isArray(body.orderedMediaIds) ? body.orderedMediaIds : [];
    await prisma.$transaction([
      ...orderedIds.map((mediaId: string, sort: number) => prisma.projectMedia.update({ where: { projectId_mediaId: { projectId: params.id, mediaId } }, data: { sort } })),
      ...(body.coverMediaId ? [prisma.project.update({ where: { id: params.id }, data: { coverMediaId: body.coverMediaId } })] : []),
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
      await tx.projectMedia.delete({ where: { projectId_mediaId: { projectId: params.id, mediaId } } });
      const project = await tx.project.findUnique({ where: { id: params.id }, select: { coverMediaId: true } });
      if (project?.coverMediaId === mediaId) await tx.project.update({ where: { id: params.id }, data: { coverMediaId: null } });
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleError(error);
  }
}
