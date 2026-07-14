/**
 * GET /api/tm30/[id]/passport
 * Get passport data for a TM30 filing (with access logging).
 * Staff only. Access is audit-logged.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { logTm30PassportAccess, decryptPassportNumber } from '@/modules/ops';

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user?.identityId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const currentUser = await prisma.identity.findUnique({
      where: { id: user.identityId },
    });

    if (!currentUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get the filing
    const filing = await prisma.tm30Filing.findUnique({
      where: { id: params.id },
      include: {
        booking: {
          include: {
            unit: true,
          },
        },
        bookingGuest: true,
        filedBy: true,
      },
    });

    if (!filing) {
      return NextResponse.json({ error: 'Filing not found' }, { status: 404 });
    }

    // Check authorization: staff only
    const isStaff = await prisma.roleAssignment.findFirst({
      where: {
        identityId: currentUser.id,
        projectId: filing.booking.projectId,
        role: 'staff_ops',
        status: 'active',
      },
    });

    if (!isStaff) {
      return NextResponse.json(
        { error: 'Only staff can access passport data' },
        { status: 403 }
      );
    }

    // Log access
    await logTm30PassportAccess(prisma, params.id, currentUser.id, 'viewed_passport_details');

    // Decrypt passport for response
    const decryptedPassport = filing.bookingGuest?.passportNumber
      ? decryptPassportNumber(filing.bookingGuest.passportNumber)
      : null;

    return NextResponse.json(
      {
        id: filing.id,
        guestName: filing.bookingGuest?.fullName,
        nationality: filing.bookingGuest?.nationality,
        passportNumber: decryptedPassport,
        dateOfBirth: filing.bookingGuest?.dateOfBirth,
        unit: filing.booking.unit,
        address: 'Ready to copy to immigration portal',
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
