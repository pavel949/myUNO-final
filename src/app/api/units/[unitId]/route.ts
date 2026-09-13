import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { track } from '@/modules/analytics';
import { getCurrentUser } from '@/app/actions/getCurrentUser';

export async function GET(
  _req: NextRequest,
  { params }: { params: { unitId: string } }
) {
  try {
    const unit = await prisma.unit.findUnique({
      where: { id: params.unitId },
      select: {
        id: true,
        projectId: true,
        name: true,
        unitType: true,
        bedrooms: true,
        bathrooms: true,
        maxGuests: true,
        sizeSqm: true,
        amenityKeys: true,
        instantBook: true,
        status: true,
        inventoryCategory: {
          select: {
            id: true,
            categoryKey: true,
            name: true,
            baseNightlyThb: true,
            minNights: true,
            cancellationPolicyKey: true,
            status: true,
            ratePlans: {
              where: { status: 'active', code: 'BAR' },
              orderBy: { createdAt: 'desc' },
              take: 1,
              select: {
                code: true,
                minNights: true,
                cancellationPolicyKey: true,
              },
            },
          },
        },
        project: { select: { id: true, name: true, status: true } },
        coverMedia: { select: { storageKey: true } },
        media: {
          orderBy: { sort: 'asc' },
          select: { media: { select: { id: true, storageKey: true } } },
        },
      },
    });

    if (
      !unit ||
      unit.status !== 'live' ||
      unit.project.status !== 'live' ||
      !unit.inventoryCategory ||
      unit.inventoryCategory.status !== 'live'
    ) {
      return NextResponse.json({ error: 'Unit not found' }, { status: 404 });
    }

    const viewer = await getCurrentUser().catch(() => null);
    await track(prisma, 'page_unit_viewed', {
      unitId: unit.id,
      projectId: unit.projectId,
      identityId: viewer?.identityId,
    });

    const category = unit.inventoryCategory;
    const bar = category.ratePlans[0] ?? null;
    const gallery = unit.media.map((m) => m.media.storageKey);
    const cover = unit.coverMedia?.storageKey || gallery[0] || null;

    return NextResponse.json({
      id: unit.id,
      projectId: unit.projectId,
      name: unit.name,
      unitType: unit.unitType,
      bedrooms: unit.bedrooms,
      bathrooms: unit.bathrooms,
      maxGuests: unit.maxGuests,
      sizeSqm: unit.sizeSqm,
      amenityKeys: unit.amenityKeys,
      instantBook: unit.instantBook,
      project: { id: unit.project.id, name: unit.project.name },
      inventoryCategory: {
        id: category.id,
        categoryKey: category.categoryKey,
        name: category.name,
      },
      categoryKey: category.categoryKey,
      // Existing client contract is baht here; source is now canonical.
      baseNightlyThb: Math.round(category.baseNightlyThb / 100),
      minNights: bar?.minNights ?? category.minNights,
      cancellationPolicyKey:
        bar?.cancellationPolicyKey ?? category.cancellationPolicyKey ?? 'flexible',
      ratePlanCode: bar?.code ?? 'BAR',
      images: cover ? [cover, ...gallery.filter((g) => g !== cover)] : gallery,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
