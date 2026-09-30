import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/app/libs/onboardingGuard';
import { logAudit } from '@/modules/audit';
import { projectAmenityData } from '@/modules/projects';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.error;
  const project = await prisma.project.findUnique({ where: { id: params.id }, select: { id: true } });
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

  const amenities = await prisma.projectAmenity.findMany({
    where: { projectId: project.id },
    include: {
      coverMedia: { select: { storageKey: true } },
      media: {
        orderBy: [{ sort: 'asc' }, { mediaId: 'asc' }],
        include: { media: { select: { id: true, storageKey: true } } },
      },
    },
    orderBy: [{ sort: 'asc' }, { name: 'asc' }],
  });
  return NextResponse.json({ amenities });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.error;

  const project = await prisma.project.findUnique({ where: { id: params.id }, select: { id: true } });
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

  try {
    const body = await req.json();
    const data = projectAmenityData(body);
    const amenity = await prisma.projectAmenity.create({
      data: { ...data, projectId: project.id },
    });
    await logAudit({
      actorIdentityId: guard.actorIdentityId,
      action: 'project_amenity:create',
      entityType: 'ProjectAmenity',
      entityId: amenity.id,
      data: { projectId: project.id, slug: amenity.slug, name: amenity.name },
    });
    return NextResponse.json({ amenity }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not create amenity';
    const status = message.includes('Unique constraint') ? 409 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
