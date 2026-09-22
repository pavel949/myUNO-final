import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { handleError } from '@/app/libs/errorHandler';
import { track } from '@/modules/analytics';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { getRequestLocale } from '@/lib/i18n';
import { listPublicMarketplaceServices } from '@/modules/services';

// This GET uses no dynamic request API, so without this Next.js would cache
// its response at build time — the catalog would never reflect DB changes.
export const dynamic = 'force-dynamic';

/**
 * GET /api/services — active, vetted marketplace services (S11).
 * Uses the same public Service/Provider/MediaAsset read model as homepage
 * discovery so those surfaces cannot drift into separate service catalogues.
 */
export async function GET(req: NextRequest) {
  try {
    const projectId = req.nextUrl.searchParams.get('projectId') || undefined;
    const locale = getRequestLocale();
    const services = await listPublicMarketplaceServices(prisma, locale, { projectId });

    const viewer = await getCurrentUser().catch(() => null);
    await track(prisma, 'service_catalog_viewed', {
      identityId: viewer?.identityId,
      serviceCount: services.length,
    }).catch(() => null);

    return NextResponse.json({ services });
  } catch (error) {
    return handleError(error);
  }
}
