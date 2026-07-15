'use server';

import { prisma } from '@/lib/prisma';
import { getCurrentUser } from './getCurrentUser';
import { IntegrationAccount } from '@prisma/client';

export type IntegrationAccountHealth = IntegrationAccount & {
  unit?: {
    id: string;
    name: string;
  } | null;
  project?: {
    id: string;
    name: string;
  } | null;
};

export async function getIntegrationHealth(
  unitId?: string,
  projectId?: string,
): Promise<{
  accounts: IntegrationAccountHealth[];
  total: number;
}> {
  const user = await getCurrentUser();
  if (!user?.identityId) {
    throw new Error('Unauthorized');
  }

  // Check if user is admin (would be enhanced with role-based access in production)
  const isAdmin = await prisma.identity.findUnique({
    where: { id: user.identityId },
    select: { isAdmin: true },
  });

  if (!isAdmin?.isAdmin) {
    throw new Error('Admin access required');
  }

  const where: any = {};
  if (unitId) {
    where.unitId = unitId;
  }
  if (projectId) {
    where.projectId = projectId;
  }

  const [accounts, total] = await Promise.all([
    prisma.integrationAccount.findMany({
      where,
      include: {
        unit: {
          select: {
            id: true,
            name: true,
          },
        },
        project: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    }) as Promise<IntegrationAccountHealth[]>,
    prisma.integrationAccount.count({ where }),
  ]);

  return {
    accounts,
    total,
  };
}
