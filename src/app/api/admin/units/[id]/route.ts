import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { updateUnit, getUnitDetail } from '@/modules/projects';
import { can } from '@/modules/core';
import { prisma } from '@/lib/prisma';
import { hasManagedUnitMcAccess } from '@/app/libs/projectScope';
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

  const allowed = await can({
    identity: context.identity,
    action: 'units:edit_listing',
    requiredAccess: 'allow',
    resource: { projectId: context.unit.projectId, unitId: context.unit.id },
  });
  if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const isMc = context.user.roles.some((role) => role.role === 'mc_member');
  const hasStaff = context.user.roles.some((role) => role.role === 'staff_ops' && role.projectId === context.unit.projectId && (!role.unitId || role.unitId === params.id));
  if (!context.identity.isAdmin && !hasStaff && (!isMc || !(await hasManagedUnitMcAccess(context.user, { projectId: context.unit.projectId, unitId: params.id })))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await req.json();
    // Changes to title, publication and commercial authority stay admin-only.
    // Staff may edit factual listing fields; all routes share the canonical updateUnit writer.
    const allowedFields = ['name', 'unitType', 'categoryKey', 'inventoryCategoryId', 'bedrooms', 'bathrooms', 'maxGuests', 'sizeSqm', 'floor', 'addressSupplement', 'amenityKeys'];
    const changes = Object.fromEntries(Object.entries(body).filter(([key]) => allowedFields.includes(key)));
    if (context.identity.isAdmin) {
      for (const key of ['baseNightlyThb', 'minNights', 'instantBook', 'cancellationPolicyKey', 'status']) {
        if (Object.prototype.hasOwnProperty.call(body, key)) changes[key] = body[key];
      }
    } else if (Object.keys(body).some((key) => !allowedFields.includes(key))) {
      return NextResponse.json({ error: 'Restricted field; admin approval required' }, { status: 403 });
    }
    const updated = await updateUnit({
      ...changes,
      unitId: params.id,
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

  const allowed = await can({
    identity: context.identity,
    action: 'units:view_full_record',
    requiredAccess: 'read',
    resource: { projectId: context.unit.projectId, unitId: context.unit.id },
  });
  if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const isMc = context.user.roles.some((role) => role.role === 'mc_member');
  const hasStaff = context.user.roles.some((role) => role.role === 'staff_ops' && role.projectId === context.unit.projectId && (!role.unitId || role.unitId === params.id));
  const ownerRecord = await prisma.unit.findFirst({ where: { id: params.id, OR: [ { ownerIdentityId: context.user.identityId }, { engagements: { some: { ownerIdentityId: context.user.identityId, status: 'active' } } } ] }, select: { id: true } });
  const isOwner = Boolean(ownerRecord);
  if (!context.identity.isAdmin && !hasStaff && !isOwner &&
    (!isMc || !(await hasManagedUnitMcAccess(context.user, { projectId: context.unit.projectId, unitId: params.id })))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

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
