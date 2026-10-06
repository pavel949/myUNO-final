import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { can } from '@/modules/core';
import { people } from '@/modules/core';
import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(
  _req: NextRequest,
  { params }: { params: { identityId: string } }
) {
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
    if (params.identityId === identity.id) {
      return NextResponse.json(
        { error: 'Founder / Super Admin cannot block the currently authenticated root identity' },
        { status: 409 }
      );
    }

    const target = await prisma.identity.findUnique({
      where: { id: params.identityId },
      select: { id: true, isAdmin: true, status: true },
    });
    if (!target) {
      return NextResponse.json({ error: 'Identity not found' }, { status: 404 });
    }
    if (target.isAdmin && target.status === 'active') {
      const activeAdmins = await prisma.identity.count({
        where: { isAdmin: true, status: 'active' },
      });
      if (activeAdmins <= 1) {
        return NextResponse.json(
          { error: 'The last active Founder / Super Admin cannot be blocked' },
          { status: 409 }
        );
      }
    }

    const blocked = await people.blockIdentity(prisma, {
      identityId: params.identityId,
    });

    return NextResponse.json({ success: true, identity: blocked });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to block identity' },
      { status: 400 }
    );
  }
}
