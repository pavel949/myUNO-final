import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import {
  createBookingAttempt,
  findBookingByCreationIntent,
  resolveStayCancellationPolicy,
  sourceSeasonCancellationPolicy,
  findAvailableUnitsForCategory,
} from '@/modules/booking';
import { createCheckout } from '@/modules/finance';
import { computePriceBreakdown, StayUnquotableError } from '@/modules/core';
import { verifyCategoryStayQuoteToken } from '@/modules/booking/category-quote';
import { handleError, createPublicError } from '@/app/libs/errorHandler';
import { bookingCreationIntent, isBookingCreationKey, type BookingCreationIntent } from '@/modules/booking/creation-intent';
import { getConfig } from '@/modules/config';

function replayResponse(booking: NonNullable<Awaited<ReturnType<typeof findBookingByCreationIntent>>>) {
  // The booking is already durable. Never open another payment session on a
  // repeated create; the trip's authenticated checkout resumes its payment.
  return NextResponse.json({ booking, replayed: true }, { status: 200 });
}

/** Recover after refresh without needing a still-valid quote or free inventory. */
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) throw createPublicError('unauthorized', 401);
    const key = req.nextUrl.searchParams.get('idempotencyKey');
    if (!isBookingCreationKey(key)) throw createPublicError('invalid booking attempt', 400);
    const booking = await prisma.booking.findUnique({
      where: { guestIdentityId_creationKey: { guestIdentityId: user.identityId, creationKey: key.toLowerCase() } },
      select: { id: true, status: true },
    });
    if (!booking) throw createPublicError('not found', 404);
    return NextResponse.json({ booking }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    return handleError(error);
  }
}

/**
 * POST /api/bookings
 * Create a new booking (instant or request-to-book).
 * Requires authentication.
 *
 * Canonical request contract:
 * - unitId: string — book a specific physical unit; OR
 * - inventoryCategoryId/categoryId: string — book a canonical sellable category and let
 *   the server assign an available unit.
 *
 * Compatibility contract during migration:
 * - categoryKey + projectId remains accepted for older clients. The key is not
 *   authoritative when a canonical category id is present; the InventoryCategory
 *   row supplies both the project and compatibility key.
 *
 * Other fields:
 * - projectId?: string — optional on the canonical category path and on the
 *   specific-unit path. If supplied it must agree with the server-side asset.
 * - startDate/endDate: ISO dates
 * - adultsCount/childrenCount
 * - instantBook: required only for the specific-unit path; category booking
 *   gets this from the assigned unit.
 * - guestNote?
 * - paymentMethod?: 'cash' | 'card_provider' | 'bank_transfer'
 * - idempotencyKey: UUID identifying one guest-approved creation attempt
 *
 * The total is ALWAYS computed server-side. acceptedTotalSatang is a required
 * consent ceiling, never an authoritative price, for both entry paths.
 */
