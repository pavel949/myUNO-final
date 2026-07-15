import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { capturePassportData } from '@/modules/ops';
import { handleError, createPublicError } from '@/app/libs/errorHandler';

async function authorize(bookingId: string) {
  const user = await getCurrentUser();
  if (!user) {
    throw createPublicError('unauthorized', 401);
  }
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: { id: true, guestIdentityId: true, status: true },
  });
  if (!booking) {
    throw createPublicError('not found', 404);
  }
  const isGuest = booking.guestIdentityId === user.identityId;
  const isStaff = user.roles.some((role) => role.role === 'staff_ops');
  if (!isGuest && !isStaff && !user.isAdmin) {
    throw createPublicError('not found', 404);
  }
  return { user, booking };
}

/**
 * GET /api/bookings/[id]/guests
 * List the booking's party members. Passport numbers are NEVER returned —
 * only whether one has been provided (PDPA, doc 12).
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await authorize(params.id);

    const guests = await prisma.bookingGuest.findMany({
      where: { bookingId: params.id },
      select: {
        id: true,
        fullName: true,
        nationality: true,
        isLead: true,
        passportNumber: true,
        dateOfBirth: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    return NextResponse.json({
      guests: guests.map((g) => ({
        id: g.id,
        fullName: g.fullName,
        nationality: g.nationality,
        isLead: g.isLead,
        passportProvided: Boolean(g.passportNumber),
        dateOfBirth: g.dateOfBirth,
      })),
    });
  } catch (error) {
    return handleError(error);
  }
}

/**
 * POST /api/bookings/[id]/guests
 * Add a party member with their passport details (pre-arrival, F-GUEST-5).
 * The passport number is field-level encrypted via the ops module before it
 * touches the database; providing all passports advances the booking's
 * verification status.
 *
 * Body: { fullName, nationality, passportNumber, dateOfBirth?, isLead? }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await authorize(params.id);

    const body = await req.json();
    const { fullName, nationality, passportNumber, dateOfBirth, isLead } = body;

    if (!fullName || !nationality || !passportNumber) {
      throw createPublicError(
        'invalid request: fullName, nationality, and passportNumber are required',
        400
      );
    }

    // Create the row, then let the ops module encrypt the passport and
    // advance the booking's verification status (single encryption path).
    const guest = await prisma.bookingGuest.create({
      data: {
        bookingId: params.id,
        fullName: String(fullName),
        nationality: String(nationality),
        passportNumber: '',
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined,
        isLead: Boolean(isLead),
      },
    });

    await capturePassportData(prisma, {
      bookingGuestId: guest.id,
      passportNumber: String(passportNumber),
    });

    return NextResponse.json(
      { guest: { id: guest.id, fullName: guest.fullName, nationality: guest.nationality } },
      { status: 201 }
    );
  } catch (error) {
    return handleError(error);
  }
}
