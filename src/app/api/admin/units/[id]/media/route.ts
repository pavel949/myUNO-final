import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { managedMediaAccess, assertPublicPhoto } from '@/app/libs/managedMediaGuard';

async function guard(id: string) {
  const unit = await prisma.unit.findUnique({ where: { id }, select: { id: true, projectId: true } });
  if (!unit) return { error: NextResponse.json({ error: 'Unit not found' }, { status: 404 }) } as const;
  return managedMediaAccess({ projectId: unit.projectId, unitId: unit.id });
}

// Same UnitMedia and Unit.coverMediaId consumed by the public unit card.
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const access = await guard(params.id);
  if ('error' in access) return access.error;
  const unit = await prisma.unit.findUnique({ where: { id: params.id },
    select: { coverMediaId: true, media: { include: { media: true }, orderBy: { sort: 'asc' } } } });
  return NextResponse.json(unit);
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const access = await guard(params.id);
  if ('error' in access) return access.error;
  try {
    const body = await req.json();
    if (!await assertPublicPhoto(body.mediaAssetId, access.user.identityId, access.user.isAdmin))
      return NextResponse.json({ error: 'Use a non-encrypted photo you uploaded.' }, { status: 403 });
    const unitId = params.id, mediaId = body.mediaAssetId as string;
    await prisma.$transaction(async tx => {
      await tx.unitMedia.upsert({
        where: { unitId_mediaId: { unitId, mediaId } }, create: { unitId, mediaId, sort: 0 }, update: {},
      });
      if (body.cover === true) await tx.unit.update({ where: { id: unitId }, data: { coverMediaId: mediaId } });
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
    const attached = await prisma.unitMedia.findMany({ where: { unitId: params.id }, select: { mediaId: true } });
    const ids = new Set(attached.map(m => m.mediaId));
    if (orderedIds.length !== ids.size || orderedIds.some(id => !ids.has(id)) ||
        (body.coverMediaId && !ids.has(body.coverMediaId)))
      return NextResponse.json({ error: 'Only attached photos can be reordered or selected as cover' }, { status: 400 });
    await prisma.$transaction([
      ...orderedIds.map((mediaId: string, sort: number) => prisma.unitMedia.update({
        where: { unitId_mediaId: { unitId: params.id, mediaId } }, data: { sort },
      })),
      ...(body.coverMediaId ? [prisma.unit.update({ where: { id: params.id }, data: { coverMediaId: body.coverMediaId } })] : []),
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
      await tx.unitMedia.delete({ where: { unitId_mediaId: { unitId: params.id, mediaId } } });
      const unit = await tx.unit.findUnique({ where: { id: params.id }, select: { coverMediaId: true } });
      if (unit?.coverMediaId === mediaId) await tx.unit.update({ where: { id: params.id }, data: { coverMediaId: null } });
    });
    return NextResponse.json({ success: true });
  } catch { return NextResponse.json({ error: 'Unable to detach photo' }, { status: 400 }); }
}
