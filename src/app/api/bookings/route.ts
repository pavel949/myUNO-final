import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import {
  createBooking,
  resolveCancellationPolicy,
  findAvailableUnitsForCategory,
} from '@/modules/booking';
import { createCheckout } from '@/modules/finance';
import { computePriceBreakdown } from '@/modules/core';
import { handleError, createPublicError } from '@/app/libs/errorHandler';

/**
 * POST /api/bookings
 * Create a new booking (instant or request-to-book).
 * Requires authentication.
 *
 * Request body:
 * - unitId: string — OR categoryKey (LY-6): book a villa CATEGORY and the
 *   server auto-assigns the first available villa of that category
 *   (hotel-style). With categoryKey, instantBook comes from the assigned
 *   unit and the client value is ignored.
 * - projectId: string — required on the categoryKey path, where it scopes the
 *   search. On the unitId path it is optional and never authoritative: the
 *   booking is filed against the unit's own project, and a projectId that
 *   disagrees with it is refused rather than silently accepted.
 * - startDate: ISO date string
 * - endDate: ISO date string
 * - adultsCount: number
 * - childrenCount: number
 * - instantBook: boolean (required on the unitId path)
 * - guestNote?: string
 * - paymentMethod?: 'cash' | 'card_provider' | 'bank_transfer'
 *
 * The total is ALWAYS computed server-side from the pricing engine —
 * any client-sent amount is ignored (doc 10: never trust client totals).
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      throw createPublicError('unauthorized', 401);
    }

    const body = await req.json();
    const {
      unitId: requestedUnitId,
      categoryKey,
      projectId,
      startDate: startDateStr,
      endDate: endDateStr,
      adultsCount,
      childrenCount,
      instantBook: requestedInstantBook,
      infantsCount = 0,
      petsCount = 0,
      guestNote,
      paymentMethod = 'cash',
    } = body;

    // Validate required fields — either a concrete unit or a category
    if (
      (!requestedUnitId && !categoryKey) ||
      (!requestedUnitId && !projectId) ||
      !startDateStr ||
      !endDateStr ||
      adultsCount === undefined ||
      childrenCount === undefined ||
      (requestedUnitId && !categoryKey && requestedInstantBook === undefined)
    ) {
      throw createPublicError('invalid request: missing required fields', 400);
    }

    const startDate = new Date(startDateStr);
    const endDate = new Date(endDateStr);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime()) || startDate >= endDate) {
      throw createPublicError('invalid request: startDate must be before endDate', 400);
    }

    const guestCount = Number(adultsCount) + Number(childrenCount);

    // The villas we may book, in the order we will try them. A specific request
    // is a list of one. A category request (LY-6) is every free villa of that
    // category, because availability read outside the booking transaction is a
    // hint, not a promise: by the time we try to commit, someone else may hold
    // the one we picked. Refusing the guest while a sibling villa stands empty
    // would be a lost sale, not a safety measure.
    const candidates = requestedUnitId
      ? [{ id: requestedUnitId, instantBook: requestedInstantBook }]
      : await findAvailableUnitsForCategory(
          prisma,
          projectId,
          categoryKey as string,
          startDate,
          endDate
        );

    if (candidates.length === 0) {
      throw createPublicError(
        'no villa of this category is available for these dates',
        409
      );
    }

    let booking!: Awaited<ReturnType<typeof createBooking>>;
    let breakdown!: Awaited<ReturnType<typeof computePriceBreakdown>>;

    for (const [index, candidate] of candidates.entries()) {
      const isLastCandidate = index === candidates.length - 1;

      // Price and policy belong to the villa, not the category — two units of
      // one category can carry different nightly rates and different terms — so
      // both are recomputed for whichever villa we are actually attempting.
      const candidateBreakdown = await computePriceBreakdown(
        prisma,
        candidate.id,
        startDate,
        endDate,
        guestCount,
        undefined,
        Number(petsCount)
      );

      // Snapshot the unit's cancellation policy at booking time (doc 07 F-GUEST-8)
      const unit = await prisma.unit.findUnique({
        where: { id: candidate.id },
        select: { cancellationPolicyKey: true, status: true, projectId: true },
      });
      if (!unit || unit.status !== 'live') {
        throw createPublicError('not found', 404);
      }

      // The unit decides which project this booking belongs to — never the
      // request body. `projectId` used to be taken from the client and filed
      // as-is, so a mismatched id put the booking in another project's ledger,
      // metrics and MC dashboard, and — worse — resolved the cancellation
      // policy against that project's config overrides before snapshotting the
      // result into a record the database then makes immutable. A client that
      // disagrees is refused rather than silently corrected, so a broken caller
      // is visible instead of quietly writing money terms from elsewhere.
      const bookingProjectId = unit.projectId;
      if (projectId && projectId !== bookingProjectId) {
        throw createPublicError('unit does not belong to the given project', 400);
      }

      // Config is the source of truth (doc 04 §5); an unknown policy key
      // fails the booking instead of silently granting the most generous terms.
      const policy = await resolveCancellationPolicy(prisma, unit.cancellationPolicyKey, {
        projectId: bookingProjectId,
        unitId: candidate.id,
      });

      try {
        booking = await createBooking(prisma, {
          unitId: candidate.id,
          projectId: bookingProjectId,
          guestIdentityId: user.identityId,
          bookingType: 'guest_stay',
          channel: 'direct',
          startDate,
          endDate,
          adults: Number(adultsCount),
          children: Number(childrenCount),
          infants: Number(infantsCount),
          pets: Number(petsCount),
          totalThb: candidateBreakdown.total_thb,
          // Booking type is a property of the assigned unit, never a client choice
          instantBook: candidate.instantBook,
          guestNote,
          priceBreakdown: { ...candidateBreakdown },
          cancellationPolicySnapshot: { ...policy },
        });
      } catch (error) {
        // Someone took this villa while we were pricing it. Try the next one;
        // if there is no next one, the guest genuinely cannot be housed.
        if ((error as { code?: string })?.code === 'DOUBLE_BOOK' && !isLastCandidate) {
          continue;
        }
        throw error;
      }

      breakdown = candidateBreakdown;
      break;
    }

    const instantBook = booking.status !== 'requested';
    const method =
      paymentMethod === 'card_provider' || paymentMethod === 'bank_transfer'
        ? paymentMethod
        : 'cash';

    // If instant book and card payment method, create checkout session
    if (instantBook && method === 'card_provider') {
      const checkout = await createCheckout(prisma, {
        purpose: 'stay',
        bookingId: booking.id,
        payerIdentityId: user.identityId,
        amountThb: breakdown.total_thb,
      });

      return NextResponse.json(
        {
          booking,
          checkout,
        },
        { status: 201 }
      );
    }

    // Cash and bank transfer stay pending until staff record the receipt.
    if (instantBook && (method === 'cash' || method === 'bank_transfer')) {
      return NextResponse.json(
        {
          booking,
          message: 'Booking created. Payment to be recorded.',
        },
        { status: 201 }
      );
    }

    // For request-to-book, return the booking
    return NextResponse.json(
      {
        booking,
        message: 'Request to book created. Awaiting host approval.',
      },
      { status: 201 }
    );
  } catch (error) {
    // Dates taken is a 409 conflict (doc 07 F-GUEST-3), not a generic 400.
    if (error instanceof Error && (error as { code?: string }).code === 'DOUBLE_BOOK') {
      return NextResponse.json(
        { error: error.message, code: 'DOUBLE_BOOK' },
        { status: 409 }
      );
    }
    // Domain errors from the pricing/booking engine carry guest-actionable
    // messages (dates unavailable, below min nights, party too large)
    if (error instanceof Error && !(error as { statusCode?: number }).statusCode) {
      const msg = error.message;
      if (
        msg.includes('unavailable') ||
        msg.includes('minimum') ||
        msg.includes('exceeds') ||
        msg.includes('not found')
      ) {
        return NextResponse.json({ error: msg }, { status: 400 });
      }
    }
    return handleError(error);
  }
}
