import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin, failed } from '@/app/libs/onboardingGuard';
import { updateUnit } from '@/modules/projects';
import { bahtToSatang } from '@/lib/money';

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
    if (body.action === 'channel_mapping') {
      if (body.syncState === 'ari_push') throw new Error('ARI push cannot be marked manually; connect a verified ARI provider first');
      const existingOffering = body.offeringId
        ? await prisma.commercialOffering.findFirst({ where: { id: body.offeringId, unitId: params.id } })
        : null;
      if (body.offeringId && !existingOffering) throw new Error('Offering does not belong to this unit');
      const offering = await prisma.commercialOffering.upsert({
        where: { id: existingOffering?.id || '__new__' },
        create: { unitId: params.id, offeringType: body.offeringType || 'short_stay', status: 'active' },
        update: {},
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

/**
 * The listing's physical facts (audit F-2/F-5).
 *
 * Sixteen columns on `unit` have had no writer since the day they were added:
 * privacy type, the five area measures, features, accessibility, safety,
 * furnishing, views, and the pet policy. `GET` above already returns them;
 * this is the other half.
 *
 * Nulls pass through. Clearing a fact and never having recorded it are the
 * same state in the database, but both differ from asserting a negative, and
 * the service keeps that distinction for pets.
 */
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.error;

  try {
    const body = await req.json();

    /** `undefined` leaves a field alone; an explicit null clears it. */
    const optionalString = (value: unknown): string | null | undefined => {
      if (value === undefined) return undefined;
      if (value === null) return null;
      const trimmed = String(value).trim();
      return trimmed === '' ? null : trimmed;
    };
    const optionalNumber = (value: unknown): number | null | undefined => {
      if (value === undefined) return undefined;
      if (value === null || value === '') return null;
      const parsed = Number(value);
      if (!Number.isFinite(parsed)) throw new Error('Expected a number');
      return parsed;
    };
    const stringList = (value: unknown): string[] | undefined => {
      if (value === undefined) return undefined;
      if (!Array.isArray(value)) throw new Error('Expected a list');
      return value.map((entry) => String(entry).trim()).filter(Boolean);
    };

    // Baht on the wire, satang in the database — converted once, here, like
    // every other money field crossing this boundary.
    const petFeeBaht = optionalNumber(body.petFeeBaht);

    const updated = await updateUnit({
      unitId: params.id,
      actorIdentityId: guard.actorIdentityId,
      ...(body.descriptionKey !== undefined && {
        descriptionKey: optionalString(body.descriptionKey),
      }),
      ...(body.floor !== undefined && { floor: optionalString(body.floor) }),
      ...(body.amenityKeys !== undefined && { amenityKeys: stringList(body.amenityKeys) }),
      ...(body.privacyType !== undefined && { privacyType: optionalString(body.privacyType) }),
      ...(body.accommodationType !== undefined && {
        accommodationType: optionalString(body.accommodationType),
      }),
      ...(body.usableAreaSqm !== undefined && { usableAreaSqm: optionalNumber(body.usableAreaSqm) }),
      ...(body.grossAreaSqm !== undefined && { grossAreaSqm: optionalNumber(body.grossAreaSqm) }),
      ...(body.outdoorAreaSqm !== undefined && {
        outdoorAreaSqm: optionalNumber(body.outdoorAreaSqm),
      }),
      ...(body.plotAreaSqm !== undefined && { plotAreaSqm: optionalNumber(body.plotAreaSqm) }),
      ...(body.balconyAreaSqm !== undefined && {
        balconyAreaSqm: optionalNumber(body.balconyAreaSqm),
      }),
      ...(body.unitFeatures !== undefined && { unitFeatures: stringList(body.unitFeatures) }),
      ...(body.accessibilityFacts !== undefined && {
        accessibilityFacts: stringList(body.accessibilityFacts),
      }),
      ...(body.safetyFacts !== undefined && { safetyFacts: stringList(body.safetyFacts) }),
      ...(body.furnishingStatus !== undefined && {
        furnishingStatus: optionalString(body.furnishingStatus),
      }),
      ...(body.views !== undefined && { views: stringList(body.views) }),
      ...(body.petsAllowed !== undefined && {
        petsAllowed: body.petsAllowed === null ? null : Boolean(body.petsAllowed),
      }),
      ...(body.maxPets !== undefined && { maxPets: optionalNumber(body.maxPets) }),
      ...(petFeeBaht !== undefined && {
        petFeeThb: petFeeBaht === null ? null : bahtToSatang(petFeeBaht),
      }),
      ...(body.petRules !== undefined && { petRules: optionalString(body.petRules) }),
    });

    return NextResponse.json(updated);
  } catch (error) {
    return failed(error, 'Failed to save property details');
  }
}
