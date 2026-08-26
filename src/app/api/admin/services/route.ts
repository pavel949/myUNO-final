import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { can } from '@/modules/core';
import { createService, approveService } from '@/modules/services';
import { getConfig } from '@/modules/config';
import { logAudit } from '@/modules/audit';
import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';

const PRICE_MODELS = ['fixed', 'per_hour', 'per_person', 'quote'] as const;
type PriceModel = (typeof PRICE_MODELS)[number];

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const identity = await prisma.identity.findUnique({
    where: { id: user.identityId },
  });
  if (!identity) return NextResponse.json({ error: 'Identity not found' }, { status: 404 });

  // Check admin permission
  if (
    !(await can({
      identity,
      action: 'admin:view_all',
      resource: { resourceType: 'platform' },
    }))
  ) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const status = req.nextUrl.searchParams.get('status') || 'draft';
    const limit = parseInt(req.nextUrl.searchParams.get('limit') || '50');
    const offset = parseInt(req.nextUrl.searchParams.get('offset') || '0');

    const services = await prisma.service.findMany({
      where: { status: status as any },
      include: {
        provider: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
      take: limit,
      skip: offset,
    });

    return NextResponse.json(services);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to fetch services' },
      { status: 400 }
    );
  }
}

/**
 * POST /api/admin/services — staff add a service directly, on behalf of an
 * existing vetted provider (an over-the-phone listing, or myUNO catching up
 * a provider who hasn't used their own portal yet). Unlike a provider's own
 * submission, this skips the draft/approve queue: the admin creating it is
 * also the one who would have approved it, so it goes live immediately.
 */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const identity = await prisma.identity.findUnique({
    where: { id: user.identityId },
  });
  if (!identity) return NextResponse.json({ error: 'Identity not found' }, { status: 404 });

  if (
    !(await can({
      identity,
      action: 'admin:modify',
      resource: { resourceType: 'platform' },
    }))
  ) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await req.json();

    const providerId = typeof body.providerId === 'string' ? body.providerId : '';
    const categoryKey = typeof body.categoryKey === 'string' ? body.categoryKey : '';
    const priceModel = PRICE_MODELS.includes(body.priceModel)
      ? (body.priceModel as PriceModel)
      : null;
    const titleEn = typeof body.titleEn === 'string' ? body.titleEn.trim() : '';
    const titleRu = typeof body.titleRu === 'string' ? body.titleRu.trim() : '';
    const titleTh = typeof body.titleTh === 'string' ? body.titleTh.trim() : '';
    const descriptionEn = typeof body.descriptionEn === 'string' ? body.descriptionEn.trim() : '';
    const descriptionRu = typeof body.descriptionRu === 'string' ? body.descriptionRu.trim() : '';
    const descriptionTh = typeof body.descriptionTh === 'string' ? body.descriptionTh.trim() : '';

    if (!providerId || !categoryKey || !priceModel || !titleEn || !titleRu) {
      return NextResponse.json(
        {
          error:
            'providerId, categoryKey, priceModel, titleEn and titleRu are required',
        },
        { status: 400 }
      );
    }

    const provider = await prisma.provider.findUnique({ where: { id: providerId } });
    if (!provider) {
      return NextResponse.json({ error: 'Provider not found' }, { status: 404 });
    }
    if (provider.status !== 'active') {
      return NextResponse.json(
        { error: 'Only an active, vetted provider can have a service added for them' },
        { status: 400 }
      );
    }

    const catalog =
      ((await getConfig(prisma, 'catalog.service_categories')) as
        | { key: string }[]
        | null) ?? [];
    if (!catalog.some((c) => c.key === categoryKey)) {
      return NextResponse.json({ error: 'Unknown category' }, { status: 400 });
    }

    const basePriceThb =
      body.basePriceThb != null ? Math.round(Number(body.basePriceThb)) : undefined;
    if (priceModel !== 'quote' && (!basePriceThb || basePriceThb <= 0)) {
      return NextResponse.json(
        { error: 'A positive basePriceThb is required unless the price model is quote' },
        { status: 400 }
      );
    }

    const created = await createService(prisma, {
      providerId,
      categoryKey,
      title: titleEn,
      description: descriptionEn || undefined,
      titleEn,
      titleRu,
      titleTh: titleTh || undefined,
      descriptionEn: descriptionEn || undefined,
      descriptionRu: descriptionRu || undefined,
      descriptionTh: descriptionTh || undefined,
      priceModel,
      basePriceThb,
      durationMin:
        body.durationMin != null ? Math.max(0, Math.round(Number(body.durationMin))) : undefined,
      advanceNoticeHours:
        body.advanceNoticeHours != null
          ? Math.max(0, Math.round(Number(body.advanceNoticeHours)))
          : undefined,
    });

    const draft = await prisma.service.findUnique({
      where: { id: created.id },
      select: { status: true },
    });
    if (draft?.status === 'draft') {
      await approveService(prisma, created.id, user.identityId);
    }

    await logAudit({
      actorIdentityId: user.identityId,
      action: 'services:admin_create',
      entityType: 'Service',
      entityId: created.id,
      data: { providerId, categoryKey, titleEn },
    });

    return NextResponse.json({ serviceId: created.id, status: 'active' }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to create service' },
      { status: 400 }
    );
  }
}
