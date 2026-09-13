'use server';

import { prisma } from '@/lib/prisma';
import { requireSessionIdentityId } from './session-identity';
import { getInStayHomeSpace } from '@/modules/booking';

export async function fetchInStayHomeSpace(bookingId: string) {
  const guestIdentityId = await requireSessionIdentityId();
  return getInStayHomeSpace(prisma, bookingId, guestIdentityId);
}
