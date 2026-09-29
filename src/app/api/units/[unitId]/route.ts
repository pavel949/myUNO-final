import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { track } from '@/modules/analytics';
import { computePriceBreakdown, checkAvailability } from '@/modules/core';
import { excludedSourceControlledUnits } from '@/modules/booking/source-authority';
import { getCurrentUser } from '@/app/actions/getCurrentUser';

/**
 * GET /api/units/[unitId]
 * Public unit detail for the guest-facing unit page (S4).
 * Only live units are visible; returns the guest-safe subset of fields
 * (no owner identity, no engagement economics, no internal status detail).
 *
 * When startDate + endDate are supplied, `pricing` is resolved through the
 * the same canonical calculator used by search, checkout and Booking.
 * The inventory read additionally respects live bookings/holds, owner/OTA
 * blocks and source-calendar cutover. It is advisory; booking commits still
 * re-check availability transactionally.
 * Legacy baseNightlyThb/minNights remain in the response temporarily for old
 * clients, but new guest surfaces should prefer `pricing`.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { unitId: string } }
) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const startDateStr = searchParams.get('startDate');
    const endDateStr = searchParams.get('endDate');
    const parsedGuests = Number(searchParams.get('guests') || '1');
    const guests = Number.isFinite(parsedGuests) && parsedGuests > 0 ? parsedGuests : 1;

    if ((startDateStr && !endDateStr) || (!startDateStr && endDateStr)) {
      return NextResponse.json(
        { error: 'startDate and endDate must be supplied together' },
        { status: 400 }
      );
    }

    const startDate = startDateStr ? new Date(startDateStr) : undefined;
    const endDate = endDateStr ? new Date(endDateStr) : undefined;
    if (
      (startDate && Number.isNaN(startDate.getTime())) ||
      (endDate && Number.isNaN(endDate.getTime())) ||
      (startDate && endDate && startDate >= endDate)
    ) {
      return NextResponse.json({ error: 'invalid stay dates' }, { status: 400 });
    }

    const unit = await prisma.unit.findUnique({
      where: { id: params.unitId },
      select: {
        id: true,
        projectId: true,
        inventoryCategoryId: true,
        name: true,
        unitType: true,
        bedrooms: true,
        bathrooms: true,
        maxGuests: true,
        sizeSqm: true,
        amenityKeys: true,
        baseNightlyThb: true,
        minNights: true,
        instantBook: true,
        cancellationPolicyKey: true,
        status: true,
        assetStatus: true,
        inventoryCategory: {
          select: {
            id: true,
            categoryKey: true,
            name: true,
            status: true,
            minNights: true,
          },
        },
        project: {
          select: { id: true, name: true, status: true },
        },
        coverMedia: { select: { storageKey: true } },
        media: {
          orderBy: { sort: 'asc' },
          select: { media: { select: { id: true, storageKey: true } } },
        },
      },
    });

    // A unit is public only when both the unit and project are live and the
    // physical asset is not suspended.
    if (
      !unit ||
      unit.status !== 'live' ||
      unit.assetStatus === 'suspended' ||
      unit.project.status !== 'live' ||
      unit.inventoryCategory?.status !== 'live'
    ) {
      return NextResponse.json({ error: 'Unit not found' }, { status: 404 });
    }

    let pricing: {
      ratePlanCode: string;
      nights: number;
      averageNightly: number;
      subtotal: number;
      vatTax: number;
      total: number;
      minNights: number;
      cancellationPolicyKey: string;
      isAvailable: boolean;
      availableCapacity: number;
    } | null = null;

    if (startDate && endDate) {
      // Never quote with the legacy effective-offer calculator: it has
      // independent tax/discount semantics and does not inspect bookings.
      // This is the exact price authority used by /api/pricing/breakdown and
      // createBooking; the final capacity claim remains transactional there.
      const [breakdown, calendarAvailable, sourceExcluded] = await Promise.all([
        computePriceBreakdown(prisma, unit.id, startDate, endDate, guests),
        checkAvailability(prisma, unit.id, startDate, endDate),
        excludedSourceControlledUnits(prisma, [unit.id]),
      ]);
      const nights = breakdown.lines.length;
      const toBaht = (satang: number) => Math.round(satang / 100);
      const isAvailable = calendarAvailable && sourceExcluded.length === 0;
      pricing = {
        ratePlanCode: 'BAR',
        nights,
        averageNightly: nights > 0 ? toBaht(Math.round(breakdown.subtotal_thb / nights)) : 0,
        subtotal: toBaht(breakdown.subtotal_thb),
        vatTax: toBaht(breakdown.occupancy_tax_thb),
        total: toBaht(breakdown.total_thb),
        minNights: breakdown.commercialTerms?.minimumNights ??
          unit.inventoryCategory?.minNights ?? unit.minNights,
        cancellationPolicyKey: unit.cancellationPolicyKey ?? 'flexible',
        isAvailable,
        availableCapacity: isAvailable ? 1 : 0,
      };
    }

    // Doc 13: page_unit_viewed feeds the listing_engagement buyer signal.
    const viewer = await getCurrentUser().catch(() => null);
    await track(prisma, 'page_unit_viewed', {
      unitId: unit.id,
      projectId: unit.projectId,
      identityId: viewer?.identityId,
    });

    const {
      status: _status,
      assetStatus: _assetStatus,
      coverMedia,
      media,
      project,
      ...rest
    } = unit;
    const publicUnit = { ...rest, project: { id: project.id, name: project.name } };
    const gallery = media.map((m) => m.media.storageKey);
    const cover = coverMedia?.storageKey || gallery[0] || null;
    return NextResponse.json({
      ...publicUnit,
      // Compatibility field for old clients. New date-aware surfaces use pricing.averageNightly.
      baseNightlyThb: Math.round(publicUnit.baseNightlyThb / 100),
      pricing,
      images: cover ? [cover, ...gallery.filter((g) => g !== cover)] : gallery,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    if (message.includes('minimum') || message.includes('exceeds')) {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    // Incomplete or unapproved source tariffs must fail closed without leaking
    // internal pricing configuration through a public response.
    return NextResponse.json({ error: 'Stay quote unavailable' }, { status: 503 });
  }
}
