import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { managedMediaAccess, assertPublicPhoto } from '@/app/libs/managedMediaGuard';

async function guard(projectId: string) {
  const project = await prisma.project.findUnique({ where: { id: projectId }, select: { id: true } });
  if (!project) return { error: NextResponse.json({ error: 'Project not found' }, { status: 404 }) } as const;
  // Only project-scoped internal staff or admin may edit a complex-wide gallery.
  return managedMediaAccess({ projectId });
}
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const access = await guard(params.id);
  if ('error' in access) return access.error;
  const project = await prisma.project.findUnique({ where: { id: params.id },
    select: { coverMediaId: true, galleryMedia: { include: { media: true }, orderBy: { sort: 'asc' } } } });
  return NextResponse.json(project);
}
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const access = await guard(params.id);
  if ('error' in access) return access.error;
  try {
    const { mediaAssetId, cover } = await req.json();
    if (!await assertPublicPhoto(mediaAssetId, access.user.identityId, access.user.isAdmin))
      return NextResponse.json({ error: 'Use a non-encrypted photo you uploaded.' }, { status: 403 });
    await prisma.$transaction(async tx => {
      await tx.projectMedia.upsert({ where: { projectId_mediaId: { projectId: params.id, mediaId: mediaAssetId } },
        create: { projectId: params.id, mediaId: mediaAssetId, sort: 0 }, update: {} });
      if (cover === true) await tx.project.update({ where: { id: params.id }, data: { coverMediaId: mediaAssetId } });
    });
    return NextResponse.json({ success: true }, { status: 201 });
  } catch { return NextResponse.json({ error: 'Unable to attach photo' }, { status: 400 }); }
}
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const access = await guard(params.id);
  if ('error' in access) return access.error;
  try {
    const body = await req.json();
    const orderedIds: unknown = body.orderedMediaIds;
    if (!Array.isArray(orderedIds) || orderedIds.some(id => typeof id !== 'string') ||
        new Set(orderedIds).size !== orderedIds.length)
      return NextResponse.json({ error: 'Invalid image order' }, { status: 400 });
    const attached = await prisma.projectMedia.findMany({ where: { projectId: params.id }, select: { mediaId: true } });
    const ids = new Set(attached.map(m => m.mediaId));
    if (orderedIds.length !== ids.size || orderedIds.some(id => !ids.has(id)) ||
        (body.coverMediaId && !ids.has(body.coverMediaId)))
      return NextResponse.json({ error: 'Only attached photos can be reordered or selected as cover' }, { status: 400 });
    await prisma.$transaction([
      ...orderedIds.map((mediaId: string, sort: number) => prisma.projectMedia.update({
        where: { projectId_mediaId: { projectId: params.id, mediaId } }, data: { sort },
      })),
      ...(body.coverMediaId ? [prisma.project.update({ where: { id: params.id }, data: { coverMediaId: body.coverMediaId } })] : []),
    ]);
    return NextResponse.json({ success: true });
  } catch { return NextResponse.json({ error: 'Unable to reorder gallery' }, { status: 400 }); }
}
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const access = await guard(params.id);
  if ('error' in access) return access.error;
  const mediaId = req.nextUrl.searchParams.get('mediaId');
  if (!mediaId) return NextResponse.json({ error: 'mediaId is required' }, { status: 400 });
  try {
    await prisma.$transaction(async tx => {
      await tx.projectMedia.delete({ where: { projectId_mediaId: { projectId: params.id, mediaId } } });
      const project = await tx.project.findUnique({ where: { id: params.id }, select: { coverMediaId: true } });
      if (project?.coverMediaId === mediaId) await tx.project.update({ where: { id: params.id }, data: { coverMediaId: null } });
    });
    return NextResponse.json({ success: true });
  } catch { return NextResponse.json({ error: 'Unable to detach photo' }, { status: 400 }); }
}
