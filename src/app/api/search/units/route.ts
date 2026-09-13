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
 * Canonical guest inventory search built on the current production-proven path.
 *
 * InventoryCategory is authoritative for category identity and base commercial
 * data. categoryKey remains a compatibility slug. Date-specific pricing still
 * resolves through the existing production pricing engine, which is server-side
 * and unit-scoped.
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
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '50', 10), 1), 100);
    const offset = Math.max(parseInt(searchParams.get('offset') || '0', 10), 0);

    const startDate = startDateStr ? new Date(startDateStr) : undefined;
    const endDate = endDateStr ? new Date(endDateStr) : undefined;

    if ((startDate && !endDate) || (!startDate && endDate)) {
      return NextResponse.json(
        { error: 'startDate and endDate must be supplied together' },
        { status: 400 }
      );
    }
    if (
      (startDate && Number.isNaN(startDate.getTime())) ||
      (endDate && Number.isNaN(endDate.getTime())) ||
      (startDate && endDate && startDate >= endDate)
    ) {
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

    let canonicalCategory: {
      id: string;
      projectId: string;
      categoryKey: string;
      name: string;
      status: string;
      baseNightlyThb: number;
    } | null = null;

    if (inventoryCategoryId) {
      canonicalCategory = await prisma.inventoryCategory.findUnique({
        where: { id: inventoryCategoryId },
        select: {
          id: true,
          projectId: true,
          categoryKey: true,
          name: true,
          status: true,
          baseNightlyThb: true,
        },
      });

      // InventoryCategory.status is a text lifecycle with production value `live`.
      if (!canonicalCategory || canonicalCategory.status !== 'live') {
        return NextResponse.json({ units: [], total: 0, limit, offset, sort: sort.key }, { status: 200 });
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
      inventoryCategoryId: { not: null },
      ...(totalGuests > 0 && { maxGuests: { gte: totalGuests } }),
      ...(unitTypes.length > 0 && { unitType: { in: unitTypes } }),
      ...(bedrooms !== undefined && { bedrooms }),
      ...(inventoryCategoryId
        ? { inventoryCategoryId }
        : categoryKey
          ? { inventoryCategory: { categoryKey, status: 'live' } }
          : { inventoryCategory: { status: 'live' } }),
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

    const candidates = await prisma.unit.findMany({
      where,
      include: {
        project: { select: { id: true, name: true } },
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
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      take: 500,
    });

    const priced = await Promise.all(
      candidates.map(async (unit) => {
        const canonicalBase = unit.inventoryCategory?.baseNightlyThb ?? unit.baseNightlyThb;
        const effectiveNightlyThb = startDate
          ? await getApplicableNightlyPrice(prisma, startDate, unit.id)
          : canonicalBase;
        return { unit, effectiveNightlyThb };
      })
    );

    let filtered = priced;
    if (minPrice !== undefined) {
      filtered = filtered.filter((entry) => entry.effectiveNightlyThb >= minPrice);
    }
    if (maxPrice !== undefined) {
      filtered = filtered.filter((entry) => entry.effectiveNightlyThb <= maxPrice);
    }

    if (groupBy === 'category') {
      const grouped = new Map<
        string,
        {
          id: string;
          key: string;
          name: string;
          count: number;
          fromNightlyThb: number;
        }
      >();

      for (const entry of filtered) {
        const category = entry.unit.inventoryCategory;
        if (!category) continue;
        const existing = grouped.get(category.id);
        if (!existing) {
          grouped.set(category.id, {
            id: category.id,
            key: category.categoryKey,
            name: category.name,
            count: 1,
            fromNightlyThb: entry.effectiveNightlyThb,
          });
        } else {
          existing.count += 1;
          existing.fromNightlyThb = Math.min(existing.fromNightlyThb, entry.effectiveNightlyThb);
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
            category_id: entry.id,
            category_key: entry.key,
            canonical: true,
            label:
              entry.name ||
              (translated && translated !== labelKey && translated !== '—' ? translated : entry.key),
            available_count: entry.count,
            from_nightly_thb: entry.fromNightlyThb,
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

    const ratings = await getUnitRatings(prisma, filtered.map((entry) => entry.unit.id));

    if (sort.key === 'price_asc' || sort.key === 'price_desc') {
      const direction = sort.key === 'price_asc' ? 1 : -1;
      filtered.sort(
        (a, b) =>
          direction * (a.effectiveNightlyThb - b.effectiveNightlyThb) ||
          a.unit.id.localeCompare(b.unit.id)
      );
    } else if (sort.needsRating) {
      const rankedIds = rankByRating(
        filtered.map((entry) => ({
          id: entry.unit.id,
          createdAt: entry.unit.createdAt,
          ...(ratings.get(entry.unit.id) ?? { averageRating: null, reviewCount: 0 }),
        }))
      ).map((row) => row.id);
      const order = new Map(rankedIds.map((id, index) => [id, index]));
      filtered.sort((a, b) => (order.get(a.unit.id) ?? 0) - (order.get(b.unit.id) ?? 0));
    } else if (sort.key === 'bedrooms_desc') {
      filtered.sort(
        (a, b) =>
          b.unit.bedrooms - a.unit.bedrooms ||
          a.effectiveNightlyThb - b.effectiveNightlyThb ||
          a.unit.id.localeCompare(b.unit.id)
      );
    } else if (sort.key === 'capacity_desc') {
      filtered.sort(
        (a, b) =>
          b.unit.maxGuests - a.unit.maxGuests ||
          a.effectiveNightlyThb - b.effectiveNightlyThb ||
          a.unit.id.localeCompare(b.unit.id)
      );
    } else {
      filtered.sort(
        (a, b) =>
          b.unit.createdAt.getTime() - a.unit.createdAt.getTime() ||
          a.unit.id.localeCompare(b.unit.id)
      );
    }

    const total = filtered.length;
    const page = filtered.slice(offset, offset + limit);

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
        units: page.map(({ unit, effectiveNightlyThb }) => {
          const { coverMedia, media, inventoryCategory, ...rest } = unit;
          const rating = ratings.get(unit.id);
          return {
            ...rest,
            baseNightlyThb: effectiveNightlyThb,
            effectiveNightlyThb,
            inventoryCategory,
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
