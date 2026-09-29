import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin, failed } from '@/app/libs/onboardingGuard';

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
      const unit = await prisma.unit.findUnique({ where: { id: params.id }, select: { id: true } });
      if (!unit) throw new Error('Unit not found');
      const status = body.status ?? 'active';
      if (status !== 'active' && status !== 'paused') throw new Error('Invalid stay offering status');
      // Stay offering is distinct from the physical home; saving twice must
      // update its one existing record rather than creating duplicates.
      const existing = await prisma.commercialOffering.findFirst({
        where: { unitId: params.id, offeringType: 'short_stay' },
        orderBy: { createdAt: 'asc' },
      });
      const offering = existing
        ? await prisma.commercialOffering.update({ where: { id: existing.id }, data: { status } })
        : await prisma.commercialOffering.create({
            data: { unitId: params.id, offeringType: 'short_stay', status },
          });
      return NextResponse.json(offering, { status: existing ? 200 : 201 });
    }
    if (body.action === 'channel_mapping') {
      if (body.syncState === 'ari_push') throw new Error('ARI push cannot be marked manually; connect a verified ARI provider first');
      const offeringType = body.offeringType || 'short_stay';
      const existingOffering = body.offeringId
        ? await prisma.commercialOffering.findFirst({ where: { id: body.offeringId, unitId: params.id } })
        : await prisma.commercialOffering.findFirst({
            where: { unitId: params.id, offeringType },
            orderBy: { createdAt: 'asc' },
          });
      if (body.offeringId && !existingOffering) throw new Error('Offering does not belong to this unit');
      const offering = existingOffering || await prisma.commercialOffering.create({
        data: { unitId: params.id, offeringType, status: 'active' },
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
