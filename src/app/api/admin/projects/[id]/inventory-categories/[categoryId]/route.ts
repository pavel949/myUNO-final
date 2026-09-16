import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin, failed } from '@/app/libs/onboardingGuard';
import { updateInventoryCategory } from '@/modules/projects';
import { bahtToSatang } from '@/lib/money';

/** Amend one sellable class. Admin-only, as with creation. */
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string; categoryId: string } }
) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.error;

  try {
    const body = await req.json();

    // The category must belong to the project in the path. Without this an
    // admin could amend another project's commercial terms through a URL that
    // claims otherwise, and the audit row would name the wrong project.
    const category = await prisma.inventoryCategory.findUnique({
      where: { id: params.categoryId },
      select: { projectId: true },
    });
    if (!category || category.projectId !== params.id) {
      return NextResponse.json({ error: 'Inventory category not found' }, { status: 404 });
    }

    let baseNightlyThb: number | undefined;
    if (body.baseNightlyBaht !== undefined) {
      const baht = Number(body.baseNightlyBaht);
      if (!Number.isFinite(baht)) {
        return NextResponse.json({ error: 'baseNightlyBaht must be a number' }, { status: 400 });
      }
      baseNightlyThb = bahtToSatang(baht);
    }

    const updated = await updateInventoryCategory(prisma, {
      categoryId: params.categoryId,
      ...(body.name !== undefined && { name: String(body.name) }),
      ...(body.bedrooms !== undefined && { bedrooms: Number(body.bedrooms) }),
      ...(body.bathrooms !== undefined && { bathrooms: Number(body.bathrooms) }),
      ...(body.maxGuests !== undefined && { maxGuests: Number(body.maxGuests) }),
      ...(baseNightlyThb !== undefined && { baseNightlyThb }),
      ...(body.minNights !== undefined && { minNights: Number(body.minNights) }),
      ...(body.cancellationPolicyKey !== undefined && {
        cancellationPolicyKey: body.cancellationPolicyKey || null,
      }),
      ...(body.status !== undefined && { status: body.status }),
      actorIdentityId: guard.actorIdentityId,
    });

    return NextResponse.json(updated);
  } catch (error) {
    return failed(error, 'Failed to update inventory category');
  }
}
