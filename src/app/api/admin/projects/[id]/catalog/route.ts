import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin, failed } from '@/app/libs/onboardingGuard';
import { bahtToSatang } from '@/lib/money';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.error;
  const project = await prisma.project.findUnique({
    where: { id: params.id },
    include: { inventoryCategories: { include: { ratePlans: true } }, ratePlans: true },
  });
  return project
    ? NextResponse.json(project)
    : NextResponse.json({ error: 'Project not found' }, { status: 404 });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.error;
  try {
    const body = await req.json();
    if (body.action === 'category') {
      const baseNightlyThb = bahtToSatang(Number(body.baseNightlyThb));
      const minNights = Number(body.minNights) || 1;
      const cancellationPolicyKey = body.cancellationPolicyKey || null;

      // InventoryCategory is the commercial owner for linked units. Keep the
      // legacy Unit columns as read-compatibility mirrors only, and update both
      // sides atomically so no caller can observe two prices for one category.
      const category = await prisma.$transaction(async (tx) => {
        const saved = await tx.inventoryCategory.upsert({
          where: { projectId_categoryKey: { projectId: params.id, categoryKey: body.categoryKey } },
          create: {
            projectId: params.id,
            categoryKey: body.categoryKey,
            name: body.name,
            bedrooms: Number(body.bedrooms),
            bathrooms: Number(body.bathrooms),
            maxGuests: Number(body.maxGuests),
            baseNightlyThb,
            minNights,
            cancellationPolicyKey,
            status: body.status || 'live',
          },
          update: {
            name: body.name,
            bedrooms: Number(body.bedrooms),
            bathrooms: Number(body.bathrooms),
            maxGuests: Number(body.maxGuests),
            baseNightlyThb,
            minNights,
            cancellationPolicyKey,
            status: body.status || 'live',
          },
        });

        await tx.unit.updateMany({
          where: { projectId: params.id, inventoryCategoryId: saved.id },
          data: {
            categoryKey: saved.categoryKey,
            baseNightlyThb: saved.baseNightlyThb,
            minNights: saved.minNights,
            cancellationPolicyKey: saved.cancellationPolicyKey,
          },
        });

        return saved;
      });
      return NextResponse.json(category, { status: 201 });
    }
    if (body.action === 'rate_plan') {
      const scopeCount = [body.categoryId, body.unitId].filter(Boolean).length;
      if (scopeCount !== 1) throw new Error('A rate plan must target exactly one category or unit');
      const plan = await prisma.ratePlan.upsert({
        where: { projectId_code: { projectId: params.id, code: body.code } },
        create: {
          projectId: params.id,
          categoryId: body.categoryId || null,
          unitId: body.unitId || null,
          code: body.code,
          name: body.name,
          isMaster: body.isMaster !== false,
          parentRatePlanId: body.parentRatePlanId || null,
          adjustmentType: body.adjustmentType || null,
          adjustmentValue: body.adjustmentValue ?? null,
          cancellationPolicyKey: body.cancellationPolicyKey || null,
          minNights: body.minNights ? Number(body.minNights) : null,
          status: body.status || 'active',
        },
        update: {
          categoryId: body.categoryId || null,
          unitId: body.unitId || null,
          name: body.name,
          isMaster: body.isMaster !== false,
          parentRatePlanId: body.parentRatePlanId || null,
          adjustmentType: body.adjustmentType || null,
          adjustmentValue: body.adjustmentValue ?? null,
          cancellationPolicyKey: body.cancellationPolicyKey || null,
          minNights: body.minNights ? Number(body.minNights) : null,
          status: body.status || 'active',
        },
      });
      return NextResponse.json(plan, { status: 201 });
    }
    throw new Error('Unknown catalog action');
  } catch (error) {
    return failed(error, 'Failed to save property catalog');
  }
}
