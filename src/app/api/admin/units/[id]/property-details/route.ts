import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin, failed } from '@/app/libs/onboardingGuard';
import { assertCommercialOfferingReadyForActivation } from '@/modules/onboarding';
import { saveSleepingSpace, SleepingSpaceRequestConflict } from '@/modules/projects/sleeping-space-write';

/**
 * A mapped Layantara home remains source-owned until independently verified
 * cutover. Admin editing must not silently turn a staged offer into live sale.
 */
async function layantaraAuthority(unitId: string): Promise<{ linked: boolean; verified: boolean }> {
  const mapping = await prisma.externalMapping.findFirst({
    where: { entity_type: 'unit', internal_id: unitId,
      externalSystem: { system_key: 'layantara_os' } },
    select: { externalSystem: { select: { config: true } } },
  });
  if (!mapping) return { linked: false, verified: false };
  const config = mapping.externalSystem.config;
  const safe = typeof config === 'object' && config !== null &&
    !Array.isArray(config) ? config as Record<string, unknown> : {};
  return { linked: true, verified:
    safe.bookingAuthority === 'myuno' && safe.cutoverVerified === true };
}

async function findExistingStayOffering(unitId: string) {
  const offers = await prisma.commercialOffering.findMany({
    where: { unitId, offeringType: { in: ['short_term_stay', 'short_stay'] } },
    orderBy: { createdAt: 'asc' },
  });
  const canonical = offers.find(offer => offer.offeringType === 'short_term_stay') ?? null;
  const legacy = offers.find(offer => offer.offeringType === 'short_stay') ?? null;
  if (canonical && legacy) {
    throw new Error('duplicate_stay_offering_records');
  }
  if (canonical) return canonical;
  if (!legacy) return null;
  // One-time in-place normalization keeps the offering ID and all channel
  // mappings while removing the legacy vocabulary from future writes.
  return prisma.commercialOffering.update({
    where: { id: legacy.id },
    data: { offeringType: 'short_term_stay' },
  });
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.error;
  const unit = await prisma.unit.findUnique({
    where: { id: params.id },
    include: {
      sleepingSpaces: { include: { beds: true }, orderBy: { sortOrder: 'asc' } },
      commercialOfferings: { include: { channelMappings: true } },
      inventoryCategory: true,
      media: { include: { media: true }, orderBy: { sort: 'asc' } },
    },
  });
  return unit ? NextResponse.json(unit) : NextResponse.json({ error: 'Unit not found' }, { status: 404 });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.error;
  try {
    const body = await req.json();
    if (body.action === 'sleeping_space') {
      try {
        const { space, created } = await saveSleepingSpace(prisma, params.id, body);
        return NextResponse.json(space, { status: created ? 201 : 200 });
      } catch (error) {
        if (error instanceof SleepingSpaceRequestConflict) {
          return NextResponse.json({ error: error.message }, { status: 409 });
        }
        throw error;
      }
    }
    if (body.action === 'stay_offering') {
      const unit = await prisma.unit.findUnique({
        where: { id: params.id },
        select: { id: true, baseNightlyThb: true,
          inventoryCategory: { select: { baseNightlyThb: true, status: true } } },
      });
      if (!unit) return NextResponse.json({ error: 'Unit not found' }, { status: 404 });
      const authority = await layantaraAuthority(params.id);
      const status = body.status ?? 'draft';
      if (!['active', 'paused', 'draft'].includes(status)) {
        return NextResponse.json({ error: 'Invalid stay offering status' }, { status: 400 });
      }
      // Read the canonical offer first on source-linked units; historical
      // short_stay offers remain accessible for legacy non-Layantara units.
      const existing = await findExistingStayOffering(params.id);
      if (status === 'active' && authority.linked) {
        if (!authority.verified) return NextResponse.json(
          { error: 'source_calendar_cutover_required' }, { status: 409 });
        const terms = existing?.pricingTerms;
        const priceValidated = typeof terms === 'object' && terms !== null &&
          !Array.isArray(terms) &&
          (terms as Record<string, unknown>).quoteEngine === 'canonical_tariff_grid_v1' &&
          (terms as Record<string, unknown>).taxPolicyVerified === true &&
          (terms as Record<string, unknown>).policyEngineVerified === true;
        if (!priceValidated || unit.baseNightlyThb <= 0 ||
            !unit.inventoryCategory || unit.inventoryCategory.status !== 'live' ||
            unit.inventoryCategory.baseNightlyThb <= 0) {
          return NextResponse.json({ error: 'verified_pricing_required' }, { status: 409 });
        }
      }
      if (status === 'active') {
        await assertCommercialOfferingReadyForActivation(
          prisma,
          params.id,
          'short_term_stay',
        );
      }
      const offering = existing
        ? await prisma.commercialOffering.update({ where: { id: existing.id }, data: { status } })
        : await prisma.commercialOffering.create({
            data: { unitId: params.id, offeringType: 'short_term_stay', status },
          });
      return NextResponse.json(offering, { status: existing ? 200 : 201 });
    }
    if (body.action === 'commercial_offering') {
      // Sale and long-term rental are commercial uses of the same physical
      // unit (CANONICAL_PROPERTY_DATA_ARCHITECTURE layer 2). Activating one
      // here does not publish it by itself: /homes still requires verified
      // title + sale authority (sale) or an evidenced mandate + permitted use
      // (rent) — commercial-discovery.ts. Before this action there was no
      // way to activate either, so no unit could reach the public listings.
      const offeringType = body.offeringType;
      const status = body.status ?? 'active';
      if (!['sale', 'long_term_rental'].includes(offeringType)) {
        return NextResponse.json({ error: 'offeringType must be sale or long_term_rental' }, { status: 400 });
      }
      if (!['active', 'paused', 'draft'].includes(status)) {
        return NextResponse.json({ error: 'Invalid offering status' }, { status: 400 });
      }
      const unit = await prisma.unit.findUnique({ where: { id: params.id }, select: { id: true } });
      if (!unit) return NextResponse.json({ error: 'Unit not found' }, { status: 404 });
      if (offeringType === 'long_term_rental' && status === 'active' && (await layantaraAuthority(params.id)).linked) {
        // Occupancy of a source-linked unit is owned by its PMS; a lease
        // cannot be sold against it here.
        return NextResponse.json({ error: 'source_owned_occupancy' }, { status: 409 });
      }
      const offering = await prisma.commercialOffering.upsert({
        where: { unitId_offeringType: { unitId: params.id, offeringType } },
        create: { unitId: params.id, offeringType, status },
        update: { status },
      });
      return NextResponse.json(offering);
    }
    if (body.action === 'channel_mapping') {
      if (body.syncState === 'ari_push') throw new Error('ARI push cannot be marked manually; connect a verified ARI provider first');
      const requestedType = body.offeringType || 'short_term_stay';
      const stayType = requestedType === 'short_stay' || requestedType === 'short_term_stay';
      const offeringType = stayType ? 'short_term_stay' : requestedType;
      let existingOffering = body.offeringId
        ? await prisma.commercialOffering.findFirst({ where: { id: body.offeringId, unitId: params.id } })
        : stayType
          ? await findExistingStayOffering(params.id)
          : await prisma.commercialOffering.findFirst({
              where: { unitId: params.id, offeringType },
              orderBy: { createdAt: 'asc' },
            });
      if (body.offeringId && !existingOffering) throw new Error('Offering does not belong to this unit');
      if (existingOffering?.offeringType === 'short_stay') {
        existingOffering = await findExistingStayOffering(params.id);
      }
      // Mapping a channel must not activate a source-owned Layantara offer.
      const offering = existingOffering || await prisma.commercialOffering.create({
        data: { unitId: params.id, offeringType,
          status: stayType ? 'draft' : 'active' },
      });
      const mapping = await prisma.channelMapping.upsert({
        where: { offeringId_channel: { offeringId: offering.id, channel: body.channel } },
        create: {
          offeringId: offering.id,
          channel: body.channel,
          externalListingId: body.externalListingId || null,
          syncState: body.syncState || 'ical_only',
          externalStatus: body.externalStatus || 'active',
        },
        update: {
          externalListingId: body.externalListingId || null,
          syncState: body.syncState || 'ical_only',
          externalStatus: body.externalStatus || 'active',
        },
      });
      return NextResponse.json(mapping, { status: 201 });
    }
    throw new Error('Unknown property-details action');
  } catch (error) {
    return failed(error, 'Failed to save unit details');
  }
}
