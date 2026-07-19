import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServicesByProvider, createService } from '@/modules/services';
import { getConfig } from '@/modules/config';
import { requireProviderMember } from '@/app/libs/providerGuard';
import { handleError, createPublicError } from '@/app/libs/errorHandler';

const PRICE_MODELS = ['fixed', 'per_hour', 'per_person', 'quote'] as const;
type PriceModel = (typeof PRICE_MODELS)[number];

function serializeService(s: {
  id: string;
  categoryKey: string;
  title: string;
  description: string | null;
  priceModel: string;
  basePriceThb: number | null;
  durationMin: number | null;
  advanceNoticeHours: number;
  status: string;
  createdAt: Date;
}) {
  return {
    id: s.id,
    categoryKey: s.categoryKey,
    title: s.title,
    description: s.description,
    priceModel: s.priceModel,
    basePriceThb: s.basePriceThb,
    durationMin: s.durationMin,
    advanceNoticeHours: s.advanceNoticeHours,
    status: s.status,
    createdAt: s.createdAt,
  };
}

/** GET /api/provider/services — the caller's provider's services (all statuses). */
export async function GET() {
  try {
    const { providerId } = await requireProviderMember();
    const services = await getServicesByProvider(prisma, providerId);
    return NextResponse.json({ services: services.map(serializeService) });
  } catch (error) {
    return handleError(error);
  }
}

/**
 * POST /api/provider/services — create a service for the caller's provider.
 * Starts as a draft when `services.require_admin_approval` is on (default).
 */
export async function POST(req: NextRequest) {
  try {
    const { providerId } = await requireProviderMember();

    const body = await req.json();
    const title = typeof body.title === 'string' ? body.title.trim() : '';
    const categoryKey =
      typeof body.categoryKey === 'string' ? body.categoryKey : '';
    const priceModel = PRICE_MODELS.includes(body.priceModel)
      ? (body.priceModel as PriceModel)
      : null;

    if (!title || !categoryKey || !priceModel) {
      throw createPublicError(
        'invalid request: title, categoryKey and priceModel are required',
        400
      );
    }

    const catalog =
      ((await getConfig(prisma, 'catalog.service_categories')) as
        | { key: string }[]
        | null) ?? [];
    if (!catalog.some((c) => c.key === categoryKey)) {
      throw createPublicError('invalid request: unknown category', 400);
    }

    const basePriceThb =
      body.basePriceThb != null ? Math.round(Number(body.basePriceThb)) : undefined;
    if (priceModel !== 'quote' && (!basePriceThb || basePriceThb <= 0)) {
      throw createPublicError(
        'invalid request: a positive basePriceThb is required unless the price model is quote',
        400
      );
    }

    const created = await createService(prisma, {
      providerId,
      categoryKey,
      title,
      description:
        typeof body.description === 'string' ? body.description.trim() : undefined,
      priceModel,
      basePriceThb,
      durationMin:
        body.durationMin != null ? Math.max(0, Math.round(Number(body.durationMin))) : undefined,
      advanceNoticeHours:
        body.advanceNoticeHours != null
          ? Math.max(0, Math.round(Number(body.advanceNoticeHours)))
          : undefined,
    });

    return NextResponse.json({ serviceId: created.id }, { status: 201 });
  } catch (error) {
    return handleError(error);
  }
}
