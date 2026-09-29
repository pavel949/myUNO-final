import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin, failed } from '@/app/libs/onboardingGuard';

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

async function findExistingStayOffering(unitId: string, preferCanonical: boolean) {
  const offers = await prisma.commercialOffering.findMany({
    where: { unitId, offeringType: { in: ['short_term_stay', 'short_stay'] } },
    orderBy: { createdAt: 'asc' },
  });
  return offers.find(offer => offer.offeringType ===
    (preferCanonical ? 'short_term_stay' : 'short_stay')) ?? offers[0] ?? null;
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
      const space = await prisma.sleepingSpace.create({
        data: {
          unitId: params.id,
          spaceType: body.spaceType || 'bedroom',
          name: body.name || null,
          sortOrder: Number(body.sortOrder) || 0,
          beds: {
            create: (body.beds || []).filter((bed: { count?: number }) => Number(bed.count) > 0).map((bed: { bedType: string; count: number }) => ({ bedType: bed.bedType, count: Number(bed.count) })),
          },
        },
        include: { beds: true },
      });
      return NextResponse.json(space, { status: 201 });
    }
    if (body.action === 'stay_offering') {
      const unit = await prisma.unit.findUnique({
        where: { id: params.id },
        select: { id: true, baseNightlyThb: true,
          inventoryCategory: { select: { baseNightlyThb: true, status: true } } },
      });
      if (!unit) return NextResponse.json({ error: 'Unit not found' }, { status: 404 });
      const authority = await layantaraAuthority(params.id);
      const status = body.status ?? (authority.linked ? 'draft' : 'active');
      if (!['active', 'paused', 'draft'].includes(status)) {
        return NextResponse.json({ error: 'Invalid stay offering status' }, { status: 400 });
      }
      // Read the canonical offer first on source-linked units; historical
      // short_stay offers remain accessible for legacy non-Layantara units.
      const existing = await findExistingStayOffering(params.id, authority.linked);
      if (status === 'active' && authority.linked) {
        if (!authority.verified) return NextResponse.json(
          { error: 'source_calendar_cutover_required' }, { status: 409 });
        const terms = existing?.pricingTerms;
        const priceValidated = typeof terms === 'object' && terms !== null &&
          !Array.isArray(terms) &&
          (terms as Record<string, unknown>).quoteEngine !== 'pending_validation' &&
          (terms as Record<string, unknown>).quoteEngine !== undefined;
        if (!priceValidated || unit.baseNightlyThb <= 0 ||
            !unit.inventoryCategory || unit.inventoryCategory.status !== 'live' ||
            unit.inventoryCategory.baseNightlyThb <= 0) {
          return NextResponse.json({ error: 'verified_pricing_required' }, { status: 409 });
        }
      }
      const offering = existing
        ? await prisma.commercialOffering.update({ where: { id: existing.id }, data: { status } })
        : await prisma.commercialOffering.create({
            data: { unitId: params.id,
              offeringType: authority.linked ? 'short_term_stay' : 'short_stay', status },
          });
      return NextResponse.json(offering, { status: existing ? 200 : 201 });
    }
    if (body.action === 'channel_mapping') {
      if (body.syncState === 'ari_push') throw new Error('ARI push cannot be marked manually; connect a verified ARI provider first');
      const authority = await layantaraAuthority(params.id);
      const requestedType = body.offeringType || (authority.linked ? 'short_term_stay' : 'short_stay');
      const stayType = requestedType === 'short_stay' || requestedType === 'short_term_stay';
      const offeringType = authority.linked && stayType ? 'short_term_stay' : requestedType;
      const existingOffering = body.offeringId
        ? await prisma.commercialOffering.findFirst({ where: { id: body.offeringId, unitId: params.id } })
        : stayType
          ? await findExistingStayOffering(params.id, authority.linked)
          : await prisma.commercialOffering.findFirst({
              where: { unitId: params.id, offeringType },
              orderBy: { createdAt: 'asc' },
            });
      if (body.offeringId && !existingOffering) throw new Error('Offering does not belong to this unit');
      // Mapping a channel must not activate a source-owned Layantara offer.
      const offering = existingOffering || await prisma.commercialOffering.create({
        data: { unitId: params.id, offeringType,
          status: authority.linked ? 'draft' : 'active' },
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
