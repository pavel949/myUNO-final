import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { addServiceQuoteVersion, getProviderForIdentity } from '@/modules/services';
import { createPublicError, handleError } from '@/app/libs/errorHandler';

/** POST /api/service-quotes/:id/versions — provider issues a new immutable quote version. */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await getCurrentUser();
    if (!user) throw createPublicError('unauthorized', 401);
    const provider = await getProviderForIdentity(prisma, user.identityId);
    if (!provider || !provider.isMember || provider.status !== 'active') {
      throw createPublicError('forbidden', 403);
    }

    const body = await req.json();
    const totalThb = Number(body.totalThb);
    const expiresAt = new Date(body.expiresAt);
    if (!Number.isInteger(totalThb) || totalThb < 0 || Number.isNaN(expiresAt.getTime())) {
      throw createPublicError('totalThb and a valid expiresAt are required', 400);
    }

    const version = await addServiceQuoteVersion(prisma, {
      requestId: params.id,
      providerId: provider.id,
      totalThb,
      priceBreakdown: body.priceBreakdown && typeof body.priceBreakdown === 'object' ? body.priceBreakdown : { total_thb: totalThb },
      terms: body.terms && typeof body.terms === 'object' ? body.terms : {},
      expiresAt,
    });
    return NextResponse.json({ quoteVersion: version }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && !(error as { statusCode?: number }).statusCode) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return handleError(error);
  }
}
