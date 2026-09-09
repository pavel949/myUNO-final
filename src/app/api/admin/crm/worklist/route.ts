import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/app/libs/onboardingGuard';
import { getCrmDailyWorklist } from '@/modules/crm/worklist.service';

export const dynamic = 'force-dynamic';

/** GET /api/admin/crm/worklist?ownerId=<identity> */
export async function GET(req: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.error;

  const ownerId = req.nextUrl.searchParams.get('ownerId')?.trim() || undefined;
  const worklist = await getCrmDailyWorklist(prisma, {
    accountOwnerIdentityId: ownerId,
  });

  return NextResponse.json(worklist);
}
