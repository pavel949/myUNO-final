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
 * Canonical request contract:
 * - unitId: string — book a specific physical unit; OR
 * - inventoryCategoryId: string — book a canonical sellable category and let
 *   the server assign an available unit.
 *
 * Compatibility contract during migration:
 * - categoryKey + projectId remains accepted for older clients. The key is not
 *   authoritative when inventoryCategoryId is present; the InventoryCategory
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
 *
 * The total is ALWAYS computed server-side from the production pricing engine;
 * any client-sent amount is ignored.
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
      inventoryCategoryId,
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

    const hasCategorySelector = Boolean(inventoryCategoryId || categoryKey);

    if (
      (!requestedUnitId && !hasCategorySelector) ||
      (!requestedUnitId && !inventoryCategoryId && !projectId) ||
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
    if (!Number.isFinite(guestCount) || guestCount < 1) {
      throw createPublicError('invalid request: at least one guest is required', 400);
    }

    // Resolve a canonical category once, at the API boundary. Older internals
    // still accept categoryKey while they are migrated, but every canonical
    // caller is now anchored to an InventoryCategory row and its own project.
    let resolvedProjectId = projectId as string | undefined;
    let resolvedCategoryKey = categoryKey as string | undefined;
    let resolvedInventoryCategoryId = inventoryCategoryId as string | undefined;

    if (!requestedUnitId && inventoryCategoryId) {
      const category = await prisma.inventoryCategory.findUnique({
        where: { id: inventoryCategoryId },
        select: {
          id: true,
          projectId: true,
          categoryKey: true,
          status: true,
        },
      });

      if (!category || category.status !== 'active') {
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
      throw createPublicError(
        'no villa of this category is available for these dates',
        409
      );
    }

    let booking!: Awaited<ReturnType<typeof createBooking>>;
    let breakdown!: Awaited<ReturnType<typeof computePriceBreakdown>>;

    for (const [index, candidate] of candidates.entries()) {
      const isLastCandidate = index === candidates.length - 1;

      // Preserve the proven production money path while category contracts are
      // canonicalized. Pricing parity with EffectiveStayOffer is a separate gate.
      const candidateBreakdown = await computePriceBreakdown(
        prisma,
        candidate.id,
        startDate,
        endDate,
        guestCount,
        undefined,
        Number(petsCount)
      );

      const unit = await prisma.unit.findUnique({
        where: { id: candidate.id },
        select: {
          cancellationPolicyKey: true,
          status: true,
          projectId: true,
          inventoryCategoryId: true,
        },
      });
      if (!unit || unit.status !== 'live') {
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
          instantBook: candidate.instantBook,
          guestNote,
          priceBreakdown: {
            ...candidateBreakdown,
            ...(resolvedInventoryCategoryId && {
              inventory_category_id: resolvedInventoryCategoryId,
            }),
          },
          cancellationPolicySnapshot: { ...policy },
        });
      } catch (error) {
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
    if (error instanceof Error && (error as { code?: string }).code === 'DOUBLE_BOOK') {
      return NextResponse.json(
        { error: error.message, code: 'DOUBLE_BOOK' },
        { status: 409 }
      );
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
