import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/app/libs/onboardingGuard';
import { getReconciliationData } from '@/modules/finance';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const guard = await requireAdmin();
    if (!guard.ok) return guard.error;

    const data = await getReconciliationData(prisma)

    return NextResponse.json(data)
  } catch (error) {
    console.error('[RECONCILIATION DATA]', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
