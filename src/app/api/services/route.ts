import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { handleError, createPublicError } from '@/app/libs/errorHandler';
import { track } from '@/modules/analytics';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { getRequestLocale } from '@/lib/i18n';
import { pickLocalizedServiceCopy } from '@/modules/services';
import { bahtToSatang } from '@/lib/money';

// This GET uses no dynamic request API, so without this Next.js would cache
// its response at build time — the catalog would never reflect DB changes.
export const dynamic = 'force-dynamic';

/** A page of results, so a growing catalogue does not become one endless list. */
const DEFAULT_LIMIT = 24;
const MAX_LIMIT = 60;

const SORTS = ['recent', 'price_asc', 'price_desc', 'rating'] as const;
type Sort = (typeof SORTS)[number];

/**
 * Ordering the database can express. `rating` cannot: a service's rating lives
 * across review → service_order → service, so it is ranked in this route after
 * the averages are resolved, the same way the unit search handles it.
 */
const ORDER_BY: Record<Exclude<Sort, 'rating'>, Prisma.ServiceOrderByWithRelationInput[]> = {
  recent: [{ createdAt: 'desc' }, { id: 'asc' }],
  price_asc: [{ basePriceThb: 'asc' }, { id: 'asc' }],
  price_desc: [{ basePriceThb: 'desc' }, { id: 'asc' }],
};

/**
 * Average rating per service, in two queries rather than one per service.
 *
 * A review targets the *order*, not the service, so the two have to be joined
 * here. A service nobody has reviewed returns no entry at all — it is unknown,
 * not zero, and showing it as zero buries every new provider beneath one
 * grudging review (doc 06: unknown renders as absent).
 */
async function ratingsByService(
  serviceIds: string[]
): Promise<Map<string, { averageRating: number; reviewCount: number }>> {
  const result = new Map<string, { averageRating: number; reviewCount: number }>();
  if (serviceIds.length === 0) return result;

  const orders = await prisma.serviceOrder.findMany({
    where: { service_id: { in: serviceIds } },
    select: { id: true, service_id: true },
  });
  if (orders.length === 0) return result;

  const serviceByOrder = new Map(orders.map((o) => [o.id, o.service_id]));
  const reviews = await prisma.review.findMany({
    where: {
      target_type: 'service_order',
      target_id: { in: orders.map((o) => o.id) },
      status: 'published',
    },
    select: { target_id: true, rating: true },
  });

  const totals = new Map<string, { sum: number; count: number }>();
  for (const review of reviews) {
    const serviceId = serviceByOrder.get(review.target_id);
    if (!serviceId) continue;
    const running = totals.get(serviceId) ?? { sum: 0, count: 0 };
    running.sum += review.rating;
    running.count += 1;
    totals.set(serviceId, running);
  }

  for (const [serviceId, { sum, count }] of totals) {
    result.set(serviceId, {
      averageRating: Math.round((sum / count) * 10) / 10,
      reviewCount: count,
    });
  }
  return result;
}

/**
 * GET /api/services — the marketplace catalogue (S11).
 *
 * Public read. Query: `q`, `categoryKey`, `minPriceBaht`, `maxPriceBaht`,
 * `sort`, `limit`, `offset`, and the existing `projectId` scope.
 *
 * The price params are named in baht because that is what a person types into
 * a filter; everything stored and returned is satang, converted once here
 * (CLAUDE.md money rules). Naming them `…Baht` is deliberate — an unqualified
 * `minPrice` is how the satang/baht confusion keeps getting in.
 */
