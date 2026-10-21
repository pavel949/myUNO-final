import { NextRequest } from 'next/server';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { prisma } from '@/lib/prisma';
import { createOffer } from '@/modules/sales-offers/offer.service';
import { offerResponse, offerFailure } from '@/modules/sales-offers/http';
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return offerResponse({ code: 'UNAUTHORIZED' }, 401);
  try {
    const body = await req.json();
    if (!body || typeof body.spaceId !== 'string' || !Array.isArray(body.selections)) return offerResponse({ code: 'INVALID_INPUT' }, 400);
    return offerResponse(await createOffer(prisma, user.identityId, body), 201);
  } catch (error) { return offerFailure(error); }
}
