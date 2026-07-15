'use server';

import { prisma } from '@/lib/prisma';
import { getOwnerDashboard, getOwnerPortfolioShape, getOwnerProjects, getOwnerBookingsList } from '@/modules/projects';

export async function fetchOwnerDashboard(ownerIdentityId: string) {
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

    return {
      dashboard,
      shape,
      projects,
      bookings,
    };
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : 'Failed to fetch owner dashboard');
  }
}
