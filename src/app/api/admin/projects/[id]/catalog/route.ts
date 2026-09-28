import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin, failed } from '@/app/libs/onboardingGuard';
import { bahtToSatang } from '@/lib/money';

function wholeNumber(value: unknown, field: string, minimum: number): number {
  if (value === null || value === undefined || value === '') {
    throw new Error(`${field} is required`);
  }
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < minimum) {
    throw new Error(`${field} must be an integer of at least ${minimum}`);
  }
  return number;
}

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
      const categoryKey = String(body.categoryKey ?? '').trim();
      const name = String(body.name ?? '').trim();
      if (!/^[a-z0-9][a-z0-9_-]{0,79}$/.test(categoryKey)) {
        throw new Error('Category key must contain lowercase letters, numbers, dashes or underscores');
      }
      if (!name) throw new Error('Category name is required');
      // This API accepts BAHT from the onboarding form; the database stores SATANG.
      // Missing fields must never silently become zero-priced sellable inventory.
      if (body.baseNightlyThb === null || body.baseNightlyThb === undefined || body.baseNightlyThb === '') {
        throw new Error('Base nightly rate (THB) is required');
      }
      const baseNightlyThb = bahtToSatang(Number(body.baseNightlyThb));
      if (!Number.isSafeInteger(baseNightlyThb) || baseNightlyThb <= 0) {
        throw new Error('Base nightly rate must be greater than zero');
      }
      const bedrooms = wholeNumber(body.bedrooms, 'Bedrooms', 0);
      const bathrooms = wholeNumber(body.bathrooms, 'Bathrooms', 0);
      const maxGuests = wholeNumber(body.maxGuests, 'Maximum guests', 1);
      const minNights = wholeNumber(body.minNights ?? 1, 'Minimum nights', 1);
      const cancellationPolicyKey = body.cancellationPolicyKey || null;
      if (body.status !== undefined && !['draft', 'live', 'paused'].includes(body.status)) {
        throw new Error('Invalid inventory category status');
      }

      // The category owns the rate. The Unit price column is a compatibility
      // mirror; the category and mirrors change in one transaction.
      const category = await prisma.$transaction(async (tx) => {
        const saved = await tx.inventoryCategory.upsert({
          where: { projectId_categoryKey: { projectId: params.id, categoryKey } },
          create: {
            projectId: params.id,
            categoryKey,
            name,
            bedrooms,
            bathrooms,
            maxGuests,
            baseNightlyThb,
            minNights,
            cancellationPolicyKey,
            status: body.status || 'live',
          },
          update: {
            name,
            bedrooms,
            bathrooms,
            maxGuests,
            baseNightlyThb,
            minNights,
            cancellationPolicyKey,
            ...(body.status !== undefined ? { status: body.status } : {}),
          },
        });

        // A category-scoped BAR has project_id NULL by design. The schema's
        // @@unique(projectId, code) is for project-scoped plans; using the
        // project ID here would make a second category's BAR overwrite the
        // first category's plan. This matches the inventory seed/migration.
        const bar = await tx.ratePlan.findFirst({
          where: { categoryId: saved.id, code: 'BAR' },
          select: { id: true },
        });
        if (!bar) {
          await tx.ratePlan.create({
            data: {
              categoryId: saved.id,
              code: 'BAR',
              name: 'Best Available Rate',
              isMaster: true,
              // Null inherits future edits to the category minimum.
              minNights: null,
              cancellationPolicyKey: null,
              status: 'active',
            },
          });
        }

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
      const categoryId = typeof body.categoryId === 'string' ? body.categoryId : null;
      const unitId = typeof body.unitId === 'string' ? body.unitId : null;
      if (Number(Boolean(categoryId)) + Number(Boolean(unitId)) !== 1) {
        throw new Error('A rate plan must target exactly one category or unit');
      }
      const code = String(body.code ?? '').trim().toUpperCase();
      const name = String(body.name ?? '').trim();
      if (!/^[A-Z0-9][A-Z0-9_-]{0,39}$/.test(code)) throw new Error('A valid rate plan code is required');
      if (!name) throw new Error('Rate plan name is required');

      // Prevent linking (or overwriting) a different project's inventory.
      const target = categoryId
        ? await prisma.inventoryCategory.findFirst({
            where: { id: categoryId, projectId: params.id },
            select: { id: true },
          })
        : await prisma.unit.findFirst({
            where: { id: unitId!, projectId: params.id },
            select: { id: true },
          });
      if (!target) throw new Error('Rate plan target does not belong to this project');

      const minNights =
        body.minNights === null || body.minNights === undefined || body.minNights === ''
          ? null
          : wholeNumber(body.minNights, 'Minimum nights', 1);

      const scope = categoryId ? { categoryId } : { unitId: unitId! };
      const values = {
        name,
        isMaster: body.isMaster !== false,
        parentRatePlanId: body.parentRatePlanId || null,
        adjustmentType: body.adjustmentType || null,
        adjustmentValue: body.adjustmentValue ?? null,
        cancellationPolicyKey: body.cancellationPolicyKey || null,
        minNights,
        status: body.status || 'active',
      };

      const plan = await prisma.$transaction(async (tx) => {
        const existing = await tx.ratePlan.findFirst({
          where: { ...scope, code },
          select: { id: true },
        });
        if (existing) return tx.ratePlan.update({ where: { id: existing.id }, data: values });
        return tx.ratePlan.create({
          data: {
            ...scope,
            // Do not consume the project-scoped unique code for a category
            // or unit. The scope is already anchored through its FK.
            projectId: null,
            code,
            ...values,
          },
        });
      });
      return NextResponse.json(plan, { status: 201 });
    }
    throw new Error('Unknown catalog action');
  } catch (error) {
    return failed(error, 'Failed to save property catalog');
  }
}
