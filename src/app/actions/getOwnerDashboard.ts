'use server';

import { prisma } from '@/lib/prisma';
import { getOwnerDashboard, getOwnerPortfolioShape, getOwnerProjects, getOwnerBookingsList } from '@/modules/projects';

export async function fetchOwnerDashboard(ownerIdentityId: string) {
  try {
    const dashboard = await getOwnerDashboard(prisma, ownerIdentityId);
    const shape = await getOwnerPortfolioShape(prisma, ownerIdentityId);
    const projects = shape.isPortfolio ? await getOwnerProjects(prisma, ownerIdentityId) : [];

    let bookings: any[] = [];
    if (dashboard.units.length > 0) {
      bookings = await getOwnerBookingsList(prisma, dashboard.units[0].id, ownerIdentityId, 10);
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
