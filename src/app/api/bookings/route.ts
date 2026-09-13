import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import {
  createBooking,
  resolveCancellationPolicy,
  resolveInventoryCategory,
  findAvailableUnitsForInventoryCategory,
  resolveEffectiveStayOffer,
} from '@/modules/booking';
import { createCheckout } from '@/modules/finance';
import { computePriceBreakdown } from '@/modules/core';
import { handleError, createPublicError } from '@/app/libs/errorHandler';

/**
 * POST /api/bookings
 *
 * Canonical category contract: `categoryId` is authoritative. `categoryKey`
 * remains accepted only as a compatibility public slug and is resolved through
 * InventoryCategory before availability or booking logic runs.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) throw createPublicError('unauthorized', 401);

    const body = await req.json();
    const {
      unitId: requestedUnitId,
      categoryId: requestedCategoryId,
      categoryKey,
      projectId,
      ratePlanCode = 'BAR',
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

    if (
      (!requestedUnitId && !requestedCategoryId && !categoryKey) ||
      (!requestedUnitId && !projectId && !requestedCategoryId) ||
      !startDateStr ||
      !endDateStr ||
      adultsCount === undefined ||
      childrenCount === undefined ||
      (requestedUnitId && requestedInstantBook === undefined)
    ) {
      throw createPublicError('invalid request: missing required fields', 400);
    }

    const startDate = new Date(startDateStr);
    const endDate = new Date(endDateStr);
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime()) || startDate >= endDate) {
      throw createPublicError('invalid request: startDate must be before endDate', 400);
    }

    const guestCount = Number(adultsCount) + Number(childrenCount);

    const canonicalCategory = requestedUnitId
      ? null
      : await resolveInventoryCategory(prisma, {
          projectId,
          categoryId: requestedCategoryId,
          categoryKey,
        });

    if (!requestedUnitId && !canonicalCategory) {
      throw createPublicError('inventory category not found', 404);
    }

    const candidates = requestedUnitId
      ? [{ id: requestedUnitId, instantBook: requestedInstantBook }]
      : await findAvailableUnitsForInventoryCategory(
          prisma,
          canonicalCategory!.id,
          startDate,
          endDate
        );

    if (candidates.length === 0) {
      throw createPublicError('no unit of this category is available for these dates', 409);
    }

    let booking!: Awaited<ReturnType<typeof createBooking>>;
    let breakdown!: Awaited<ReturnType<typeof computePriceBreakdown>>;

    for (const [index, candidate] of candidates.entries()) {
      const isLastCandidate = index === candidates.length - 1;

      const unit = await prisma.unit.findUnique({
        where: { id: candidate.id },
        select: {
          id: true,
          status: true,
          projectId: true,
          inventoryCategoryId: true,
          inventoryCategory: { select: { id: true } },
        },
      });
      if (!unit || unit.status !== 'live') throw createPublicError('not found', 404);
      if (projectId && projectId !== unit.projectId) {
        throw createPublicError('unit does not belong to the given project', 400);
      }
      if (canonicalCategory && unit.inventoryCategoryId !== canonicalCategory.id) {
        throw createPublicError('unit does not belong to the selected inventory category', 400);
      }

      const offer = await resolveEffectiveStayOffer(prisma, {
        projectId: unit.projectId,
        categoryId: unit.inventoryCategoryId ?? undefined,
        unitId: unit.id,
        ratePlanCode,
        startDate,
        endDate,
        guests: guestCount,
      });
      if (!offer.isAvailable) {
        if (!isLastCandidate) continue;
        throw createPublicError('selected inventory is unavailable for these dates', 409);
      }

      // Full booking breakdown retains taxes/fees/LOS/early-bird rules while its
      // nightly base is migrated to canonical InventoryCategory in the core
      // pricing service. Client-provided totals are never trusted.
      const candidateBreakdown = await computePriceBreakdown(
        prisma,
        candidate.id,
        startDate,
        endDate,
        guestCount,
        undefined,
        Number(petsCount)
      );

      const policy = await resolveCancellationPolicy(prisma, offer.cancellationPolicyKey, {
        projectId: unit.projectId,
        unitId: candidate.id,
      });

      try {
        booking = await createBooking(prisma, {
          unitId: candidate.id,
          projectId: unit.projectId,
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
          instantBook: candidate.instantBook,
          guestNote,
          priceBreakdown: {
            ...candidateBreakdown,
            canonical: {
              categoryId: offer.categoryId ?? null,
              ratePlanCode: offer.ratePlanCode,
              minNights: offer.minNights,
              source: 'InventoryCategory+RatePlan',
            },
          },
          cancellationPolicySnapshot: { ...policy },
        });
      } catch (error) {
        if ((error as { code?: string })?.code === 'DOUBLE_BOOK' && !isLastCandidate) continue;
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

    if (instantBook && method === 'card_provider') {
      const checkout = await createCheckout(prisma, {
        purpose: 'stay',
        bookingId: booking.id,
        payerIdentityId: user.identityId,
        amountThb: breakdown.total_thb,
      });
      return NextResponse.json({ booking, checkout }, { status: 201 });
    }

    if (instantBook && (method === 'cash' || method === 'bank_transfer')) {
      return NextResponse.json(
        { booking, message: 'Booking created. Payment to be recorded.' },
        { status: 201 }
      );
    }

    return NextResponse.json(
      { booking, message: 'Request to book created. Awaiting host approval.' },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof Error && (error as { code?: string }).code === 'DOUBLE_BOOK') {
      return NextResponse.json({ error: error.message, code: 'DOUBLE_BOOK' }, { status: 409 });
    }
    if (error instanceof Error && !(error as { statusCode?: number }).statusCode) {
      const msg = error.message;
      if (
        msg.includes('unavailable') ||
        msg.includes('minimum') ||
        msg.includes('exceeds') ||
        msg.includes('not found') ||
        msg.includes('category')
      ) {
        return NextResponse.json({ error: msg }, { status: 400 });
      }
    }
    return handleError(error);
  }
}
