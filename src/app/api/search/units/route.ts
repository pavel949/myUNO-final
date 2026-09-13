import { NextRequest, NextResponse } from 'next/server';
import { bahtToSatang } from '@/lib/money';
import { prisma } from '@/lib/prisma';
import { track } from '@/modules/analytics';
import {
  parseUnitSort,
  rankByRating,
  getUnitRatings,
  parseMapBounds,
  boundsWhere,
} from '@/modules/browse';
import { listAreas, collectDescendantIds } from '@/modules/projects';
import { resolveEffectiveStayOffer } from '@/modules/booking';

/**
 * Canonical guest inventory search.
 *
 * InventoryCategory and the effective stay-pricing engine are authoritative.
 * `categoryKey` remains accepted only as a backwards-compatible public slug;
 * it is resolved through InventoryCategory rather than Unit.categoryKey.
 */
export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const projectId = searchParams.get('projectId') || undefined;
    const categoryId = searchParams.get('categoryId') || undefined;
    const categoryKey = searchParams.get('categoryKey') || undefined;
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
    const amenitiesStr = searchParams.get('amenities');
    const bedrooms = searchParams.get('bedrooms')
      ? parseInt(searchParams.get('bedrooms')!, 10)
      : undefined;
    const groupBy = searchParams.get('groupBy') || undefined;
    const sort = parseUnitSort(searchParams.get('sort'));
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '50', 10), 1), 100);
    const offset = Math.max(parseInt(searchParams.get('offset') || '0', 10), 0);

    const startDate = startDateStr ? new Date(startDateStr) : undefined;
    const endDate = endDateStr ? new Date(endDateStr) : undefined;
    if ((startDate && !endDate) || (!startDate && endDate)) {
      return NextResponse.json({ error: 'startDate and endDate must be supplied together' }, { status: 400 });
    }
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
    const amenities = amenitiesStr ? amenitiesStr.split(',').filter(Boolean) : [];

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

    const projectFilter = {
      status: 'live' as const,
      ...(parsedBounds.bounds ? boundsWhere(parsedBounds.bounds).project : {}),
    };

    const now = new Date();
    const overlaps =
      startDate && endDate
        ? { startDate: { lt: endDate }, endDate: { gt: startDate } }
        : null;

    const where: any = {
      status: 'live',
      assetStatus: { not: 'suspended' },
      project: projectFilter,
      ...projectScope,
      inventoryCategoryId: { not: null },
      ...(totalGuests > 0 && { maxGuests: { gte: totalGuests } }),
      ...(unitTypes.length > 0 && { unitType: { in: unitTypes } }),
      ...(amenities.length > 0 && { amenityKeys: { hasEvery: amenities } }),
      ...(bedrooms !== undefined && { bedrooms }),
      ...(categoryId
        ? { inventoryCategoryId: categoryId }
        : categoryKey
          ? { inventoryCategory: { categoryKey, status: 'live' } }
          : { inventoryCategory: { status: 'live' } }),
      ...(overlaps
        ? {
            bookings: {
              none: {
                ...overlaps,
                OR: [
                  { status: { in: ['confirmed', 'checked_in'] } },
                  { status: 'pending_payment', holdExpiresAt: { gt: now } },
                ],
              },
            },
            blockedDates: { none: overlaps },
          }
        : {}),
    };

    const candidates = await prisma.unit.findMany({
      where,
      include: {
        project: { select: { id: true, name: true } },
        inventoryCategory: true,
        coverMedia: { select: { storageKey: true } },
        media: {
          orderBy: { sort: 'asc' },
          take: 1,
          select: { media: { select: { storageKey: true } } },
        },
      },
      take: 500,
    });

    const priced = await Promise.all(
      candidates.map(async (unit) => {
        let effectiveNightlyThb = unit.inventoryCategory?.baseNightlyThb ?? unit.baseNightlyThb;
        let stayTotalThb: number | null = null;
        if (startDate && endDate) {
          const offer = await resolveEffectiveStayOffer(prisma, {
            unitId: unit.id,
            projectId: unit.projectId,
            startDate,
            endDate,
            guests: totalGuests,
          });
          if (!offer.isAvailable) return null;
          effectiveNightlyThb = offer.nightlyBreakdown[0]?.effectiveRateThb ?? effectiveNightlyThb;
          stayTotalThb = offer.totalThb;
        }
        return { unit, effectiveNightlyThb, stayTotalThb };
      })
    );

    let filtered = priced.filter(
      (entry): entry is NonNullable<(typeof priced)[number]> => Boolean(entry)
    );

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
          categoryId: string;
          categoryKey: string;
          label: string;
          availableCount: number;
          fromNightlyThb: number;
        }
      >();

      for (const entry of filtered) {
        const category = entry.unit.inventoryCategory;
        if (!category) continue;
        const existing = grouped.get(category.id);
        if (!existing) {
          grouped.set(category.id, {
            categoryId: category.id,
            categoryKey: category.categoryKey,
            label: category.name,
            availableCount: 1,
            fromNightlyThb: entry.effectiveNightlyThb,
          });
        } else {
          existing.availableCount += 1;
          existing.fromNightlyThb = Math.min(existing.fromNightlyThb, entry.effectiveNightlyThb);
        }
      }

      const categories = Array.from(grouped.values())
        .sort((a, b) => a.fromNightlyThb - b.fromNightlyThb)
        .map((category) => ({
          category_id: category.categoryId,
          category_key: category.categoryKey,
          label: category.label,
          available_count: category.availableCount,
          from_nightly_thb: category.fromNightlyThb,
        }));

      await track(prisma, categories.length > 0 ? 'search_performed' : 'search_no_results', {
        projectId,
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
      filtered.sort((a, b) => b.unit.bedrooms - a.unit.bedrooms || a.effectiveNightlyThb - b.effectiveNightlyThb || a.unit.id.localeCompare(b.unit.id));
    } else if (sort.key === 'capacity_desc') {
      filtered.sort((a, b) => b.unit.maxGuests - a.unit.maxGuests || a.effectiveNightlyThb - b.effectiveNightlyThb || a.unit.id.localeCompare(b.unit.id));
    } else {
      filtered.sort((a, b) => b.unit.createdAt.getTime() - a.unit.createdAt.getTime() || a.unit.id.localeCompare(b.unit.id));
    }

    const total = filtered.length;
    const page = filtered.slice(offset, offset + limit);

    await track(prisma, total > 0 ? 'search_performed' : 'search_no_results', {
      projectId,
      categoryId,
      resultsCount: total,
      hasDates: Boolean(startDate && endDate),
      guests: totalGuests,
      sort: sort.key,
    });

    return NextResponse.json(
      {
        units: page.map(({ unit, effectiveNightlyThb, stayTotalThb }) => {
          const { coverMedia, media, inventoryCategory, ...rest } = unit;
          const rating = ratings.get(unit.id);
          return {
            ...rest,
            // Compatibility field, now derived from the canonical category/quote.
            baseNightlyThb: effectiveNightlyThb,
            effectiveNightlyThb,
            stayTotalThb,
            inventoryCategory: inventoryCategory
              ? {
                  id: inventoryCategory.id,
                  categoryKey: inventoryCategory.categoryKey,
                  name: inventoryCategory.name,
                  minNights: inventoryCategory.minNights,
                }
              : null,
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
