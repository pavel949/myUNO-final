import { PrismaClient } from '@prisma/client';
import { getMetricsSeries, type MetricsPoint } from './index';

export interface AdminDashboardStats {
  units: number;
  liveUnits: number;
  bookings: number;
  pendingPayment: number;
  openTickets: number;
  identities: number;
  revenue30: number;
  nights30: number;
  last30: MetricsPoint[];
}

/**
 * Get admin dashboard statistics: unit/booking/ticket/identity counts and 30-day metrics
 */
export async function getAdminDashboardStats(db: PrismaClient): Promise<AdminDashboardStats> {
  const [units, liveUnits, bookings, pendingPayment, openTickets, identities] =
    await Promise.all([
      db.unit.count(),
      db.unit.count({ where: { status: 'live' } }),
      db.booking.count(),
      db.booking.count({ where: { status: 'pending_payment' } }),
      db.ticket.count({ where: { status: { in: ['open', 'acknowledged', 'in_progress'] } } }),
      db.identity.count(),
    ]);

  // Platform-wide last 30 days from the analytics rollup (MetricDaily)
  const now = new Date();
  const last30 = await getMetricsSeries(db, {
    from: new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000),
    to: now,
    groupBy: 'day',
  });
  const revenue30 = last30.reduce((sum, p) => sum + p.rentalRevenueThb, 0);
  const nights30 = last30.reduce((sum, p) => sum + p.nightsOccupied, 0);

  return {
    units,
    liveUnits,
    bookings,
    pendingPayment,
    openTickets,
    identities,
    revenue30,
    nights30,
    last30,
  };
}
