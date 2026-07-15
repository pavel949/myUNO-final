'use server';

import { prisma } from '@/lib/prisma';
import { getCurrentUser } from './getCurrentUser';
import { BuyerSignalStatus, BuyerSignal } from '@prisma/client';

export type AdminSignal = BuyerSignal & {
  identity: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  } | null;
  reviewedBy: {
    id: string;
    firstName: string;
    lastName: string;
  } | null;
};

export async function getAdminSignals(
  status?: BuyerSignalStatus,
  limit = 100,
  offset = 0
): Promise<{
  signals: AdminSignal[];
  total: number;
  limit: number;
  offset: number;
}> {
  const user = await getCurrentUser();
  if (!user?.identityId) {
    throw new Error('Unauthorized');
  }

  const isAdmin = await prisma.identity.findUnique({
    where: { id: user.identityId },
    select: { isAdmin: true },
  });

  if (!isAdmin?.isAdmin) {
    throw new Error('Admin access required');
  }

  const where: any = status ? { status } : {};

  const [signals, total] = await Promise.all([
    prisma.buyerSignal.findMany({
      where,
      include: {
        identity: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        reviewedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    }) as Promise<AdminSignal[]>,
    prisma.buyerSignal.count({ where }),
  ]);

  return {
    signals,
    total,
    limit,
    offset,
  };
}
