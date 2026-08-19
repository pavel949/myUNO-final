'use server';

import { prisma } from '@/lib/prisma';

/**
 * The stay this person is in the middle of, if any.
 *
 * "In the middle of" means checked in, or confirmed with today inside the
 * dates — a booking that starts next month is a plan, not a context. Compared
 * on the date alone because a stay's dates are dates, not instants.
 */
export async function getActiveStayId(identityId: string): Promise<string | null> {
  const now = new Date();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  const booking = await prisma.booking.findFirst({
    where: {
      guestIdentityId: identityId,
      OR: [
        { status: 'checked_in' },
        { status: 'confirmed', startDate: { lte: today }, endDate: { gte: today } },
      ],
    },
    // If somebody somehow has two, the one that ends soonest is the one they
    // are living in now.
    orderBy: { endDate: 'asc' },
    select: { id: true },
  });

  return booking?.id ?? null;
}
