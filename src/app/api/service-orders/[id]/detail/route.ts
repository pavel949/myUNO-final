import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { prisma } from '@/lib/prisma';

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

    const { id } = params;

    const order = await prisma.serviceOrder.findUnique({
      where: { id },
      include: {
        service: {
          select: {
            id: true,
            title: true,
            description: true,
            categoryKey: true,
            priceModel: true,
            basePriceThb: true,
            durationMin: true,
            advanceNoticeHours: true,
          },
        },
        provider: {
          select: {
            id: true,
            name: true,
            description: true,
            contactPhone: true,
            contactEmail: true,
            status: true,
            vetted_at: true,
          },
        },
        project: {
          select: {
            id: true,
            name: true,
          },
        },
        unit: {
          select: {
            id: true,
            name: true,
            addressSupplement: true,
          },
        },
        orderer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
          },
        },
        payments: {
          select: {
            id: true,
            method: true,
            amountThb: true,
            status: true,
            createdAt: true,
            receiptRef: true,
          },
        },
      },
    });

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // Verify orderer is the current user
    if (order.orderer_identity_id !== user.identityId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Parse price breakdown
    const priceBreakdown = typeof order.price_breakdown === 'string'
      ? JSON.parse(order.price_breakdown)
      : order.price_breakdown;

    return NextResponse.json({
      id: order.id,
      createdAt: order.createdAt.toISOString(),
      updatedAt: order.updatedAt.toISOString(),
      status: order.status,
      quantity: order.quantity,
      scheduledStart: order.scheduled_start.toISOString(),
      scheduledEnd: order.scheduled_end.toISOString(),
      totalThb: order.total_thb,
      takeRatePctSnapshot: Number(order.take_rate_pct_snapshot),
      priceBreakdown,
      refundAccruedThb: order.refund_accrued_thb,
      noteToProvider: order.note_to_provider,
      addressNote: order.address_note,
      cancelledAt: order.cancelled_at?.toISOString() || null,
      cancellationReason: order.cancellation_reason,
      service: {
        id: order.service.id,
        title: order.service.title,
        description: order.service.description,
        categoryKey: order.service.categoryKey,
        priceModel: order.service.priceModel,
        basePriceThb: order.service.basePriceThb,
      },
      provider: {
        id: order.provider.id,
        name: order.provider.name,
        description: order.provider.description,
        phone: order.provider.contactPhone,
        email: order.provider.contactEmail,
        vetted: Boolean(order.provider.vetted_at),
      },
      project: order.project,
      unit: order.unit,
      orderer: {
        id: order.orderer.id,
        firstName: order.orderer.firstName,
        lastName: order.orderer.lastName,
        email: order.orderer.email,
        phone: order.orderer.phone,
      },
      payments: order.payments.map((p) => ({
        id: p.id,
        type: p.method,
        amountThb: p.amountThb,
        status: p.status,
        createdAt: p.createdAt.toISOString(),
        receiptNumber: p.receiptRef,
      })),
    });
  } catch (error) {
    console.error('Error fetching service order:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
