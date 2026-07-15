import { PrismaClient, BookingStatus } from '@prisma/client';

export async function rollupMetricsDaily(db: PrismaClient, date?: Date) {
  const targetDate = date || new Date();
  targetDate.setUTCHours(0, 0, 0, 0);

  // Get all units across all projects
  const units = await db.unit.findMany({
    select: { id: true, projectId: true },
  });

  for (const unit of units) {
    // Count available nights (all calendar nights except blocked dates)
    // For now, we'll use 1 for simplicity — in production, this would be the actual number of nights the unit is available
    const nightsAvailable = 1;

    // Get bookings that overlap this date
    const bookings = await db.booking.findMany({
      where: {
        unitId: unit.id,
        startDate: { lte: targetDate },
        endDate: { gt: targetDate },
        status: {
          in: [
            BookingStatus.confirmed,
            BookingStatus.checked_in,
            BookingStatus.checked_out,
            BookingStatus.completed,
          ],
        },
      },
      select: {
        id: true,
        totalThb: true,
      },
    });

    // Count occupied nights (1 night per booking on this date)
    const nightsOccupied = bookings.length;

    // Sum rental revenue
    const rentalRevenueCents = bookings.reduce((sum, b) => sum + b.totalThb * 100, 0);

    // Get service orders on this date
    const serviceOrders = await db.serviceOrder.findMany({
      where: {
        unit_id: unit.id,
        status: {
          in: ['fulfilled', 'closed'],
        },
        createdAt: {
          gte: targetDate,
          lt: new Date(targetDate.getTime() + 24 * 60 * 60 * 1000),
        },
      },
      select: {
        id: true,
        total_thb: true,
      },
    });

    const serviceOrderCount = serviceOrders.length;
    const serviceOrderRevenueCents = serviceOrders.reduce(
      (sum, o) => sum + o.total_thb * 100,
      0
    );

    // Calculate derived metrics
    const occupancyPct = nightsAvailable > 0 ? (nightsOccupied / nightsAvailable) * 100 : 0;
    const adrCents =
      nightsOccupied > 0 ? Math.round(rentalRevenueCents / nightsOccupied) : null;
    const revpanCents =
      nightsAvailable > 0 ? Math.round(rentalRevenueCents / nightsAvailable) : null;

    // Upsert the metric (create or update if exists for this unit+date)
    await db.metricDaily.upsert({
      where: {
        unitId_date: {
          unitId: unit.id,
          date: targetDate,
        },
      },
      update: {
        nightsAvailable,
        nightsOccupied,
        rentalRevenueCents: Math.round(rentalRevenueCents),
        serviceOrderCount,
        serviceOrderRevenueCents: Math.round(serviceOrderRevenueCents),
        occupancyPct,
        adrCents,
        revpanCents,
      },
      create: {
        projectId: unit.projectId,
        unitId: unit.id,
        date: targetDate,
        nightsAvailable,
        nightsOccupied,
        rentalRevenueCents: Math.round(rentalRevenueCents),
        serviceOrderCount,
        serviceOrderRevenueCents: Math.round(serviceOrderRevenueCents),
        occupancyPct,
        adrCents,
        revpanCents,
      },
    });
  }
}
