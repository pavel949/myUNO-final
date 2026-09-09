import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { canWithAccess } from '@/modules/core/authority.service';
import { updateUnit, getUnitDetail } from '@/modules/projects';
import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';

async function loadUnitScope(unitId: string) {
  return prisma.unit.findUnique({
    where: { id: unitId },
    select: { id: true, projectId: true },
  });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const [identity, unitScope] = await Promise.all([
    prisma.identity.findUnique({ where: { id: user.identityId } }),
    loadUnitScope(params.id),
  ]);
  if (!identity) return NextResponse.json({ error: 'Identity not found' }, { status: 404 });
  if (!unitScope) return NextResponse.json({ error: 'Unit not found' }, { status: 404 });

  const allowed = await canWithAccess(prisma, {
    identity,
    action: 'units:edit_listing',
    requiredAccess: 'allow',
    resource: { projectId: unitScope.projectId, unitId: unitScope.id },
  });
  if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const body = await req.json();
    const updated = await updateUnit({
      unitId: params.id,
      ...body,
      actorIdentityId: user.identityId,
    });
    return NextResponse.json(updated);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to update unit' },
      { status: 400 }
    );
  }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const [identity, unitScope] = await Promise.all([
    prisma.identity.findUnique({ where: { id: user.identityId } }),
    loadUnitScope(params.id),
  ]);
  if (!identity) return NextResponse.json({ error: 'Identity not found' }, { status: 404 });
  if (!unitScope) return NextResponse.json({ error: 'Unit not found' }, { status: 404 });

  const allowed = await canWithAccess(prisma, {
    identity,
    action: 'units:view_full_record',
    requiredAccess: 'read',
    resource: { projectId: unitScope.projectId, unitId: unitScope.id },
  });
  if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const unit = await getUnitDetail(params.id);
    if (!unit) return NextResponse.json({ error: 'Unit not found' }, { status: 404 });
    return NextResponse.json(unit);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to fetch unit' },
      { status: 400 }
    );
  }
}
