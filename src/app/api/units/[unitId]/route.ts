import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { track } from '@/modules/analytics';
import { resolveEffectiveStayOffer } from '@/modules/booking';
import { getCurrentUser } from '@/app/actions/getCurrentUser';

/**
 * GET /api/units/[unitId]
 * Public unit detail for the guest-facing unit page (S4).
 * Only live units are visible; returns the guest-safe subset of fields
 * (no owner identity, no engagement economics, no internal status detail).
 *
 * When startDate + endDate are supplied, `pricing` is resolved through the
 * canonical InventoryCategory → RatePlan → PricingRule quotation engine.
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
      unit.project.status !== 'live'
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
      const offer = await resolveEffectiveStayOffer(prisma, {
        unitId: unit.id,
        startDate,
        endDate,
        guests,
        ratePlanCode: 'BAR',
      });
      const toBaht = (satang: number) => Math.round(satang / 100);
      pricing = {
        ratePlanCode: offer.ratePlanCode,
        nights: offer.nightsCount,
        averageNightly:
          offer.nightsCount > 0 ? toBaht(Math.round(offer.subtotalThb / offer.nightsCount)) : 0,
        subtotal: toBaht(offer.subtotalThb),
        vatTax: toBaht(offer.vatTaxThb),
        total: toBaht(offer.totalThb),
        minNights: offer.minNights,
        cancellationPolicyKey: offer.cancellationPolicyKey,
        isAvailable: offer.isAvailable,
        availableCapacity: offer.availableCapacity,
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
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
