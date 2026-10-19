import type { PrismaClient } from '@prisma/client';
import { lockBookingInventory } from '@/modules/core/booking-occupancy';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { capturePassportData, createTm30Filing, encryptGuestPii, safeDecrypt } from '@/modules/ops';
import { handleError, createPublicError } from '@/app/libs/errorHandler';
import { canManageBookingGuests, resolveBookingAccess } from '@/app/libs/bookingAccess';

async function authorize(bookingId: string) {
  const user = await getCurrentUser();
  if (!user) {
    throw createPublicError('unauthorized', 401);
  }
  const bookingRow = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: {
      id: true,
      guestIdentityId: true,
      status: true,
      projectId: true,
      unitId: true,
      verificationStatus: true,
      unit: { select: { ownerIdentityId: true } },
    },
  });
  if (!bookingRow) {
    throw createPublicError('not found', 404);
  }
  const access = await resolveBookingAccess(user, {
    guestIdentityId: bookingRow.guestIdentityId,
    projectId: bookingRow.projectId,
    unitId: bookingRow.unitId,
    ownerIdentityId: bookingRow.unit?.ownerIdentityId,
  });
  if (!canManageBookingGuests(access)) {
    throw createPublicError('not found', 404);
  }
  const booking = {
    id: bookingRow.id,
    guestIdentityId: bookingRow.guestIdentityId,
    status: bookingRow.status,
    projectId: bookingRow.projectId,
    verificationStatus: bookingRow.verificationStatus,
  };
  return { user, booking };
}

/**
 * GET /api/bookings/[id]/guests
 * List the booking's party members. Passport numbers are NEVER returned —
 * only whether one has been provided (PDPA, doc 12).
 */
export async function GET(_req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const { booking } = await authorize(params.id);

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
      verificationStatus: booking.verificationStatus,
      guests: guests.map((g) => ({
        id: g.id,
        fullName: safeDecrypt(g.fullName),
        nationality: g.nationality,
        isLead: g.isLead,
        passportProvided: Boolean(g.passportNumber),
        dateOfBirth: safeDecrypt(g.dateOfBirth),
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
export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
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

    // Encrypt name + date of birth here, then let the ops module encrypt the
    // passport and advance the booking's verification status. All 🔒 fields
    // are ciphertext before they touch the database (doc 12).
    const encrypted = encryptGuestPii({
      fullName: String(fullName),
      dateOfBirth: dateOfBirth ? String(dateOfBirth) : null,
    });
    const guest = await prisma.$transaction(async tx => {
      const current = await lockBookingInventory(tx, params.id);
      if (!current) throw createPublicError('not found', 404);
      const registered = await tx.bookingGuest.create({
        data: {
          bookingId: current.id,
          fullName: encrypted.fullName,
          nationality: String(nationality),
          passportNumber: '',
          dateOfBirth: encrypted.dateOfBirth,
          isLead: Boolean(isLead),
        },
      });
      await capturePassportData(tx, {
        bookingGuestId: registered.id,
        passportNumber: String(passportNumber),
      });
      // Existing late registration remains available. Its foreign-guest filing
      // must commit with the party record, using the unchanged canonical clock.
      if (current.status === 'checked_in' && registered.nationality?.trim().toUpperCase() !== 'TH') {
        await createTm30Filing(tx as unknown as PrismaClient, {
          bookingId: current.id, bookingGuestId: registered.id,
        });
      }
      return registered;
    });

    return NextResponse.json(
      { guest: { id: guest.id, fullName: String(fullName), nationality: guest.nationality } },
      { status: 201 }
    );
  } catch (error) {
    return handleError(error);
  }
}
