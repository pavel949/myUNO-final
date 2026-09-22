import type { PrismaClient } from '@prisma/client';

/**
 * Seed-only helper for the canonical inventory invariant.
 *
 * Live units must point to an InventoryCategory. Seeds also ensure an active
 * BAR RatePlan exists for that category, but this helper does not change
 * guest quoting or booking pricing authority.
 */
export async function ensureSeedInventoryCategory(
  db: PrismaClient,
  input: {
    projectId: string;
    categoryKey: string;
    name: string;
    bedrooms: number;
    bathrooms: number;
    maxGuests: number;
    baseNightlyThb: number;
    minNights?: number;
    cancellationPolicyKey?: string | null;
  }
) {
  const minNights = input.minNights ?? 1;
  const category = await db.inventoryCategory.upsert({
    where: {
      projectId_categoryKey: {
        projectId: input.projectId,
        categoryKey: input.categoryKey,
      },
    },
    create: {
      projectId: input.projectId,
      categoryKey: input.categoryKey,
      name: input.name,
      bedrooms: input.bedrooms,
      bathrooms: input.bathrooms,
      maxGuests: input.maxGuests,
      baseNightlyThb: input.baseNightlyThb,
      minNights,
      cancellationPolicyKey: input.cancellationPolicyKey ?? null,
      status: 'live',
    },
    update: {
      name: input.name,
      bedrooms: input.bedrooms,
      bathrooms: input.bathrooms,
      maxGuests: input.maxGuests,
      baseNightlyThb: input.baseNightlyThb,
      minNights,
      cancellationPolicyKey: input.cancellationPolicyKey ?? null,
      status: 'live',
    },
  });

  const bar = await db.ratePlan.findFirst({
    where: { categoryId: category.id, code: 'BAR', status: 'active' },
    select: { id: true },
  });

  if (!bar) {
    await db.ratePlan.create({
      data: {
        categoryId: category.id,
        code: 'BAR',
        name: 'Best Available Rate',
        isMaster: true,
        cancellationPolicyKey: category.cancellationPolicyKey,
        minNights: category.minNights,
        status: 'active',
      },
    });
  }

  return category;
}
