import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { prisma } from '@/lib/prisma';
import { logAudit } from '@/modules/audit';

export async function PATCH(
  req: NextRequest,
  { params }: { params: { categoryId: string } }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!user.isAdmin) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  const category = await prisma.inventoryCategory.findUnique({
    where: { id: params.categoryId },
    select: { id: true, projectId: true, baseNightlyThb: true, minNights: true },
  });
  if (!category) {
    return NextResponse.json({ error: 'Inventory category not found' }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  const baseNightlyThb = body?.baseNightlyThb;
  const minNights = body?.minNights;

  if (!Number.isInteger(baseNightlyThb) || baseNightlyThb < 0) {
    return NextResponse.json({ error: 'baseNightlyThb must be a non-negative integer in satang' }, { status: 400 });
  }
  if (!Number.isInteger(minNights) || minNights < 1) {
    return NextResponse.json({ error: 'minNights must be an integer of at least 1' }, { status: 400 });
  }

  const updated = await prisma.$transaction(async (tx) => {
    const next = await tx.inventoryCategory.update({
      where: { id: category.id },
      data: { baseNightlyThb, minNights },
      select: {
        id: true,
        projectId: true,
        categoryKey: true,
        name: true,
        baseNightlyThb: true,
        minNights: true,
      },
    });

    // The canonical booking calculator resolves BAR minNights before the
    // category fallback, so the category's master BAR must move with it.
    await tx.ratePlan.updateMany({
      where: {
        categoryId: category.id,
        code: 'BAR',
        isMaster: true,
        status: 'active',
      },
      data: { minNights },
    });

    // Unit commercial columns are compatibility mirrors. Keep them aligned so
    // legacy readers cannot diverge from the canonical InventoryCategory.
    await tx.unit.updateMany({
      where: { inventoryCategoryId: category.id },
      data: { baseNightlyThb, minNights },
    });

    return next;
  });

  await logAudit({
    actorIdentityId: user.identityId,
    action: 'inventory_category:update_pricing',
    entityType: 'InventoryCategory',
    entityId: updated.id,
    data: {
      projectId: updated.projectId,
      categoryKey: updated.categoryKey,
      previousBaseNightlyThb: category.baseNightlyThb,
      baseNightlyThb: updated.baseNightlyThb,
      previousMinNights: category.minNights,
      minNights: updated.minNights,
    },
  });

  return NextResponse.json({ category: updated });
}
