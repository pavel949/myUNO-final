import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { track } from '@/modules/analytics';

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

    // Parse filters
    const unitTypes = unitTypesStr ? unitTypesStr.split(',') : [];

    // Build where clause
    const where: any = {
      status: 'live',
      ...(projectId && { projectId }),
      ...(minPrice !== undefined && { baseNightlyThb: { gte: minPrice } }),
      ...(maxPrice !== undefined && { baseNightlyThb: { lte: maxPrice } }),
      ...(adultsCount !== undefined && { maxGuests: { gte: adultsCount } }),
      ...(unitTypes.length > 0 && { unitType: { in: unitTypes } }),
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

    // Fetch units
    const units = await prisma.unit.findMany({
      where,
      include: {
        project: {
          select: { id: true, name: true },
        },
        coverMedia: { select: { storageKey: true } },
        media: {
          orderBy: { sort: 'asc' },
          take: 1,
          select: { media: { select: { storageKey: true } } },
        },
      },
      take: limit,
      skip: offset,
      orderBy: { createdAt: 'desc' },
    });

    // Fetch total count
    const total = await prisma.unit.count({ where });

    await track(prisma, total > 0 ? 'search_performed' : 'search_no_results', {
      projectId,
      resultsCount: total,
      hasDates: Boolean(startDate && endDate),
      guests: totalGuests,
    });

    return NextResponse.json(
      {
        units: units.map((unit) => {
          const { coverMedia, media, ...rest } = unit;
          return {
            ...rest,
            coverUrl: coverMedia?.storageKey || media[0]?.media.storageKey || null,
          };
        }),
        total,
        limit,
        offset,
      },
      { status: 200 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
