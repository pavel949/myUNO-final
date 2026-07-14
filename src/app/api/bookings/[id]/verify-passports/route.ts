/**
 * POST /api/bookings/[id]/verify-passports
 * Capture passport data for booking guests during pre-arrival (F-GUEST-5).
 * Can be called by guest or staff. When all guests have passports, marks verification complete.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { capturePassportData } from '@/modules/ops';

export async function POST(
  req: NextRequest,
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

    // Get the booking
    const booking = await prisma.booking.findUnique({
      where: { id: params.id },
      include: {
        guests: true,
        guestIdentity: true,
        unit: true,
      },
    });

    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    // Authorization: guest or staff can capture passports
    const isGuest = booking.guestIdentityId === currentUser.id;
    const isStaff = await prisma.roleAssignment.findFirst({
      where: {
        identityId: currentUser.id,
        role: 'staff_ops',
        status: 'active',
      },
    });

    if (!isGuest && !isStaff) {
      return NextResponse.json(
        { error: 'Only guest or staff can capture passports' },
        { status: 403 }
      );
    }

    // Parse request body - array of { bookingGuestId, passportNumber, passportMediaId? }
    const passportData = await req.json();

    if (!Array.isArray(passportData)) {
      return NextResponse.json(
        { error: 'Expected array of passport captures' },
        { status: 400 }
      );
    }

    // Capture each passport
    for (const data of passportData) {
      if (!data.bookingGuestId || !data.passportNumber) {
        return NextResponse.json(
          { error: 'Each capture requires bookingGuestId and passportNumber' },
          { status: 400 }
        );
      }

      // Verify the guest belongs to this booking
      const guest = await prisma.bookingGuest.findUnique({
        where: { id: data.bookingGuestId },
      });

      if (!guest || guest.bookingId !== booking.id) {
        return NextResponse.json(
          { error: `BookingGuest ${data.bookingGuestId} not found in this booking` },
          { status: 400 }
        );
      }

      await capturePassportData(prisma, {
        bookingGuestId: data.bookingGuestId,
        passportNumber: data.passportNumber,
        passportMediaId: data.passportMediaId,
      });
    }

    // Check final verification status
    const updatedBooking = await prisma.booking.findUnique({
      where: { id: params.id },
    });

    return NextResponse.json(
      {
        success: true,
        verificationStatus: updatedBooking?.verificationStatus,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Passport verification error:', error);
    return NextResponse.json(
      { error: 'Verification failed' },
      { status: 500 }
    );
  }
}
