import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { acceptServiceQuoteVersion } from '@/modules/services';
import { createPublicError, handleError } from '@/app/libs/errorHandler';
import { serializeOrder } from '@/app/libs/serviceOrderSerializer';
import type { RoleType } from '@prisma/client';

/** POST /api/service-quotes/versions/:id/accept — orderer accepts exactly one immutable version. */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await getCurrentUser();
    if (!user) throw createPublicError('unauthorized', 401);
    const body = await req.json();
    const scheduledStart = new Date(body.scheduledStart);
    if (Number.isNaN(scheduledStart.getTime()) || scheduledStart <= new Date()) {
      throw createPublicError('scheduledStart must be in the future', 400);
    }
    const order = await acceptServiceQuoteVersion(prisma, {
      quoteVersionId: params.id,
      ordererIdentityId: user.identityId,
      ordererRole: (user.roles[0]?.role || 'guest') as RoleType,
      scheduledStart,
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
