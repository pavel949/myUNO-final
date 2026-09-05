import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/app/libs/onboardingGuard';

export async function GET(req: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.error;

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
