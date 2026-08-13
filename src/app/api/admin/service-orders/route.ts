import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { can } from '@/modules/core';
import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
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
      action: 'admin:view_all',
      resource: { resourceType: 'platform' },
    }))
  ) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const statusParam = req.nextUrl.searchParams.get('statuses') || 'placed,paid,accepted,declined,failed';
    const limit = parseInt(req.nextUrl.searchParams.get('limit') || '100');
    const offset = parseInt(req.nextUrl.searchParams.get('offset') || '0');

    const statusList = statusParam.split(',');

    const serviceOrders = await prisma.serviceOrder.findMany({
      where: {
        status: {
          in: statusList as any[],
        },
      },
      include: {
        service: {
          select: {
            id: true,
            title: true,
          },
        },
        provider: {
          select: {
            id: true,
            name: true,
          },
        },
        orderer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
      take: limit,
      skip: offset,
    });

    return NextResponse.json(serviceOrders);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to fetch service orders' },
      { status: 400 }
    );
  }
}
