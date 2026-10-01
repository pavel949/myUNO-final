import type { PrismaClient } from '@prisma/client';

export async function listScopedPropertyEnquiries(
  db: PrismaClient,
  unitIds: string[],
  limit = 100
) {
  if (unitIds.length === 0) return [];

  return db.crmOpportunity.findMany({
    where: {
      unitId: { in: unitIds },
      type: { in: ['rental', 'sale'] },
      stage: { notIn: ['lost'] },
    },
    select: {
      id: true,
      createdAt: true,
      updatedAt: true,
      type: true,
      stage: true,
      title: true,
      requirements: true,
      identity: {
        select: {
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
        },
      },
      unit: {
        select: {
          id: true,
          name: true,
          project: { select: { id: true, name: true } },
        },
      },
    },
    orderBy: [{ createdAt: 'desc' }],
    take: limit,
  });
}
