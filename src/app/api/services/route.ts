import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { handleError } from '@/app/libs/errorHandler';

// This GET uses no dynamic request API, so without this Next.js would cache
// its response at build time — the catalog would never reflect DB changes.
export const dynamic = 'force-dynamic';

/**
 * GET /api/services — active, vetted marketplace services (S11).
 * Public read; optional ?projectId scope (services are platform-wide in
 * loop one — the param is accepted for the project-scoped rail).
 */
export async function GET(_req: NextRequest) {
  try {
    const services = await prisma.service.findMany({
      where: { status: 'active', provider: { status: 'active' } },
      include: {
        provider: { select: { id: true, name: true, vetted_at: true } },
        coverMedia: { select: { storageKey: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return NextResponse.json({
      services: services.map((s) => ({
        id: s.id,
        title: s.title,
        description: s.description,
        categoryKey: s.categoryKey,
        priceModel: s.priceModel,
        basePriceThb: s.basePriceThb,
        durationMin: s.durationMin,
        advanceNoticeHours: s.advanceNoticeHours,
        providerName: s.provider?.name || null,
        providerVetted: Boolean(s.provider?.vetted_at),
        coverUrl: s.coverMedia?.storageKey || null,
      })),
    });
  } catch (error) {
    return handleError(error);
  }
}
