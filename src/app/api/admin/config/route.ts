import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { can } from '@/modules/core';
import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(_req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const identity = await prisma.identity.findUnique({
    where: { id: user.identityId },
  });
  if (!identity) return NextResponse.json({ error: 'Identity not found' }, { status: 404 });

  // Check admin permission
  if (
    !can({
      identity,
      action: 'config:view',
      resource: { resourceType: 'platform' },
    })
  ) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const parameters = await prisma.configParameter.findMany({
      select: {
        key: true,
        valueType: true,
        defaultValue: true,
        description: true,
        groupKey: true,
        scopeableTo: true,
      },
      orderBy: [{ groupKey: 'asc' }, { key: 'asc' }],
    });

    return NextResponse.json(parameters);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to fetch config parameters' },
      { status: 400 }
    );
  }
}
