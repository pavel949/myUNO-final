import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { prisma } from '@/lib/prisma';
import { getServiceOrderCustomerView } from '@/modules/services';

export const dynamic = 'force-dynamic';

/**
 * GET /api/service-orders/[id]/detail — customer view of their service order (F-SVC-4).
 * Returns order details: service, provider, pricing, status, notes.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const result = await getServiceOrderCustomerView(prisma, params.id, user.identityId);
    if (result.kind === 'not_found') {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }
    if (result.kind === 'forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.json(result.order);
  } catch (error) {
    console.error('Error fetching service order:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
