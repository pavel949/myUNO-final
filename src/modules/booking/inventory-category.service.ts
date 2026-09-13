import type { PrismaClient } from '@prisma/client';

export async function resolveInventoryCategory(
  db: PrismaClient,
  input: { projectId?: string; categoryId?: string; categoryKey?: string }
) {
  if (input.categoryId) {
    const category = await db.inventoryCategory.findUnique({
      where: { id: input.categoryId },
    });
    if (!category) return null;
    if (input.projectId && category.projectId !== input.projectId) return null;
    return category;
  }

  if (input.projectId && input.categoryKey) {
    return db.inventoryCategory.findUnique({
      where: {
        projectId_categoryKey: {
          projectId: input.projectId,
          categoryKey: input.categoryKey,
        },
      },
    });
  }

  return null;
}

/**
 * Return every currently available unit in a canonical sellable category.
 * The result is intentionally a list: if two requests race for one unit the
 * booking transaction can try the next eligible sibling rather than losing a
 * valid category-level sale.
 */
export async function findAvailableUnitsForInventoryCategory(
  db: PrismaClient,
  categoryId: string,
  startDate: Date,
  endDate: Date
): Promise<Array<{ id: string; instantBook: boolean }>> {
  const now = new Date();
  const category = await db.inventoryCategory.findUnique({
    where: { id: categoryId },
    select: { id: true, projectId: true, status: true },
  });

  if (!category || category.status !== 'live') return [];

  const overlaps = { startDate: { lt: endDate }, endDate: { gt: startDate } };

  return db.unit.findMany({
    where: {
      inventoryCategoryId: categoryId,
      projectId: category.projectId,
      status: 'live',
      assetStatus: { not: 'suspended' },
      project: { status: 'live' },
      bookings: {
        none: {
          ...overlaps,
          OR: [
            { status: { in: ['confirmed', 'checked_in'] } },
            { status: 'pending_payment', holdExpiresAt: { gt: now } },
          ],
        },
      },
      blockedDates: { none: overlaps },
    },
    orderBy: { name: 'asc' },
    select: { id: true, instantBook: true },
  });
}
