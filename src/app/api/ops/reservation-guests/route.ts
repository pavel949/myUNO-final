import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { prisma } from '@/lib/prisma';
import { registerReservationGuest } from '@/modules/ops/reservation-guests.service';
import { OperatingAccessError } from '@/modules/ops/operating-space-access.service';

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json({ error: 'Invalid guest details' }, { status: 400 });
  }
  try {
    const result = await registerReservationGuest(prisma, user.identityId, body);
    return NextResponse.json(result, { status: result.created ? 201 : 200 });
  } catch (error) {
    if (error instanceof OperatingAccessError) return NextResponse.json({ error: error.message }, { status: error.status });
    if ((error as { code?: string })?.code === 'P2002') {
      return NextResponse.json({ error: 'Contact details already exist. Review the guest before retrying.' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Could not save guest details. Please retry.' }, { status: 500 });
  }
}
