import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getProviderRemittancesView } from '@/modules/finance';
import { requireProviderMember } from '@/app/libs/providerGuard';
import { handleError } from '@/app/libs/errorHandler';

/**
 * GET /api/provider/remittances — current-period remittance report and
 * payout history for the caller's provider (F-PROV-4, doc 10 §5).
 */
export async function GET() {
  try {
    const { providerId } = await requireProviderMember();
    const view = await getProviderRemittancesView(prisma, providerId);
    return NextResponse.json(view);
  } catch (error) {
    return handleError(error);
  }
}
