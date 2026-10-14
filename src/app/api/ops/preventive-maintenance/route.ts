import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { prisma } from '@/lib/prisma';
import { getScopedOperationalAccess, OperatingAccessError } from '@/modules/ops/operating-space-access.service';

function failed(error: unknown) {
  return NextResponse.json({ error: error instanceof OperatingAccessError ? error.message : 'Plan request failed' },
    { status: error instanceof OperatingAccessError ? error.status : 400 });
}
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const spaceId = request.nextUrl.searchParams.get('spaceId') || '';
  if (!spaceId) return NextResponse.json({ error: 'spaceId required' }, { status: 400 });
  try {
    const access = await getScopedOperationalAccess(prisma, user.identityId, spaceId, 'manage_maintenance', ['maintenance']);
    const plans = await prisma.preventiveMaintenancePlan.findMany({ where: {
      operatingSpaceId: spaceId, OR: [{ unitId: { in: access.unitIds } }, ...(access.isAdmin ? [{ unitId: null }] : [])],
    }, select: { id: true, title: true, active: true, taskType: true, frequencyDays: true, nextDueAt: true,
      unit: { select: { id: true, name: true } }, assignedTeam: { select: { id: true, name: true } },
      assignee: { select: { id: true, firstName: true, lastName: true } },
    }, orderBy: [{ active: 'desc' }, { nextDueAt: 'asc' }] });
    return NextResponse.json({ plans });
  } catch (error) { return failed(error); }
}
/** Recurring generation is not ready for delegated scope; do not create new plans. */
export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const body = await request.json() as { operatingSpaceId?: string };
    if (typeof body.operatingSpaceId !== 'string' || !body.operatingSpaceId) throw new OperatingAccessError('Operating space required', 400);
    await getScopedOperationalAccess(prisma, user.identityId, body.operatingSpaceId, 'manage_maintenance', ['maintenance']);
    return NextResponse.json({ error: 'Recurring plan creation is unavailable until scheduled generation enforces current scope and assignment. Create a manual task instead.' }, { status: 409 });
  } catch (error) { return failed(error); }
}
