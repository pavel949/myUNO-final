import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { track } from '@/modules/analytics';
import { getApplicableNightlyPrice } from '@/modules/core';
import { t, type Locale } from '@/modules/content';
import { LOCALES, DEFAULT_LOCALE } from '@/modules/content';
import {
  parseUnitSort,
  rankByRating,
  getUnitRatings,
  parseMapBounds,
  boundsWhere,
} from '@/modules/browse';
import { listAreas, collectDescendantIds } from '@/modules/projects';

/**
 * GET /api/search/units
 * Search for available units with optional filters.
 * Query params:
 * - projectId?: string
 * - startDate?: ISO date string
 * - endDate?: ISO date string
 * - adultsCount?: number
 * - childrenCount?: number
 * - minPrice?: number (THB)
 * - maxPrice?: number (THB)
 * - amenities?: comma-separated amenity keys
 * - unitTypes?: comma-separated unit type keys
 * - bedrooms?: number (exact)
 * - categoryKey?: string (unit category, LY-6)
 * - areaSlug?: an area, including every area beneath it — "the west coast"
 *   covers its beaches without anyone restating the list.
 * - swLat/swLng/neLat/neLng?: a map viewport, all four or none. Filters on the
 *   project's coordinates — a unit's location is its project's.
 * - sort?: one of the browse sort keys (recommended | price_asc | price_desc |
 *   bedrooms_desc | capacity_desc | top_rated). An unknown value falls back to
 *   the default rather than failing the search.
 * - groupBy=category: return per-category availability instead of a unit
 *   list — {categories: [{category_key, available_count, from_nightly_thb}]}.
 *   from_nightly_thb is the first-night price when dates are given (the
 *   category seasonal rate via the pricing engine), else the cheapest base.
 * - limit?: number (default 50)
 * - offset?: number (default 0)
 */
