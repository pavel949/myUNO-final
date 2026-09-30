import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { handleError } from '@/app/libs/errorHandler';
import { track } from '@/modules/analytics';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { getRequestLocale } from '@/lib/i18n';
import { getPublicMarketplaceServiceDetail } from '@/modules/services';

export const dynamic = 'force-dynamic';

/**
 * GET /api/services/[id] — public service detail.
 * Project context personalizes project overrides/context but does not create a
 * separate marketplace catalogue.
 */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const projectId = req.nextUrl.searchParams.get('projectId') || undefined;
    const service = await getPublicMarketplaceServiceDetail(
      prisma,
      params.id,
      getRequestLocale(),
      projectId
    );
    if (!service) {
      return NextResponse.json({ error: 'Service not found' }, { status: 404 });
    }

    const viewer = await getCurrentUser().catch(() => null);
    await track(prisma, 'service_service_viewed', {
      serviceId: service.id,
      identityId: viewer?.identityId,
      categoryKey: service.categoryKey,
      projectId,
    }).catch(() => null);

    return NextResponse.json(service);
  } catch (error) {
    return handleError(error);
  }
}
