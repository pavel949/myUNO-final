import { NextRequest, NextResponse } from 'next/server';
import { bahtToSatang } from '@/lib/money';
import { prisma } from '@/lib/prisma';
import { track } from '@/modules/analytics';
import { resolveEffectiveStayOffer } from '@/modules/booking';
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
 *
 * Canonical category filter: inventoryCategoryId (categoryId is accepted as a
 * compatibility alias). categoryKey remains accepted while older links and
 * saved searches migrate.
 *
 * Price filters and price sorts are intentionally resolved after the physical
 * inventory query. Effective price depends on dates, InventoryCategory,
 * RatePlan and PricingRule, so filtering/sorting Unit.baseNightlyThb in SQL
 * would silently re-introduce the legacy pricing source of truth.
 */
export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;

    const projectId = searchParams.get('projectId') || undefined;
    const inventoryCategoryId =
      searchParams.get('inventoryCategoryId') || searchParams.get('categoryId') || undefined;
    const startDateStr = searchParams.get('startDate');
    const endDateStr = searchParams.get('endDate');
    const adultsCount = searchParams.get('adultsCount')
      ? parseInt(searchParams.get('adultsCount')!, 10)
      : undefined;
    const childrenCount = searchParams.get('childrenCount')
      ? parseInt(searchParams.get('childrenCount')!, 10)
      : undefined;
    const minPrice = searchParams.get('minPrice')
      ? bahtToSatang(parseInt(searchParams.get('minPrice')!, 10))
      : undefined;
    const maxPrice = searchParams.get('maxPrice')
      ? bahtToSatang(parseInt(searchParams.get('maxPrice')!, 10))
      : undefined;
    const unitTypesStr = searchParams.get('unitTypes');
    const bedrooms = searchParams.get('bedrooms')
      ? parseInt(searchParams.get('bedrooms')!, 10)
      : undefined;
    const categoryKey = searchParams.get('categoryKey') || undefined;
    const groupBy = searchParams.get('groupBy') || undefined;
    const sort = parseUnitSort(searchParams.get('sort'));
    const parsedLimit = parseInt(searchParams.get('limit') || '50', 10);
    const parsedOffset = parseInt(searchParams.get('offset') || '0', 10);
    const limit = Number.isFinite(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), 100) : 50;
    const offset = Number.isFinite(parsedOffset) ? Math.max(parsedOffset, 0) : 0;

    if ((startDateStr && !endDateStr) || (!startDateStr && endDateStr)) {
      return NextResponse.json(
        { error: 'startDate and endDate must be supplied together' },
        { status: 400 }
      );
    }

    const startDate = startDateStr ? new Date(startDateStr) : undefined;
    const endDate = endDateStr ? new Date(endDateStr) : undefined;

    if (
      (startDate && Number.isNaN(startDate.getTime())) ||
      (endDate && Number.isNaN(endDate.getTime())) ||
      (startDate && endDate && startDate >= endDate)
    ) {
      return NextResponse.json({ error: 'invalid stay dates' }, { status: 400 });
    }

    const totalGuests = (adultsCount || 0) + (childrenCount || 0);
    if (totalGuests < 1) {
      return NextResponse.json({ error: 'At least one guest is required' }, { status: 400 });
    }

    const parsedBounds = parseMapBounds((key) => searchParams.get(key));
    if (!parsedBounds.ok) {
      return NextResponse.json({ error: parsedBounds.error }, { status: 400 });
    }

    let canonicalCategory: {
      id: string;
      projectId: string;
      categoryKey: string;
      name: string;
      status: string;
    } | null = null;
    if (inventoryCategoryId) {
      canonicalCategory = await prisma.inventoryCategory.findUnique({
        where: { id: inventoryCategoryId },
        select: { id: true, projectId: true, categoryKey: true, name: true, status: true },
      });
      if (!canonicalCategory || canonicalCategory.status !== 'live') {
        return NextResponse.json(
          { units: [], total: 0, limit, offset, sort: sort.key },
          { status: 200 }
        );
      }
      if (projectId && projectId !== canonicalCategory.projectId) {
        return NextResponse.json(
          { error: 'inventoryCategoryId does not belong to projectId' },
          { status: 400 }
        );
      }
      if (categoryKey && categoryKey !== canonicalCategory.categoryKey) {
        return NextResponse.json(
          { error: 'categoryKey disagrees with inventoryCategoryId' },
          { status: 400 }
        );
      }
    }

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

    const unitTypes = unitTypesStr ? unitTypesStr.split(',').filter(Boolean) : [];
    const effectiveProjectId = canonicalCategory?.projectId || projectId;

    const projectScope =
      areaProjectIds !== null
        ? {
            projectId: {
              in: effectiveProjectId
                ? areaProjectIds.filter((id) => id === effectiveProjectId)
                : areaProjectIds,
            },
          }
        : effectiveProjectId
          ? { projectId: effectiveProjectId }
          : {};

    const projectFilter = {
      status: 'live' as const,
      ...(parsedBounds.bounds ? boundsWhere(parsedBounds.bounds).project : {}),
    };

    const where: any = {
      status: 'live',
      assetStatus: { not: 'suspended' },
      project: projectFilter,
      ...projectScope,
      maxGuests: { gte: totalGuests },
      ...(unitTypes.length > 0 && { unitType: { in: unitTypes } }),
      ...(bedrooms !== undefined && { bedrooms }),
      ...(inventoryCategoryId
        ? { inventoryCategoryId }
        : categoryKey
          ? {
              OR: [
                { inventoryCategory: { categoryKey } },
                { inventoryCategoryId: null, categoryKey },
              ],
            }
          : {}),
    };

    if (startDate && endDate) {
      const conflictingUnits = await prisma.booking.findMany({
        where: {
          startDate: { lt: endDate },
          endDate: { gt: startDate },
          OR: [
            { status: { in: ['confirmed', 'checked_in'] } },
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
        conflictingUnits.map((b) => b.unitId).concat(blockedUnits.map((b) => b.unitId))
      );

      if (unavailableUnitIds.size > 0) {
        where.id = { notIn: Array.from(unavailableUnitIds) };
      }
    }

    if (groupBy === 'category') {
      const categoryUnits = await prisma.unit.findMany({
        where: {
          ...where,
          ...(inventoryCategoryId
            ? { inventoryCategoryId }
            : categoryKey
              ? {}
              : {
                  OR: [
                    { inventoryCategoryId: { not: null } },
                    { categoryKey: { not: null } },
                  ],
                }),
        },
        select: {
          id: true,
          categoryKey: true,
          inventoryCategoryId: true,
          inventoryCategory: {
            select: {
              id: true,
              categoryKey: true,
              name: true,
              status: true,
              baseNightlyThb: true,
            },
          },
          baseNightlyThb: true,
        },
      });

      type GroupedCategory = {
        id: string | null;
        key: string;
        name: string | null;
        canonical: boolean;
        count: number;
        minBase: number;
      };
      const grouped = new Map<string, GroupedCategory>();
      for (const unit of categoryUnits) {
        const category = unit.inventoryCategory;
        const key = category?.categoryKey || unit.categoryKey;
        if (!key) continue;
        const mapKey = category ? `id:${category.id}` : `legacy:${key}`;
        const canonicalBase = category?.baseNightlyThb ?? unit.baseNightlyThb;
        const entry = grouped.get(mapKey);
        if (!entry) {
          grouped.set(mapKey, {
            id: category?.id || null,
            key,
            name: category?.name || null,
            canonical: Boolean(category),
            count: 1,
            minBase: canonicalBase,
          });
        } else {
          entry.count += 1;
          entry.minBase = Math.min(entry.minBase, canonicalBase);
        }
      }

      const cookieLocale = req.cookies.get('locale')?.value as Locale | undefined;
      const locale = cookieLocale && LOCALES.includes(cookieLocale) ? cookieLocale : DEFAULT_LOCALE;

      const categories = await Promise.all(
        Array.from(grouped.values()).map(async (entry) => {
          const labelKey = `catalog.unit_categories.${entry.key}.label`;
          const translated = await t(prisma, labelKey, undefined, locale).catch(() => entry.key);

          let fromNightlyThb = entry.minBase;
          let stayTotalThb: number | null = null;
          let ratePlanCode: string | null = null;
          let minNights: number | null = null;

          if (entry.id && startDate && endDate) {
            const offer = await resolveEffectiveStayOffer(prisma, {
              categoryId: entry.id,
              startDate,
              endDate,
              guests: totalGuests,
              ratePlanCode: 'BAR',
            });
            fromNightlyThb =
              offer.nightsCount > 0
                ? Math.round(offer.subtotalThb / offer.nightsCount)
                : entry.minBase;
            stayTotalThb = offer.totalThb;
            ratePlanCode = offer.ratePlanCode;
            minNights = offer.minNights;
          }

          return {
            inventory_category_id: entry.id,
            category_key: entry.key,
            canonical: entry.canonical,
            label:
              entry.name ||
              (translated && translated !== labelKey && translated !== '—' ? translated : entry.key),
            available_count: entry.count,
            from_nightly_thb: fromNightlyThb,
            stay_total_thb: stayTotalThb,
            rate_plan_code: ratePlanCode,
            min_nights: minNights,
          };
        })
      );

      const filteredCategories = categories
        .filter(
          (category) =>
            (minPrice === undefined || category.from_nightly_thb >= minPrice) &&
            (maxPrice === undefined || category.from_nightly_thb <= maxPrice)
        )
        .sort((a, b) => a.from_nightly_thb - b.from_nightly_thb);

      await track(
        prisma,
        filteredCategories.length > 0 ? 'search_performed' : 'search_no_results',
        {
          projectId: effectiveProjectId,
          inventoryCategoryId,
          groupBy: 'category',
          resultsCount: filteredCategories.length,
          hasDates: Boolean(startDate && endDate),
          guests: totalGuests,
        }
      );

      return NextResponse.json({ categories: filteredCategories }, { status: 200 });
    }

    const listInclude = {
      project: {
        select: { id: true, name: true },
      },
      inventoryCategory: {
        select: {
          id: true,
          categoryKey: true,
          name: true,
          status: true,
          baseNightlyThb: true,
          minNights: true,
        },
      },
      coverMedia: { select: { storageKey: true } },
      media: {
        orderBy: { sort: 'asc' as const },
        take: 1,
        select: { media: { select: { storageKey: true } } },
      },
    };

    type UnitWithListRelations = Awaited<ReturnType<typeof prisma.unit.findFirst>> & any;
    type PricedUnit = {
      unit: UnitWithListRelations;
      effectiveNightlyThb: number;
      stayTotalThb: number | null;
      ratePlanCode: string | null;
      minNights: number | null;
    };

    const priceUnit = async (unit: UnitWithListRelations): Promise<PricedUnit> => {
      if (startDate && endDate) {
        const offer = await resolveEffectiveStayOffer(prisma, {
          unitId: unit.id,
          startDate,
          endDate,
          guests: totalGuests,
          ratePlanCode: 'BAR',
        });
        return {
          unit,
          effectiveNightlyThb:
            offer.nightsCount > 0
              ? Math.round(offer.subtotalThb / offer.nightsCount)
              : unit.inventoryCategory?.baseNightlyThb ?? unit.baseNightlyThb,
          stayTotalThb: offer.totalThb,
          ratePlanCode: offer.ratePlanCode,
          minNights: offer.minNights,
        };
      }

      return {
        unit,
        effectiveNightlyThb: unit.inventoryCategory?.baseNightlyThb ?? unit.baseNightlyThb,
        stayTotalThb: null,
        ratePlanCode: null,
        minNights: unit.inventoryCategory?.minNights ?? unit.minNights,
      };
    };

    const passesPriceBounds = (priced: PricedUnit) =>
      (minPrice === undefined || priced.effectiveNightlyThb >= minPrice) &&
      (maxPrice === undefined || priced.effectiveNightlyThb <= maxPrice);

    const isPriceSort = sort.key === 'price_asc' || sort.key === 'price_desc';
    const needsCanonicalPricingAcrossCandidates =
      isPriceSort || minPrice !== undefined || maxPrice !== undefined;

    let pricedUnits: PricedUnit[];
    let total: number;

    if (needsCanonicalPricingAcrossCandidates) {
      const candidates = await prisma.unit.findMany({ where, include: listInclude });
      let filtered = (await Promise.all(candidates.map(priceUnit))).filter(passesPriceBounds);
      total = filtered.length;

      if (sort.needsRating) {
        const candidateRatings = await getUnitRatings(prisma, filtered.map((p) => p.unit.id));
        const rankedIds = rankByRating(
          filtered.map((p) => ({
            id: p.unit.id,
            createdAt: p.unit.createdAt,
            ...(candidateRatings.get(p.unit.id) ?? { averageRating: null, reviewCount: 0 }),
          }))
        ).map((p) => p.id);
        const byId = new Map(filtered.map((p) => [p.unit.id, p]));
        filtered = rankedIds.map((id) => byId.get(id)).filter((p): p is PricedUnit => Boolean(p));
      } else {
        filtered.sort((a, b) => {
          if (sort.key === 'price_asc' && a.effectiveNightlyThb !== b.effectiveNightlyThb) {
            return a.effectiveNightlyThb - b.effectiveNightlyThb;
          }
          if (sort.key === 'price_desc' && a.effectiveNightlyThb !== b.effectiveNightlyThb) {
            return b.effectiveNightlyThb - a.effectiveNightlyThb;
          }
          if (sort.key === 'bedrooms_desc' && a.unit.bedrooms !== b.unit.bedrooms) {
            return b.unit.bedrooms - a.unit.bedrooms;
          }
          if (sort.key === 'capacity_desc' && a.unit.maxGuests !== b.unit.maxGuests) {
            return b.unit.maxGuests - a.unit.maxGuests;
          }
          if (sort.key === 'recommended' && a.unit.createdAt.getTime() !== b.unit.createdAt.getTime()) {
            return b.unit.createdAt.getTime() - a.unit.createdAt.getTime();
          }
          return a.unit.id < b.unit.id ? -1 : a.unit.id > b.unit.id ? 1 : 0;
        });
      }

      pricedUnits = filtered.slice(offset, offset + limit);
    } else {
      let rankedPageIds: string[] | null = null;
      if (sort.needsRating) {
        const candidates = await prisma.unit.findMany({
          where,
          select: { id: true, createdAt: true },
        });
        const candidateRatings = await getUnitRatings(prisma, candidates.map((u) => u.id));
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

      const orderedPage = rankedPageIds
        ? rankedPageIds
            .map((id) => page.find((u) => u.id === id))
            .filter((u): u is (typeof page)[number] => Boolean(u))
        : page;

      pricedUnits = await Promise.all(orderedPage.map(priceUnit));
      total = await prisma.unit.count({ where });
    }

    const ratings = await getUnitRatings(prisma, pricedUnits.map((p) => p.unit.id));

    await track(prisma, total > 0 ? 'search_performed' : 'search_no_results', {
      projectId: effectiveProjectId,
      inventoryCategoryId,
      resultsCount: total,
      hasDates: Boolean(startDate && endDate),
      guests: totalGuests,
      sort: sort.key,
    });

    return NextResponse.json(
      {
        units: pricedUnits.map((priced) => {
          const { coverMedia, media, ...rest } = priced.unit;
          const rating = ratings.get(priced.unit.id);
          return {
            ...rest,
            // Compatibility field consumed by the current search cards. It now
            // carries the canonical effective nightly amount for the requested
            // stay rather than the legacy Unit base column.
            baseNightlyThb: priced.effectiveNightlyThb,
            pricing: {
              effectiveNightlyThb: priced.effectiveNightlyThb,
              stayTotalThb: priced.stayTotalThb,
              ratePlanCode: priced.ratePlanCode,
              minNights: priced.minNights,
            },
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
