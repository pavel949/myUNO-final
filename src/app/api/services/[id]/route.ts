import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { handleError } from '@/app/libs/errorHandler';

export const dynamic = 'force-dynamic';

/**
 * GET /api/services/[id] — service detail (F-SVC-1).
 * Public read; returns service + provider + media.
 */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params;

    const service = await prisma.service.findUnique({
      where: { id },
      include: {
        provider: {
          select: {
            id: true,
            name: true,
            description: true,
            status: true,
            vetted_at: true,
          },
        },
        coverMedia: {
          select: { id: true, storageKey: true },
        },
        media: {
          select: { media_id: true, media: { select: { storageKey: true } } },
          orderBy: { position: 'asc' },
        },
      },
    });

    if (!service || service.status !== 'active') {
      return NextResponse.json({ error: 'Service not found' }, { status: 404 });
    }

    // Verify provider is active and vetted
    if (!service.provider || service.provider.status !== 'active' || !service.provider.vetted_at) {
      return NextResponse.json({ error: 'Service not available' }, { status: 404 });
    }

    return NextResponse.json({
      id: service.id,
      title: service.title,
      description: service.description,
      titleRu: service.titleRu,
      titleEn: service.titleEn,
      titleTh: service.titleTh,
      descriptionRu: service.descriptionRu,
      descriptionEn: service.descriptionEn,
      descriptionTh: service.descriptionTh,
      categoryKey: service.categoryKey,
      priceModel: service.priceModel,
      basePriceThb: service.basePriceThb,
      durationMin: service.durationMin,
      fulfilmentMode: service.fulfilmentMode,
      advanceNoticeHours: service.advanceNoticeHours,
      coverUrl: service.coverMedia?.storageKey || null,
      mediaUrls: service.media.map((m) => m.media.storageKey),
      provider: {
        id: service.provider.id,
        name: service.provider.name,
        description: service.provider.description,
        vetted: Boolean(service.provider.vetted_at),
        vettedAt: service.provider.vetted_at?.toISOString() || null,
      },
    });
  } catch (error) {
    return handleError(error);
  }
}