export async function GET(req: NextRequest) {
  try {
    const params = req.nextUrl.searchParams;
    const projectId = params.get('projectId') || undefined;
    const q = (params.get('q') || '').trim();
    const categoryKey = params.get('categoryKey') || undefined;

    const sortParam = params.get('sort') || 'recent';
    // An unknown sort falls back rather than failing: a stale bookmark should
    // still show services.
    const sort: Sort = (SORTS as readonly string[]).includes(sortParam)
      ? (sortParam as Sort)
      : 'recent';

    const limit = Math.min(MAX_LIMIT, Math.max(1, Number(params.get('limit')) || DEFAULT_LIMIT));
    const offset = Math.max(0, Number(params.get('offset')) || 0);

    function priceBound(name: 'minPriceBaht' | 'maxPriceBaht'): number | undefined {
      const raw = params.get(name);
      if (raw === null || raw === '') return undefined;
      const baht = Number(raw);
      if (!Number.isFinite(baht) || baht < 0) {
        throw createPublicError(`invalid request: ${name} must be a positive number of baht`, 400);
      }
      return bahtToSatang(Math.round(baht));
    }
    const minSatang = priceBound('minPriceBaht');
    const maxSatang = priceBound('maxPriceBaht');

    const where: Prisma.ServiceWhereInput = {
      status: 'active',
      provider: { status: 'active', vetted_at: { not: null } },
      ...(categoryKey && { categoryKey }),
      ...(projectId && {
        OR: [
          { availableProjects: { none: {} } },
          { availableProjects: { some: { project_id: projectId } } },
        ],
      }),
      // A price bound is about priceable services. A quote-priced service has
      // no number to compare, so a bound excludes it rather than silently
      // ranking it as free.
      ...((minSatang !== undefined || maxSatang !== undefined) && {
        basePriceThb: {
          not: null,
          ...(minSatang !== undefined && { gte: minSatang }),
          ...(maxSatang !== undefined && { lte: maxSatang }),
        },
      }),
      // Search every language's copy, not only whichever one the row was typed
      // in: a Russian-speaking guest searching "уборка" must find a service
      // whose English title is "Cleaning" but whose Russian title matches.
      ...(q && {
        OR: [
          { title: { contains: q, mode: 'insensitive' } },
          { titleEn: { contains: q, mode: 'insensitive' } },
          { titleRu: { contains: q, mode: 'insensitive' } },
          { titleTh: { contains: q, mode: 'insensitive' } },
          { description: { contains: q, mode: 'insensitive' } },
          { descriptionEn: { contains: q, mode: 'insensitive' } },
          { descriptionRu: { contains: q, mode: 'insensitive' } },
          { descriptionTh: { contains: q, mode: 'insensitive' } },
        ],
      }),
    };

    const total = await prisma.service.count({ where });

    // A rating sort has to see every candidate before it can page them, or
    // page two would re-rank a different set and repeat a service.
    const rankedInRoute = sort === 'rating';
    const rows = await prisma.service.findMany({
      where,
      include: {
        provider: { select: { id: true, name: true, vetted_at: true } },
        coverMedia: { select: { storageKey: true } },
      },
      orderBy: rankedInRoute ? ORDER_BY.recent : ORDER_BY[sort],
      skip: rankedInRoute ? undefined : offset,
      take: rankedInRoute ? undefined : limit,
    });

    const ratings = await ratingsByService(rows.map((s) => s.id));

    let ordered = rows;
    if (rankedInRoute) {
      ordered = [...rows].sort((a, b) => {
        const ra = ratings.get(a.id);
        const rb = ratings.get(b.id);
        // Unreviewed sorts last — unknown, not bad.
        if (Boolean(ra) !== Boolean(rb)) return ra ? -1 : 1;
        if (ra && rb && ra.averageRating !== rb.averageRating) {
          return rb.averageRating - ra.averageRating;
        }
        if (ra && rb && ra.reviewCount !== rb.reviewCount) return rb.reviewCount - ra.reviewCount;
        return b.createdAt.getTime() - a.createdAt.getTime();
      });
      ordered = ordered.slice(offset, offset + limit);
    }

    const viewer = await getCurrentUser().catch(() => null);
    await track(prisma, 'service_catalog_viewed', {
      identityId: viewer?.identityId,
      serviceCount: ordered.length,
    }).catch(() => null);

    const locale = getRequestLocale();

    return NextResponse.json({
      services: ordered.map((s) => {
        const rating = ratings.get(s.id);
        return {
          id: s.id,
          ...pickLocalizedServiceCopy(s, locale),
          categoryKey: s.categoryKey,
          priceModel: s.priceModel,
          basePriceThb: s.basePriceThb,
          durationMin: s.durationMin,
          advanceNoticeHours: s.advanceNoticeHours,
          providerName: s.provider?.name || null,
          providerVetted: Boolean(s.provider?.vetted_at),
          coverUrl: s.coverMedia?.storageKey || null,
          // Absent, not zero, for a service nobody has reviewed.
          averageRating: rating?.averageRating ?? null,
          reviewCount: rating?.reviewCount ?? 0,
        };
      }),
      total,
      limit,
      offset,
      sort,
    });
  } catch (error) {
    return handleError(error);
  }
}
