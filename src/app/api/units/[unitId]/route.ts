import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { track } from '@/modules/analytics';
import { computePriceBreakdown, checkAvailability } from '@/modules/core';
import { excludedSourceControlledUnits } from '@/modules/booking/source-authority';
import { resolveStayCancellationPolicy } from '@/modules/booking';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { assessUnitMediaReadiness } from '@/modules/media/public-readiness';
import { managedImportedInventoryIds } from '@/modules/projects/public-managed-import';

/**
 * GET /api/units/[unitId]
 * Public unit detail for the guest-facing unit page (S4).
 * Live units and provenance-backed imported managed drafts can be visible;
 * returns the guest-safe subset of fields
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
        accommodationType: true,
        bedrooms: true,
        bathrooms: true,
        maxGuests: true,
        sizeSqm: true,
        amenityKeys: true,
        baseNightlyThb: true,
        minNights: true,
        instantBook: true,
        cancellationPolicyKey: true,
        coverMediaId: true,
        status: true,
        assetStatus: true,
        commercialOfferings: { select: { offeringType: true, status: true } },
        inventoryCategory: {
          select: {
            id: true,
            categoryKey: true,
            name: true,
            status: true,
            minNights: true,
            baseNightlyThb: true,
            cancellationPolicyKey: true,
            coverMediaId: true,
            coverMedia: {
              select: { id: true, storageKey: true, kind: true, mimeType: true, encrypted: true, sizeBytes: true },
            },
            galleryMedia: {
              orderBy: { sort: 'asc' },
              include: {
                media: {
                  select: { id: true, storageKey: true, kind: true, mimeType: true, encrypted: true, sizeBytes: true },
                },
              },
            },
          },
        },
        project: {
          select: { id: true, name: true, status: true, projectType: true },
        },
        coverMedia: {
          select: { id: true, storageKey: true, kind: true, mimeType: true, encrypted: true, sizeBytes: true },
        },
        media: {
          orderBy: { sort: 'asc' },
          include: {
            media: {
              select: { id: true, storageKey: true, kind: true, mimeType: true, encrypted: true, sizeBytes: true },
            },
          },
        },
      },
    });

    const managedImported = await managedImportedInventoryIds(prisma);
    const unitPublished =
      unit?.status === 'live' ||
      (unit?.status === 'draft' && managedImported.unitIds.includes(unit.id));
    const projectPublished =
      unit?.project.status === 'live' ||
      (unit?.project.status === 'draft' && managedImported.projectIds.includes(unit.project.id));

    // Legacy imported managed rows can be public before their old draft bit is
    // reconciled, but they still pass the complete stay-readiness gates below.
    if (
      !unit ||
      !unitPublished ||
      unit.assetStatus === 'suspended' ||
      !projectPublished ||
      unit.inventoryCategory?.status !== 'live' ||
      (Boolean(unit.project.projectType) && !unit.commercialOfferings.some(offer =>
        ['short_term_stay', 'short_stay'].includes(offer.offeringType) && offer.status === 'active'))
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
      cancellationPolicyKey: string | null;
      isAvailable: boolean;
      availableCapacity: number;
    } | null = null;

    // The policy the booking will snapshot (BAR plan > category > unit >
    // configured default): the page must show exactly what the guest is
    // bound by, never a "flexible" placeholder.
    const stayPolicyKey = await resolveStayCancellationPolicy(prisma, { unitId: unit.id })
      .then(policy => policy.name)
      .catch(() => null);

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
        cancellationPolicyKey: stayPolicyKey,
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

    const mediaReadiness = assessUnitMediaReadiness({
      projectType: unit.project.projectType,
      accommodationType: unit.accommodationType,
      unitCoverMediaId: unit.coverMediaId,
      unitMedia: unit.media,
      categoryCoverMediaId: unit.inventoryCategory?.coverMediaId,
      categoryMedia: unit.inventoryCategory?.galleryMedia ?? [],
    });
    if (!mediaReadiness.ready) {
      // A live database row is not automatically a guest-ready listing.
      // Search and public project/unit pages use the same media gate, so a
      // media-incomplete asset cannot be deep-linked around discovery.
      return NextResponse.json({ error: 'Unit not found' }, { status: 404 });
    }

    const {
      status: _status,
      assetStatus: _assetStatus,
      coverMedia: _coverMedia,
      media: _media,
      commercialOfferings: _commercialOfferings,
      inventoryCategory,
      project,
      ...rest
    } = unit;
    const publicUnit = {
      ...rest,
      inventoryCategory: inventoryCategory
        ? {
            id: inventoryCategory.id,
            categoryKey: inventoryCategory.categoryKey,
            name: inventoryCategory.name,
          }
        : null,
      project: { id: project.id, name: project.name },
    };
    const coverUrl = mediaReadiness.coverUrl;

    return NextResponse.json({
      ...publicUnit,
      // Money boundary: all *Thb integer fields stay in satang until the final
      // rendering component. Date-aware pricing below remains a legacy baht DTO.
      baseNightlyThb: publicUnit.baseNightlyThb,
      // The canonical base (InventoryCategory) for the headline when no dates
      // are chosen. With dates, the headline uses `pricing.averageNightly`,
      // the same calculator the booking charges with.
      baseRateSatang: unit.inventoryCategory?.baseNightlyThb ?? unit.baseNightlyThb,
      cancellationPolicyKey: stayPolicyKey,
      pricing,
      photoScope: mediaReadiness.photoScope,
      mediaReadiness: {
        ready: true,
        photoCount: mediaReadiness.photoCount,
        representative: mediaReadiness.representative,
      },
      images: coverUrl
        ? [coverUrl, ...mediaReadiness.urls.filter((url) => url !== coverUrl)]
        : mediaReadiness.urls,
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
