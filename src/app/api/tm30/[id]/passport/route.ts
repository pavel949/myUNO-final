/**
 * GET /api/tm30/[id]/passport
 * Get passport data for a TM30 filing (with access logging).
 * Staff only. Access is audit-logged.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import {
  logTm30PassportAccess,
  decryptPassportNumber,
  safeDecrypt,
  buildTm30AddressBlock,
  TM30_IMMIGRATION_PORTAL_URL,
} from '@/modules/ops';
import { canAccessTm30Filing } from '@/app/libs/projectScope';

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user?.identityId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get the filing
    const filing = await prisma.tm30Filing.findUnique({
      where: { id: params.id },
      include: {
        booking: {
          include: {
            unit: true,
            project: { select: { address: true, name: true } },
          },
        },
        bookingGuest: true,
        filedBy: true,
      },
    });

    if (!filing) {
      return NextResponse.json({ error: 'Filing not found' }, { status: 404 });
    }

    if (!(await canAccessTm30Filing(user, filing.booking))) {
      return NextResponse.json(
        { error: 'Only staff or MC members with unit scope can access passport data' },
        { status: 403 }
      );
    }

    // Log access
    await logTm30PassportAccess(prisma, params.id, user.identityId, 'viewed_passport_details');

    // Decrypt passport for response
    const decryptedPassport = filing.bookingGuest?.passportNumber
      ? decryptPassportNumber(filing.bookingGuest.passportNumber)
      : null;

    const addressBlock = buildTm30AddressBlock({
      unitName: filing.booking.unit.name,
      addressSupplement: filing.booking.unit.addressSupplement,
      projectAddress: filing.booking.project?.address,
    });

    return NextResponse.json(
      {
        id: filing.id,
        guestName: safeDecrypt(filing.bookingGuest?.fullName),
        nationality: filing.bookingGuest?.nationality,
        passportNumber: decryptedPassport,
        dateOfBirth: safeDecrypt(filing.bookingGuest?.dateOfBirth),
        unitName: filing.booking.unit.name,
        projectName: filing.booking.project?.name,
        addressBlock,
        portalUrl: TM30_IMMIGRATION_PORTAL_URL,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Passport fetch error:', error);
    return NextResponse.json(
      { error: 'Fetch failed' },
      { status: 500 }
    );
  }
}
