import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { updateUnit, getUnitDetail } from '@/modules/projects';
import { canWithAccess } from '@/modules/core/authority.service';
import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';

async function loadContext(unitId: string) {
  const user = await getCurrentUser();
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) } as const;

  const [identity, unit] = await Promise.all([
    prisma.identity.findUnique({ where: { id: user.identityId } }),
    prisma.unit.findUnique({ where: { id: unitId }, select: { id: true, projectId: true } }),
  ]);

  if (!identity) return { error: NextResponse.json({ error: 'Identity not found' }, { status: 404 }) } as const;
  if (!unit) return { error: NextResponse.json({ error: 'Unit not found' }, { status: 404 }) } as const;
  return { user, identity, unit } as const;
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const context = await loadContext(params.id);
  if ('error' in context) return context.error;

  const allowed = await canWithAccess(prisma, {
    identity: context.identity,
    action: 'units:edit_listing',
    requiredAccess: 'allow',
    resource: { projectId: context.unit.projectId, unitId: context.unit.id },
  });
  if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const body = await req.json();
    const updated = await updateUnit({
      unitId: params.id,
      ...body,
      actorIdentityId: context.user.identityId,
    });
    return NextResponse.json(updated);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to update unit' },
      { status: 400 }
    );
  }
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const context = await loadContext(params.id);
  if ('error' in context) return context.error;

  const allowed = await canWithAccess(prisma, {
    identity: context.identity,
    action: 'units:view_full_record',
    requiredAccess: 'read',
    resource: { projectId: context.unit.projectId, unitId: context.unit.id },
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
