import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { createServiceOrder } from '@/modules/services';
import { getConfig } from '@/modules/config';
import { handleError, createPublicError } from '@/app/libs/errorHandler';
import { serializeOrder } from '@/app/libs/serviceOrderSerializer';
import type { RoleType } from '@prisma/client';

/** GET /api/service-orders — the caller's orders, newest first. */
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      throw createPublicError('unauthorized', 401);
    }
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
 * POST /api/service-orders — place an order (F-SVC-2). Any role may order.
 * Body: { serviceId, scheduledStart, quantity?, bookingId?, noteToProvider? }
 * Total is ALWAYS computed server-side (base price × quantity); the take
 * rate is snapshotted from config (doc 10 §3).
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      throw createPublicError('unauthorized', 401);
    }

    const body = await req.json();
    const { serviceId, scheduledStart, quantity = 1, bookingId, noteToProvider } = body;
    if (!serviceId || !scheduledStart) {
      throw createPublicError(
        'invalid request: serviceId and scheduledStart are required',
        400
      );
    }

    const service = await prisma.service.findUnique({
      where: { id: serviceId },
      include: { provider: { select: { status: true } } },
    });
    if (!service || service.status !== 'active' || service.provider?.status !== 'active') {
      throw createPublicError('not found', 404);
    }
    if (service.priceModel === 'quote' || !service.basePriceThb) {
      throw createPublicError('invalid request: this service is quoted individually — message us instead', 400);
    }

    const start = new Date(scheduledStart);
    if (isNaN(start.getTime()) || start < new Date()) {
      throw createPublicError('invalid request: scheduledStart must be in the future', 400);
    }
    const noticeMs = service.advanceNoticeHours * 60 * 60 * 1000;
    if (start.getTime() - Date.now() < noticeMs) {
      throw createPublicError(
        `invalid request: this service needs ${service.advanceNoticeHours}h advance notice`,
        400
      );
    }

    const qty = Math.max(1, Math.min(20, Number(quantity) || 1));
    const durationMs = (service.durationMin || 60) * 60 * 1000;
    const end = new Date(start.getTime() + durationMs * qty);

    // Project/unit context must be deterministic — never an arbitrary row.
    // Priority: booking (validated as the caller's) → explicit projectId in
    // the body (validated) → the single project when only one exists → 400.
    let projectId: string | null = null;
    let unitId: string | undefined;
    if (bookingId) {
      const booking = await prisma.booking.findUnique({
        where: { id: bookingId },
        select: { guestIdentityId: true, projectId: true, unitId: true },
      });
      if (!booking || booking.guestIdentityId !== user.identityId) {
        throw createPublicError('not found', 404);
      }
      projectId = booking.projectId;
      unitId = booking.unitId;
    } else if (typeof body.projectId === 'string' && body.projectId) {
      const project = await prisma.project.findUnique({
        where: { id: body.projectId },
        select: { id: true },
      });
      if (!project) {
        throw createPublicError('invalid request: unknown project', 400);
      }
      projectId = project.id;
    } else {
      const projects = await prisma.project.findMany({ select: { id: true }, take: 2 });
      projectId = projects.length === 1 ? projects[0].id : null;
    }
    if (!projectId) {
      throw createPublicError('invalid request: no project context', 400);
    }

    const totalThb = service.basePriceThb * qty;
    const takeRatePct =
      ((await getConfig(prisma, 'services.take_rate_pct', { projectId })) as number) ?? 15;

    const order = await createServiceOrder(prisma, {
      serviceId,
      projectId,
      unitId,
      bookingId,
      ordererIdentityId: user.identityId,
      ordererRole: (user.roles[0]?.role || 'guest') as RoleType,
      scheduledStart: start,
      scheduledEnd: end,
      quantity: qty,
      priceBreakdown: { base_thb: service.basePriceThb, quantity: qty, total_thb: totalThb },
      totalThb,
      tookRatePctSnapshot: takeRatePct,
      noteToProvider: noteToProvider ? String(noteToProvider) : undefined,
    });

    return NextResponse.json({ order }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && !(error as { statusCode?: number }).statusCode) {
      const msg = error.message;
      if (msg.includes('notice') || msg.includes('not found') || msg.includes('slot')) {
        return NextResponse.json({ error: msg }, { status: 400 });
      }
    }
    return handleError(error);
  }
}
