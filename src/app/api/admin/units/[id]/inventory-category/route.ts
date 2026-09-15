import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { prisma } from '@/lib/prisma';
import { logAudit } from '@/modules/audit';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!user.isAdmin) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const categoryId = typeof body?.categoryId === 'string' ? body.categoryId.trim() : '';
  if (!categoryId) {
    return NextResponse.json({ error: 'categoryId is required' }, { status: 400 });
  }

  const [unit, category] = await Promise.all([
    prisma.unit.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        projectId: true,
        inventoryCategoryId: true,
        categoryKey: true,
      },
    }),
    prisma.inventoryCategory.findUnique({
      where: { id: categoryId },
      select: {
        id: true,
        projectId: true,
        categoryKey: true,
        baseNightlyThb: true,
        minNights: true,
        cancellationPolicyKey: true,
        status: true,
      },
    }),
  ]);

  if (!unit) {
    return NextResponse.json({ error: 'Unit not found' }, { status: 404 });
  }
  if (!category || category.status !== 'live') {
    return NextResponse.json({ error: 'Live inventory category not found' }, { status: 404 });
  }
  if (category.projectId !== unit.projectId) {
    return NextResponse.json({ error: 'Category belongs to a different project' }, { status: 400 });
  }

  const updated = await prisma.unit.update({
    where: { id: unit.id },
    data: {
      inventoryCategoryId: category.id,
      categoryKey: category.categoryKey,
      baseNightlyThb: category.baseNightlyThb,
      minNights: category.minNights,
      cancellationPolicyKey: category.cancellationPolicyKey,
    },
    select: {
      id: true,
      projectId: true,
      inventoryCategoryId: true,
      categoryKey: true,
      baseNightlyThb: true,
      minNights: true,
    },
  });

  await logAudit({
    actorIdentityId: user.identityId,
    action: 'unit:assign_inventory_category',
    entityType: 'Unit',
    entityId: unit.id,
    data: {
      projectId: unit.projectId,
      previousInventoryCategoryId: unit.inventoryCategoryId,
      previousCategoryKey: unit.categoryKey,
      inventoryCategoryId: category.id,
      categoryKey: category.categoryKey,
    },
  });

  return NextResponse.json({ unit: updated });
}
