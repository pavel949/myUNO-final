import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { can } from '@/modules/core';
import { createUnit } from '@/modules/projects';
import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';
import type { UnitType } from '@prisma/client';

// Existing canonical createUnit is the only writer. No alternative inventory model.
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const identity = await prisma.identity.findUnique({ where: { id: user.identityId } });
  if (!identity || identity.status === 'blocked') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const body = await req.json();
    if (typeof body.projectId !== 'string' || !body.projectId) {
      return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
    }
    // Only directly assigned internal staff can create a new inventory record.
    // An external MC member cannot attach an unmandated unit to their portfolio.
    const staffGrant = await prisma.roleAssignment.findFirst({
      where: { identityId: user.identityId, role: 'staff_ops', scopeType: 'project', projectId: body.projectId, status: 'active' },
      select: { id: true },
    });
    if (!identity.isAdmin && !staffGrant) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const allowed = await can({
      identity, action: 'units:create', requiredAccess: 'allow',
      resource: { projectId: body.projectId },
    });
    if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    // Explicit field allowlist: no owner reassignment, publishing, or access changes
    // through the operational create flow.
    const unit = await createUnit({
      projectId: body.projectId,
      name: String(body.name || '').trim(),
      unitType: body.unitType as UnitType,
      categoryKey: body.categoryKey || undefined,
      inventoryCategoryId: body.inventoryCategoryId || undefined,
      bedrooms: Number(body.bedrooms),
      bathrooms: Number(body.bathrooms),
      maxGuests: Number(body.maxGuests),
      sizeSqm: body.sizeSqm == null || body.sizeSqm === '' ? undefined : Number(body.sizeSqm),
      floor: body.floor || undefined,
      addressSupplement: String(body.addressSupplement || ''),
      amenityKeys: Array.isArray(body.amenityKeys) ? body.amenityKeys : [],
      baseNightlyThb: Number(body.baseNightlyThb),
      minNights: body.minNights == null ? undefined : Number(body.minNights),
      instantBook: body.instantBook === true,
      status: 'draft',
      actorIdentityId: user.identityId,
    });
    return NextResponse.json(unit, { status: 201 });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to create unit' }, { status: 400 });
  }
}

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const identity = await prisma.identity.findUnique({ where: { id: user.identityId } });
  if (!identity || identity.status === 'blocked') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const projectId = req.nextUrl.searchParams.get('projectId');
  if (!projectId) return NextResponse.json({ error: 'projectId query parameter is required' }, { status: 400 });
  const allowed = await can({ identity, action: 'units:view_full_record', requiredAccess: 'read', resource: { projectId } });
  if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  // A project role for an external MC does NOT imply every condo in that building.
  const mcOnly = !identity.isAdmin && !(await prisma.roleAssignment.findFirst({
    where: { identityId: user.identityId, status: 'active', role: 'staff_ops', scopeType: 'project', projectId },
    select: { id: true },
  }));
  const mcOr = mcOnly ? await prisma.roleAssignment.findMany({
    where: { identityId: user.identityId, role: 'mc_member', status: 'active', projectId, organizationId: { not: null } },
    select: { organizationId: true },
  }) : [];
  const allowedOrganizations = mcOr.map((r) => r.organizationId).filter((id): id is string => Boolean(id));
  const where = {
    projectId,
    ...(mcOnly && { engagements: { some: {
      engagementType: 'via_management_company' as const, status: 'active' as const,
      managementOrgId: { in: allowedOrganizations },
    } } }),
  };
  const parsedLimit = Number(req.nextUrl.searchParams.get('limit') || 50);
  const parsedOffset = Number(req.nextUrl.searchParams.get('offset') || 0);
  const limit = Number.isInteger(parsedLimit) ? Math.max(1, Math.min(parsedLimit, 100)) : 50;
  const offset = Number.isInteger(parsedOffset) ? Math.max(0, parsedOffset) : 0;
  const [items, total] = await Promise.all([
    prisma.unit.findMany({ where, orderBy: { createdAt: 'desc' }, take: limit, skip: offset }),
    prisma.unit.count({ where }),
  ]);
  return NextResponse.json({ items, pagination: { limit, offset, total, hasMore: offset + limit < total } });
}
