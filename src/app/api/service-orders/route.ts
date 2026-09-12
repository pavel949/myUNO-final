import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { createCanonicalServiceOrder } from '@/modules/services';
import { handleError, createPublicError } from '@/app/libs/errorHandler';
import { serializeOrder } from '@/app/libs/serviceOrderSerializer';
import type { RoleType } from '@prisma/client';

/** GET /api/service-orders — the caller's orders, newest first. */
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) throw createPublicError('unauthorized', 401);
    const orders = await prisma.serviceOrder.findMany({
      where: { orderer_identity_id: user.identityId },
      include: { service: { select: { title: true } } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return NextResponse.json({ orders: orders.map(serializeOrder) });
  } catch (error) {
    return handleError(error);
  }
}

/**
 * POST /api/service-orders — F01/F02/F03 canonical order creation.
 *
 * Property/stay context is optional. Without it the customer must supply an
 * explicit Phuket `serviceContext.area` or `serviceContext.address`; there is
 * never an "All Phuket" synthetic project. Money, take-rate and property terms
 * are always resolved server-side and snapshotted on the order.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) throw createPublicError('unauthorized', 401);

    const body = await req.json();
    const serviceId = typeof body.serviceId === 'string' ? body.serviceId : '';
    const scheduledStart = new Date(body.scheduledStart);
    if (!serviceId || Number.isNaN(scheduledStart.getTime())) {
      throw createPublicError('invalid request: serviceId and scheduledStart are required', 400);
    }

    let projectId: string | null = typeof body.projectId === 'string' && body.projectId ? body.projectId : null;
    let unitId: string | undefined = typeof body.unitId === 'string' && body.unitId ? body.unitId : undefined;
    const bookingId = typeof body.bookingId === 'string' && body.bookingId ? body.bookingId : undefined;
    let bookingValidated = false;

    if (bookingId) {
      const booking = await prisma.booking.findUnique({
        where: { id: bookingId },
        select: { guestIdentityId: true, projectId: true, unitId: true },
      });
      if (!booking || booking.guestIdentityId !== user.identityId) throw createPublicError('not found', 404);
      projectId = booking.projectId;
      unitId = booking.unitId;
      bookingValidated = true;
    }

    // Property ordering without a booking is an owner/resident/operator action,
    // not a way for any authenticated customer to probe another property's data.
    if (projectId && !bookingValidated) {
      const hasScopedRole = user.isAdmin || user.roles.some(
        (role) =>
          (unitId && role.unitId === unitId) ||
          role.projectId === projectId
      );
      if (!hasScopedRole) throw createPublicError('not found', 404);
    }

    const rawDimensions =
      body.quantityDimensions && typeof body.quantityDimensions === 'object'
        ? body.quantityDimensions
        : body.quantity != null
          ? { units: body.quantity }
          : { units: 1 };

    const order = await createCanonicalServiceOrder(prisma, {
      serviceId,
      projectId,
      unitId,
      bookingId,
      ordererIdentityId: user.identityId,
      ordererRole: (user.roles[0]?.role || 'guest') as RoleType,
      scheduledStart,
      serviceContext:
        body.serviceContext && typeof body.serviceContext === 'object'
          ? {
              area: typeof body.serviceContext.area === 'string' ? body.serviceContext.area : undefined,
              address: typeof body.serviceContext.address === 'string' ? body.serviceContext.address : undefined,
              recipientName: typeof body.serviceContext.recipientName === 'string' ? body.serviceContext.recipientName : undefined,
              recipientPhone: typeof body.serviceContext.recipientPhone === 'string' ? body.serviceContext.recipientPhone : undefined,
              note: typeof body.serviceContext.note === 'string' ? body.serviceContext.note : undefined,
            }
          : undefined,
      quantityDimensions: rawDimensions,
      noteToProvider: typeof body.noteToProvider === 'string' ? body.noteToProvider : undefined,
    });

    return NextResponse.json({ order: serializeOrder(order as any) }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && !(error as { statusCode?: number }).statusCode) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return handleError(error);
  }
}
