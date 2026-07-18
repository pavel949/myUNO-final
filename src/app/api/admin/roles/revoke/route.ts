import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { can } from '@/modules/core';
import { people } from '@/modules/core';
import { prisma } from '@/lib/prisma';
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
    const { roleAssignmentId } = body;

    if (!roleAssignmentId) {
      return NextResponse.json(
        { error: 'roleAssignmentId is required' },
        { status: 400 }
      );
    }

    const roleAssignment = await people.revokeRole(prisma, { roleAssignmentId });

    return NextResponse.json({ success: true, roleAssignment });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to revoke role' },
      { status: 400 }
    );
  }
}
