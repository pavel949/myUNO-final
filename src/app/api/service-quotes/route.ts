import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { createServiceQuoteRequest } from '@/modules/services';
import { createPublicError, handleError } from '@/app/libs/errorHandler';
import type { RoleType } from '@prisma/client';

/** POST /api/service-quotes — request a quote for project or standalone Phuket service. */
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) throw createPublicError('unauthorized', 401);
    const body = await req.json();
    const serviceId = typeof body.serviceId === 'string' ? body.serviceId : '';
    if (!serviceId) throw createPublicError('serviceId is required', 400);

    const projectId = typeof body.projectId === 'string' && body.projectId ? body.projectId : null;
    const unitId = typeof body.unitId === 'string' && body.unitId ? body.unitId : undefined;
    if (projectId) {
      const allowed = user.isAdmin || user.roles.some((role) => role.projectId === projectId || (unitId && role.unitId === unitId));
      if (!allowed) throw createPublicError('not found', 404);
    }

    const request = await createServiceQuoteRequest(prisma, {
      serviceId,
      projectId,
      unitId,
      bookingId: typeof body.bookingId === 'string' ? body.bookingId : undefined,
      ordererIdentityId: user.identityId,
      ordererRole: (user.roles[0]?.role || 'guest') as RoleType,
      serviceContext: body.serviceContext && typeof body.serviceContext === 'object' ? body.serviceContext : undefined,
      quantityDimensions: body.quantityDimensions && typeof body.quantityDimensions === 'object' ? body.quantityDimensions : {},
      noteToProvider: typeof body.noteToProvider === 'string' ? body.noteToProvider : undefined,
    });
    return NextResponse.json({ quoteRequest: request }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && !(error as { statusCode?: number }).statusCode) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return handleError(error);
  }
}
