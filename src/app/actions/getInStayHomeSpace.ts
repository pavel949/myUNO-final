'use server';

import { prisma } from '@/lib/prisma';
import { getInStayHomeSpace } from '@/modules/booking';

export async function fetchInStayHomeSpace(bookingId: string, guestIdentityId: string) {
  return getInStayHomeSpace(prisma, bookingId, guestIdentityId);
}
