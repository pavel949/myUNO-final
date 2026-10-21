import { NextRequest } from 'next/server';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { prisma } from '@/lib/prisma';
import { requestOfferBooking } from '@/modules/sales-offers/offer.service';
import { offerResponse, offerFailure } from '@/modules/sales-offers/http';
export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return offerResponse({ code: 'UNAUTHORIZED' }, 401);
  try {
    const { id } = await props.params;
    const body = await req.json();
    if (!body || typeof body.optionId !== 'string' || typeof body.guestId !== 'string') return offerResponse({ code: 'INVALID_INPUT' }, 400);
    return offerResponse(await requestOfferBooking(prisma, user.identityId, id, body.optionId, body.guestId), 201);
  } catch (error) { return offerFailure(error); }
}
