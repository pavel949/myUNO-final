import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { handleError } from '@/app/libs/errorHandler';
import { track } from '@/modules/analytics';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { getRequestLocale } from '@/lib/i18n';
import { getPublicMarketplaceServiceDetail } from '@/modules/services';

export const dynamic = 'force-dynamic';

/**
 * GET /api/services/[id] — service detail (F-SVC-1).
 * Public read; returns service + provider + media.
 */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params;

    const projectId = req.nextUrl.searchParams.get('projectId') || undefined;
    return NextResponse.json(service);

  } catch (error) {
    return handleError(error);
  }
}
