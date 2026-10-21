import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { prisma } from '@/lib/prisma';
import { assertUnitPricingAccess, PricingAccessError } from '@/modules/core/pricing-access';

export async function requireUnitPricing(unitId: string) {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) } as const;
  try {
    const access = await assertUnitPricingAccess(prisma, user.identityId, unitId);
    return { ok: true, ...access } as const;
  } catch (error) {
    if (!(error instanceof PricingAccessError)) throw error;
    return { ok: false, error: NextResponse.json({ error: error.message }, { status: error.status }) } as const;
  }
}