export async function POST(req: NextRequest) {
  let recovery: { identityId: string; intent: BookingCreationIntent } | undefined;
  try {
    const user = await getCurrentUser();
    if (!user) {
      throw createPublicError('unauthorized', 401);
    }

    const body = await req.json();
    const {
      unitId: requestedUnitId,
      inventoryCategoryId: requestedInventoryCategoryId,
      categoryId,
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
      categoryQuoteToken,
      acceptedTotalSatang,
      idempotencyKey,
    } = body;

    const inventoryCategoryId = requestedInventoryCategoryId || categoryId;
    if (!['cash', 'bank_transfer', 'card_provider'].includes(paymentMethod)) {
      throw createPublicError('invalid payment method', 400);
    }
    const hasCategorySelector = Boolean(inventoryCategoryId || categoryKey);

    if (
      (!requestedUnitId && !hasCategorySelector) ||
      (!requestedUnitId && !inventoryCategoryId && !projectId) ||
      !startDateStr ||
      !endDateStr ||
      adultsCount === undefined ||
      childrenCount === undefined ||
      (requestedUnitId && typeof requestedInstantBook !== 'boolean')
    ) {
      throw createPublicError('invalid request: missing required fields', 400);
    }

    const startDate = new Date(startDateStr);
    const endDate = new Date(endDateStr);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime()) || startDate >= endDate) {
      throw createPublicError('invalid request: startDate must be before endDate', 400);
    }

    const guestCount = Number(adultsCount) + Number(childrenCount);
    if (!Number.isFinite(guestCount) || guestCount < 1) {
      throw createPublicError('invalid request: at least one guest is required', 400);
    }

    if (!isBookingCreationKey(idempotencyKey)) {
      throw createPublicError('A valid booking attempt key is required', 400);
    }
    const creationIntent = bookingCreationIntent(idempotencyKey, {
      unitId: requestedUnitId, inventoryCategoryId, categoryKey, projectId,
      startDate, endDate, adults: Number(adultsCount), children: Number(childrenCount),
      infants: Number(infantsCount), pets: Number(petsCount), instantBook: requestedInstantBook,
      paymentMethod, guestNote,
    });
    recovery = { identityId: user.identityId, intent: creationIntent };
    const previous = await findBookingByCreationIntent(prisma, user.identityId, creationIntent);
    if (previous) return replayResponse(previous);

    // Resolve a canonical category once, at the API boundary. Older internals
    // still accept categoryKey while they are migrated, but every canonical
    // caller is anchored to an InventoryCategory row and its own project.
    let resolvedProjectId = projectId as string | undefined;
    let resolvedCategoryKey = categoryKey as string | undefined;
    let resolvedInventoryCategoryId = inventoryCategoryId as string | undefined;

    if (!requestedUnitId && !inventoryCategoryId && categoryKey && projectId) {
      const legacyCategory = await prisma.inventoryCategory.findUnique({
        where: { projectId_categoryKey: { projectId, categoryKey } },
        select: { id: true },
      });
      if (legacyCategory) {
        resolvedInventoryCategoryId = legacyCategory.id;
      }
    }

    if (!requestedUnitId && resolvedInventoryCategoryId) {
      const category = await prisma.inventoryCategory.findUnique({
        where: { id: resolvedInventoryCategoryId },
        select: {
          id: true,
          projectId: true,
          categoryKey: true,
          status: true,
        },
      });

      if (!category || category.status !== 'live') {
        throw createPublicError('inventory category not found', 404);
      }
      if (projectId && projectId !== category.projectId) {
        throw createPublicError('inventory category does not belong to the given project', 400);
      }
      if (categoryKey && categoryKey !== category.categoryKey) {
        throw createPublicError('categoryKey disagrees with inventoryCategoryId', 400);
      }

      resolvedProjectId = category.projectId;
      resolvedCategoryKey = category.categoryKey;
      resolvedInventoryCategoryId = category.id;
    }

    if (!Number.isSafeInteger(acceptedTotalSatang) || acceptedTotalSatang < 0) {
      return NextResponse.json(
        { error: 'Review a current stay quote before booking.', code: 'REQUOTE_REQUIRED' },
        { status: 409 }
      );
    }
    let acceptedTotal: number = acceptedTotalSatang;
    if (!requestedUnitId) {
      if (
        !resolvedInventoryCategoryId ||
        typeof categoryQuoteToken !== 'string' ||
        !Number.isInteger(acceptedTotalSatang)
      ) {
        throw createPublicError('A current category quote and accepted total are required', 409);
      }

      const quote = verifyCategoryStayQuoteToken(categoryQuoteToken);
      if (
        !quote ||
        quote.inventoryCategoryId !== resolvedInventoryCategoryId ||
        quote.projectId !== resolvedProjectId ||
        quote.startDate !== startDateStr ||
        quote.endDate !== endDateStr ||
        quote.adultsCount !== Number(adultsCount) ||
        quote.childrenCount !== Number(childrenCount) ||
        quote.petsCount !== Number(petsCount) ||
        quote.acceptedTotalSatang !== acceptedTotalSatang
      ) {
        return NextResponse.json(
          {
            error: 'The category quote expired or no longer matches this stay.',
            code: 'REQUOTE_REQUIRED',
          },
          { status: 409 }
        );
      }
      acceptedTotal = quote.acceptedTotalSatang;
    }

    const candidates = requestedUnitId
      ? [{ id: requestedUnitId, instantBook: requestedInstantBook }]
      : await findAvailableUnitsForCategory(
          prisma,
          resolvedProjectId as string,
          resolvedCategoryKey as string,
          startDate,
          endDate
        );

    if (candidates.length === 0) {
      const error = new Error('no villa of this category is available for these dates');
      (error as Error & { code: string }).code = 'DOUBLE_BOOK';
      throw error;
    }

    let booking!: Awaited<ReturnType<typeof createBookingAttempt>>['booking'];

    for (const [index, candidate] of candidates.entries()) {
      const isLastCandidate = index === candidates.length - 1;

      const candidateBreakdown = await computePriceBreakdown(
        prisma,
        candidate.id,
        startDate,
        endDate,
        guestCount,
        undefined,
        Number(petsCount)
      );

      if (candidateBreakdown.total_thb > acceptedTotal) {
        if (isLastCandidate) {
          const error = new Error('Available homes now cost more than the amount you accepted.');
          (error as Error & { code: string }).code = 'REQUOTE_REQUIRED';
          throw error;
        }
        continue;
      }

      const unit = await prisma.unit.findUnique({
        where: { id: candidate.id },
        select: {
          cancellationPolicyKey: true,
          instantBook: true,
          status: true,
          projectId: true,
          inventoryCategoryId: true,
          inventoryCategory: { select: { status: true } },
        },
      });
      if (!unit || unit.status !== 'live' || unit.inventoryCategory?.status !== 'live') {
        throw createPublicError('not found', 404);
      }

      const bookingProjectId = unit.projectId;
      if (projectId && projectId !== bookingProjectId) {
        throw createPublicError('unit does not belong to the given project', 400);
      }
      if (
        resolvedInventoryCategoryId &&
        unit.inventoryCategoryId &&
        unit.inventoryCategoryId !== resolvedInventoryCategoryId
      ) {
        throw createPublicError('assigned unit does not belong to the requested inventory category', 409);
      }

      // Read the actual asset's project, never a client-selected scope. Manual
      // rails reserve capacity without a card timeout, so an enum check alone
      // would let a caller create untimed holds on a card-only property.
      const enabledMethods = await getConfig(prisma, 'booking.payment.methods_enabled', {
        projectId: bookingProjectId,
      }) ?? ['cash', 'bank_transfer'];
      if (!Array.isArray(enabledMethods) || !enabledMethods.includes(paymentMethod)) {
        return NextResponse.json({
          error: 'This payment method is unavailable for this property. Review the available payment options.',
          code: 'PAYMENT_METHOD_UNAVAILABLE',
        }, { status: 400 });
      }

      // The same resolver the unit and review pages show the guest: the
      // snapshot is the policy they consented to (BAR plan > category > unit).
      // Season ladder from the quoted source terms when the stay has one
      // (ruling 2026-10-06), else the configured policy.
      const policy = sourceSeasonCancellationPolicy(candidateBreakdown.commercialTerms)
        ?? await resolveStayCancellationPolicy(prisma, { unitId: candidate.id });

      try {
        const attempt = await createBookingAttempt(prisma, {
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
          acceptedMaxTotalThb: acceptedTotal,
          instantBook: unit.instantBook && (!requestedUnitId || requestedInstantBook === true),
          paymentMethod,
          creationIntent,
          guestNote,
          priceBreakdown: {
            ...candidateBreakdown,
            ...(resolvedInventoryCategoryId && {
              inventory_category_id: resolvedInventoryCategoryId,
            }),
          },
          cancellationPolicySnapshot: { ...policy },
        });
        booking = attempt.booking;
        if (attempt.replayed) return replayResponse(booking);
      } catch (error) {
        if ((error as { code?: string })?.code === 'DOUBLE_BOOK' && !isLastCandidate) {
          continue;
        }
        throw error;
      }

      break;
    }

    const instantBook = booking.status !== 'requested';
    const method = paymentMethod;

    if (instantBook && method === 'card_provider') {
      let checkout: Awaited<ReturnType<typeof createCheckout>>;
      try {
        checkout = await createCheckout(prisma, {
          purpose: 'stay', bookingId: booking.id,
          payerIdentityId: user.identityId, amountThb: booking.totalThb,
        });
      } catch {
        // Creation already committed. Report the unavailable rail honestly and
        // keep the same booking recoverable; no replacement stay/payment.
        return NextResponse.json({
          booking, code: 'CHECKOUT_UNAVAILABLE',
          error: 'Your booking was saved, but card checkout is unavailable. Open your trip to review the payment status.',
        }, { status: 503 });
      }

      return NextResponse.json(
        {
          booking,
          checkout,
          ...(resolvedInventoryCategoryId && { inventoryCategoryId: resolvedInventoryCategoryId }),
        },
        { status: 201 }
      );
    }

    if (instantBook && (method === 'cash' || method === 'bank_transfer')) {
      return NextResponse.json(
        {
          booking,
          ...(resolvedInventoryCategoryId && { inventoryCategoryId: resolvedInventoryCategoryId }),
          message: 'Booking created. Payment to be recorded.',
        },
        { status: 201 }
      );
    }

    return NextResponse.json(
      {
        booking,
        ...(resolvedInventoryCategoryId && { inventoryCategoryId: resolvedInventoryCategoryId }),
        message: 'Request to book created. Awaiting host approval.',
      },
      { status: 201 }
    );
  } catch (error) {
    // The winner may have committed after the early lookup, before this
    // request discovered exhausted inventory or a failed checkout response.
    if (recovery && (error as { code?: string })?.code !== 'BOOKING_INTENT_CONFLICT') {
      try {
        const previous = await findBookingByCreationIntent(prisma, recovery.identityId, recovery.intent);
        if (previous) return replayResponse(previous);
      } catch (recoveryError) {
        error = recoveryError;
      }
    }
    if (error instanceof Error && (error as { code?: string }).code === 'BOOKING_INTENT_CONFLICT') {
      return NextResponse.json({ error: error.message, code: 'BOOKING_INTENT_CONFLICT' }, { status: 409 });
    }
    if (error instanceof Error && (error as { code?: string }).code === 'REQUOTE_REQUIRED') {
      return NextResponse.json(
        { error: error.message, code: 'REQUOTE_REQUIRED' },
        { status: 409 }
      );
    }
    if (error instanceof Error && (error as { code?: string }).code === 'DOUBLE_BOOK') {
      return NextResponse.json(
        { error: error.message, code: 'DOUBLE_BOOK' },
        { status: 409 }
      );
    }
    if (error instanceof StayUnquotableError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 400 });
    }
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