export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;

    const projectId = searchParams.get('projectId') || undefined;
    const startDateStr = searchParams.get('startDate');
    const endDateStr = searchParams.get('endDate');
    const adultsCount = searchParams.get('adultsCount')
      ? parseInt(searchParams.get('adultsCount')!)
      : undefined;
    const childrenCount = searchParams.get('childrenCount')
      ? parseInt(searchParams.get('childrenCount')!)
      : undefined;
    const minPrice = searchParams.get('minPrice')
      ? parseInt(searchParams.get('minPrice')!)
      : undefined;
    const maxPrice = searchParams.get('maxPrice')
      ? parseInt(searchParams.get('maxPrice')!)
      : undefined;
    const unitTypesStr = searchParams.get('unitTypes');
    const bedrooms = searchParams.get('bedrooms')
      ? parseInt(searchParams.get('bedrooms')!)
      : undefined;
    const categoryKey = searchParams.get('categoryKey') || undefined;
    const groupBy = searchParams.get('groupBy') || undefined;
    const sort = parseUnitSort(searchParams.get('sort'));
    const limit = Math.min(
      parseInt(searchParams.get('limit') || '50'),
      100
    );
    const offset = parseInt(searchParams.get('offset') || '0');

    const startDate = startDateStr ? new Date(startDateStr) : undefined;
    const endDate = endDateStr ? new Date(endDateStr) : undefined;

    // Validate dates
    if (startDate && endDate && startDate >= endDate) {
      return NextResponse.json(
        { error: 'startDate must be before endDate' },
        { status: 400 }
      );
    }

    // Validate guest counts
    const totalGuests = (adultsCount || 0) + (childrenCount || 0);
    if (totalGuests < 1) {
      return NextResponse.json(
        { error: 'At least one guest is required' },
        { status: 400 }
      );
    }

    // A partly-given map viewport is refused rather than ignored: dropping it
    // would return villas outside the map the guest is looking at, while
    // appearing to respect it.
    const parsedBounds = parseMapBounds((key) => searchParams.get(key));
    if (!parsedBounds.ok) {
      return NextResponse.json({ error: parsedBounds.error }, { status: 400 });
    }

    // An area covers everything beneath it. An unknown slug matches nothing
    // rather than everything — silently widening a filtered search to the whole
    // portfolio is the dangerous direction to fail in.
    const areaSlug = searchParams.get('areaSlug') || undefined;
    let areaProjectIds: string[] | null = null;
    if (areaSlug) {
      const area = await prisma.area.findUnique({ where: { slug: areaSlug }, select: { id: true } });
      if (!area) {
        areaProjectIds = [];
      } else {
        const areas = await listAreas(prisma);
        const inArea = await prisma.project.findMany({
          where: { areaId: { in: collectDescendantIds(areas, area.id) } },
          select: { id: true },
        });
        areaProjectIds = inArea.map((p) => p.id);
      }
    }

    // Parse filters
    const unitTypes = unitTypesStr ? unitTypesStr.split(',') : [];

    // Project scope: an explicit project, an area, or both — in which case the
    // answer is the intersection. Spreading them separately would let one
    // silently overwrite the other and widen the search past what was asked.
    const projectScope =
      areaProjectIds !== null
        ? {
            projectId: {
              in: projectId ? areaProjectIds.filter((id) => id === projectId) : areaProjectIds,
            },
          }
        : projectId
          ? { projectId }
          : {};

    // Build where clause
    const where: any = {
      status: 'live',
      ...projectScope,
      ...(minPrice !== undefined && { baseNightlyThb: { gte: minPrice } }),
      ...(maxPrice !== undefined && { baseNightlyThb: { lte: maxPrice } }),
      ...(adultsCount !== undefined && { maxGuests: { gte: adultsCount } }),
      ...(unitTypes.length > 0 && { unitType: { in: unitTypes } }),
      ...(bedrooms !== undefined && { bedrooms }),
      ...(categoryKey && { categoryKey }),
      ...(parsedBounds.bounds ? boundsWhere(parsedBounds.bounds) : {}),
    };

    // If date range provided, exclude units with overlapping bookings or blocks
    if (startDate && endDate) {
      const conflictingUnits = await prisma.booking.findMany({
        where: {
          startDate: { lt: endDate },
          endDate: { gt: startDate },
          OR: [
            { status: { in: ['confirmed', 'checked_in'] } },
            // Unpaid holds only block while still live
            { status: 'pending_payment', holdExpiresAt: { gt: new Date() } },
          ],
        },
        select: { unitId: true },
        distinct: ['unitId'],
      });

      const blockedUnits = await prisma.blockedDate.findMany({
        where: {
          startDate: { lt: endDate },
          endDate: { gt: startDate },
        },
        select: { unitId: true },
        distinct: ['unitId'],
      });

      const unavailableUnitIds = new Set(
        conflictingUnits
          .map((b) => b.unitId)
          .concat(blockedUnits.map((b) => b.unitId))
      );

      if (unavailableUnitIds.size > 0) {
        where.id = { notIn: Array.from(unavailableUnitIds) };
      }
    }

    // Category rollup (LY-6): one card per sellable category instead of a
    // flat unit list. Uses the same availability-filtered where clause.
    if (groupBy === 'category') {
      const categoryUnits = await prisma.unit.findMany({
        where: { ...where, categoryKey: categoryKey ?? { not: null } },
        select: { id: true, categoryKey: true, baseNightlyThb: true },
        orderBy: { baseNightlyThb: 'asc' },
      });

      const grouped = new Map<string, { count: number; cheapestUnitId: string; minBase: number }>();
      for (const unit of categoryUnits) {
        const key = unit.categoryKey as string;
        const entry = grouped.get(key);
        if (!entry) {
          grouped.set(key, { count: 1, cheapestUnitId: unit.id, minBase: unit.baseNightlyThb });
        } else {
          entry.count += 1;
        }
      }

      const cookieLocale = req.cookies.get('locale')?.value as Locale | undefined;
      const locale =
        cookieLocale && LOCALES.includes(cookieLocale) ? cookieLocale : DEFAULT_LOCALE;

      const categories = await Promise.all(
        Array.from(grouped.entries()).map(async ([key, entry]) => {
          const labelKey = `catalog.unit_categories.${key}.label`;
          const label = await t(prisma, labelKey, undefined, locale).catch(() => key);
          return {
            category_key: key,
            label: label && label !== labelKey && label !== '—' ? label : key,
            available_count: entry.count,
            from_nightly_thb: startDate
              ? await getApplicableNightlyPrice(prisma, startDate, entry.cheapestUnitId)
              : entry.minBase,
          };
        })
      );
      categories.sort((a, b) => a.from_nightly_thb - b.from_nightly_thb);

      await track(prisma, categories.length > 0 ? 'search_performed' : 'search_no_results', {
        projectId,
        groupBy: 'category',
        resultsCount: categories.length,
        hasDates: Boolean(startDate && endDate),
        guests: totalGuests,
      });

      return NextResponse.json({ categories }, { status: 200 });
    }

    const listInclude = {
      project: {
        select: { id: true, name: true },
      },
      coverMedia: { select: { storageKey: true } },
      media: {
        orderBy: { sort: 'asc' as const },
        take: 1,
        select: { media: { select: { storageKey: true } } },
      },
    };

    // Most sorts are a database ORDER BY; "top rated" is not, because the
    // rating lives across review → booking → unit rather than in a column. So
    // it ranks the whole matching set and then takes the page. Ranking only the
    // page would order whichever villas the database happened to return first —
    // a different list entirely.
    let rankedPageIds: string[] | null = null;
    if (sort.needsRating) {
      const candidates = await prisma.unit.findMany({
        where,
        select: { id: true, createdAt: true },
      });
      const candidateRatings = await getUnitRatings(
        prisma,
        candidates.map((u) => u.id)
      );
      rankedPageIds = rankByRating(
        candidates.map((u) => ({
          id: u.id,
          createdAt: u.createdAt,
          ...(candidateRatings.get(u.id) ?? { averageRating: null, reviewCount: 0 }),
        }))
      )
        .slice(offset, offset + limit)
        .map((u) => u.id);
    }

    const page = rankedPageIds
      ? await prisma.unit.findMany({
          where: { id: { in: rankedPageIds } },
          include: listInclude,
        })
      : await prisma.unit.findMany({
          where,
          include: listInclude,
          take: limit,
          skip: offset,
          orderBy: sort.orderBy,
        });

    // `IN` gives no order back, so the ranked order is restored here.
    const units = rankedPageIds
      ? rankedPageIds
          .map((id) => page.find((u) => u.id === id))
          .filter((u): u is (typeof page)[number] => Boolean(u))
      : page;

    // Fetch total count
    const total = await prisma.unit.count({ where });

    // Ratings for the cards on this page — a villa nobody has reviewed gets
    // null, not zero: it is unknown, not bad.
    const ratings = await getUnitRatings(
      prisma,
      units.map((u) => u.id)
    );

    await track(prisma, total > 0 ? 'search_performed' : 'search_no_results', {
      projectId,
      resultsCount: total,
      hasDates: Boolean(startDate && endDate),
      guests: totalGuests,
      sort: sort.key,
    });

    return NextResponse.json(
      {
        units: units.map((unit) => {
          const { coverMedia, media, ...rest } = unit;
          const rating = ratings.get(unit.id);
          return {
            ...rest,
            coverUrl: coverMedia?.storageKey || media[0]?.media.storageKey || null,
            averageRating: rating?.averageRating ?? null,
            reviewCount: rating?.reviewCount ?? 0,
          };
        }),
        total,
        limit,
        offset,
        sort: sort.key,
      },
      { status: 200 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
