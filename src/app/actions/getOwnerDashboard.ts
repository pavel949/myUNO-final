'use server';

import { prisma } from '@/lib/prisma';
import { getOwnerDashboard, getOwnerPortfolioShape, getOwnerProjects, getOwnerBookingsList, getOwnerAlerts, getOwnerComplianceSummary, getOwnerStatements } from '@/modules/projects';
import { getMetricsSeries, getUnitOccupancySparklines } from '@/modules/analytics';
import type { MetricsPoint } from '@/modules/analytics';
import type { OwnerAlert, OwnerComplianceStatus } from '@/modules/projects';
import type { OwnerStatement } from '@prisma/client';

export interface OwnerTrends {
  /** Last 6 calendar months (oldest first) from MetricDaily. */
  monthly: MetricsPoint[];
  /** Previous full month, for the stat-tile delta chips (null = no data). */
  prevMonth: { nights: number; revenueThb: number } | null;
  /** Per-unit last-30-nights occupancy dots (1 = occupied). */
  sparklines: Record<string, number[]>;
}

interface OwnerDashboardData {
  dashboard: any;
  shape: any;
  projects: any[];
  bookings: any[];
  trends: OwnerTrends;
  alerts: OwnerAlert[];
  complianceSummary: OwnerComplianceStatus[];
  statements: OwnerStatement[];
}

export async function fetchOwnerDashboard(ownerIdentityId: string): Promise<OwnerDashboardData> {
  try {
    const dashboard = await getOwnerDashboard(prisma, ownerIdentityId);
    const shape = await getOwnerPortfolioShape(prisma, ownerIdentityId);
    const projects = shape.isPortfolio ? await getOwnerProjects(prisma, ownerIdentityId) : [];

    // Bookings across ALL the owner's units (portfolio owners were
    // previously shown only their first unit's bookings)
    let bookings: any[] = [];
    if (dashboard.units.length > 0) {
      const perUnit = await Promise.all(
        dashboard.units.map((unit: { id: string }) =>
          getOwnerBookingsList(prisma, unit.id, ownerIdentityId, 10)
        )
      );
      bookings = perUnit
        .flat()
        .sort(
          (a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
        )
        .slice(0, 10);
    }

    // Historical trends from the analytics read seam (MetricDaily).
    const unitIds = dashboard.units.map((u: { id: string }) => u.id);
    const trends: OwnerTrends = { monthly: [], prevMonth: null, sparklines: {} };
    if (unitIds.length > 0) {
      const now = new Date();
      const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5, 1));
      const [monthly, sparkDots] = await Promise.all([
        getMetricsSeries(prisma, { unitIds, from, to: now, groupBy: 'month' }),
        getUnitOccupancySparklines(prisma, unitIds, 30),
      ]);
      trends.monthly = monthly;

      const prevPeriod = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1))
        .toISOString()
        .slice(0, 7);
      const prev = monthly.find((p) => p.period === prevPeriod);
      trends.prevMonth = prev
        ? { nights: prev.nightsOccupied, revenueThb: prev.rentalRevenueThb }
        : null;

      for (const [unitId, dots] of Object.entries(sparkDots)) {
        trends.sparklines[unitId] = dots.map((d) => (d.occupied ? 1 : 0));
      }
    }

    // D2: Compliance, alerts, and statements
    const [alerts, complianceSummary, statements] = await Promise.all([
      getOwnerAlerts(prisma, ownerIdentityId),
      getOwnerComplianceSummary(prisma, ownerIdentityId),
      getOwnerStatements(prisma, ownerIdentityId),
    ]);

    return {
      dashboard,
      shape,
      projects,
      bookings,
      trends,
      alerts,
      complianceSummary,
      statements,
    };
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : 'Failed to fetch owner dashboard');
  }
}
