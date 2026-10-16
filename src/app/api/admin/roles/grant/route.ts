import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { can } from '@/modules/core';
import { people } from '@/modules/core';
import { prisma } from '@/lib/prisma';
import { isPropertyCapabilityRole } from '@/modules/core/property-capability-policy';
import { grantPropertyCapability } from '@/modules/core/property-capability-grants';
import { PropertyCapabilityError } from '@/modules/core/property-capability-access';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const identity = await prisma.identity.findUnique({
    where: { id: user.identityId },
  });
  if (!identity) return NextResponse.json({ error: 'Identity not found' }, { status: 404 });

  // Check admin permission
  if (
    !(await can({
      identity,
      action: 'people:edit',
      resource: { resourceType: 'platform' },
    }))
  ) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { identityId, role, scopeType, projectId, unitId, organizationId, providerId } = body;

    if (!identityId || !role || !scopeType) {
      return NextResponse.json(
        { error: 'identityId, role, and scopeType are required' },
        { status: 400 }
      );
    }

    if (isPropertyCapabilityRole(role)) {
      const result = await grantPropertyCapability(prisma, user.identityId, body);
      return NextResponse.json({ success: true, roleAssignment: result.grant, alreadyGranted: result.alreadyGranted });
    }

    const roleAssignment = await people.grantRole(prisma, {
      identityId,
      role,
      scopeType,
      projectId,
      unitId,
      organizationId,
      providerId,
      grantedByIdentityId: user.identityId,
    });

    if (scopeType === 'project' && projectId && ['staff_ops', 'onsite_host'].includes(role)) {
      await prisma.projectStaffPermission.upsert({
        where: { projectId_identityId: { projectId, identityId } },
        create: { projectId, identityId, departments: [] },
        update: {},
      });
    }
    return NextResponse.json({ success: true, roleAssignment });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to grant role' },
      { status: error instanceof PropertyCapabilityError ? error.status : 400 }
    );
  }
}
