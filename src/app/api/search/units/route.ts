import { NextRequest, NextResponse } from 'next/server';
import { bahtToSatang } from '@/lib/money';
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
 *
 * Canonical category filter: inventoryCategoryId.
 * categoryKey remains accepted as a compatibility alias while older public
 * links and saved searches migrate.
 */
export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;

    const projectId = searchParams.get('projectId') || undefined;
    const inventoryCategoryId = searchParams.get('inventoryCategoryId') || undefined;
    const startDateStr = searchParams.get('startDate');
    const endDateStr = searchParams.get('endDate');
    const adultsCount = searchParams.get('adultsCount')
      ? parseInt(searchParams.get('adultsCount')!)
      : undefined;
    const childrenCount = searchParams.get('childrenCount')
      ? parseInt(searchParams.get('childrenCount')!)
      : undefined;
    const minPrice = searchParams.get('minPrice')
      ? bahtToSatang(parseInt(searchParams.get('minPrice')!))
      : undefined;
    const maxPrice = searchParams.get('maxPrice')
      ? bahtToSatang(parseInt(searchParams.get('maxPrice')!))
      : undefined;
    const unitTypesStr = searchParams.get('unitTypes');
    const bedrooms = searchParams.get('bedrooms')
      ? parseInt(searchParams.get('bedrooms')!)
      : undefined;
    const categoryKey = searchParams.get('categoryKey') || undefined;
    const groupBy = searchParams.get('groupBy') || undefined;
    const sort = parseUnitSort(searchParams.get('sort'));
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');

    const startDate = startDateStr ? new Date(startDateStr) : undefined;
    const endDate = endDateStr ? new Date(endDateStr) : undefined;

    if (startDate && endDate && startDate >= endDate) {
      return NextResponse.json({ error: 'startDate must be before endDate' }, { status: 400 });
    }

    const totalGuests = (adultsCount || 0) + (childrenCount || 0);
    if (totalGuests < 1) {
      return NextResponse.json({ error: 'At least one guest is required' }, { status: 400 });
    }

    const parsedBounds = parseMapBounds((key) => searchParams.get(key));
    if (!parsedBounds.ok) {
      return NextResponse.json({ error: parsedBounds.error }, { status: 400 });
    }

    // A canonical category id is globally unique and therefore authoritative.
    // Verify any redundant project/key selectors agree with it rather than
    // returning a surprising empty result for a broken link.
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
      if (!canonicalCategory || canonicalCategory.status !== 'active') {
        return NextResponse.json({ units: [], total: 0, limit, offset, sort: sort.key }, { status: 200 });
      }
      if (projectId && projectId !== canonicalCategory.projectId) {
        return NextResponse.json({ error: 'inventoryCategoryId does not belong to projectId' }, { status: 400 });
      }
      if (categoryKey && categoryKey !== canonicalCategory.categoryKey) {
        return NextResponse.json({ error: 'categoryKey disagrees with inventoryCategoryId' }, { status: 400 });
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

    const unitTypes = unitTypesStr ? unitTypesStr.split(',') : [];
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
      project: projectFilter,
      ...projectScope,
      ...(minPrice !== undefined || maxPrice !== undefined
        ? {
            baseNightlyThb: {
              ...(minPrice !== undefined && { gte: minPrice }),
              ...(maxPrice !== undefined && { lte: maxPrice }),
            },
          }
        : {}),
      ...(adultsCount !== undefined && { maxGuests: { gte: adultsCount } }),
      ...(unitTypes.length > 0 && { unitType: { in: unitTypes } }),
      ...(bedrooms !== undefined && { bedrooms }),
      ...(inventoryCategoryId
        ? { inventoryCategoryId }
        : categoryKey
          ? { categoryKey }
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
              ? { categoryKey }
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
            select: { id: true, categoryKey: true, name: true, status: true },
          },
          baseNightlyThb: true,
        },
        orderBy: { baseNightlyThb: 'asc' },
      });

      type GroupedCategory = {
        id: string | null;
        key: string;
        name: string | null;
        canonical: boolean;
        count: number;
        cheapestUnitId: string;
        minBase: number;
      };
      const grouped = new Map<string, GroupedCategory>();
      for (const unit of categoryUnits) {
        const category = unit.inventoryCategory;
        const key = category?.categoryKey || unit.categoryKey;
        if (!key) continue;
        const mapKey = category ? `id:${category.id}` : `legacy:${key}`;
        const entry = grouped.get(mapKey);
        if (!entry) {
          grouped.set(mapKey, {
            id: category?.id || null,
            key,
            name: category?.name || null,
            canonical: Boolean(category),
            count: 1,
            cheapestUnitId: unit.id,
            minBase: unit.baseNightlyThb,
          });
        } else {
          entry.count += 1;
        }
      }

      const cookieLocale = req.cookies.get('locale')?.value as Locale | undefined;
      const locale = cookieLocale && LOCALES.includes(cookieLocale) ? cookieLocale : DEFAULT_LOCALE;

      const categories = await Promise.all(
        Array.from(grouped.values()).map(async (entry) => {
          const labelKey = `catalog.unit_categories.${entry.key}.label`;
          const translated = await t(prisma, labelKey, undefined, locale).catch(() => entry.key);
          return {
            inventory_category_id: entry.id,
            category_key: entry.key,
            canonical: entry.canonical,
            label:
              entry.name ||
              (translated && translated !== labelKey && translated !== '—' ? translated : entry.key),
            available_count: entry.count,
            from_nightly_thb: startDate
              ? await getApplicableNightlyPrice(prisma, startDate, entry.cheapestUnitId)
              : entry.minBase,
          };
        })
      );
      categories.sort((a, b) => a.from_nightly_thb - b.from_nightly_thb);

      await track(prisma, categories.length > 0 ? 'search_performed' : 'search_no_results', {
        projectId: effectiveProjectId,
        inventoryCategoryId,
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
      inventoryCategory: {
        select: { id: true, categoryKey: true, name: true, status: true },
      },
      coverMedia: { select: { storageKey: true } },
      media: {
        orderBy: { sort: 'asc' as const },
        take: 1,
        select: { media: { select: { storageKey: true } } },
      },
    };

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

    const units = rankedPageIds
      ? rankedPageIds
          .map((id) => page.find((u) => u.id === id))
          .filter((u): u is (typeof page)[number] => Boolean(u))
      : page;

    const total = await prisma.unit.count({ where });
    const ratings = await getUnitRatings(prisma, units.map((u) => u.id));

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
