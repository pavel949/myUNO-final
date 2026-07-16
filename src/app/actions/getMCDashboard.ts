'use server';

import { prisma } from '@/lib/prisma';
import {
  getMCDashboard,
  getMCManagedUnits,
  getMCBookings,
  getMCTickets,
  getMCFeeReport,
} from '@/modules/projects';

export async function fetchMCDashboard(
  mcIdentityId: string,
  projectId: string,
  organizationId: string
) {
  try {
    const dashboard = await getMCDashboard(prisma, mcIdentityId, projectId, organizationId);
    const unitsRaw = await getMCManagedUnits(prisma, mcIdentityId, projectId, organizationId);
    const bookingsRaw = await getMCBookings(prisma, mcIdentityId, projectId, organizationId, 50);
    const ticketsRaw = await getMCTickets(prisma, mcIdentityId, projectId, organizationId, 10);

    // Cast to any to avoid type mismatches between Prisma and client types
    const units = unitsRaw as any;
    const bookings = bookingsRaw as any;
    const tickets = ticketsRaw as any;

    return {
      dashboard,
      units,
      bookings,
      tickets,
    };
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : 'Failed to fetch MC dashboard');
  }
}

export async function fetchMCBookings(
  mcIdentityId: string,
  projectId: string,
  organizationId: string,
  limit: number = 50,
  offset: number = 0
) {
  try {
    return await getMCBookings(prisma, mcIdentityId, projectId, organizationId, limit, offset);
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : 'Failed to fetch MC bookings');
  }
}

export async function fetchMCTickets(
  mcIdentityId: string,
  projectId: string,
  organizationId: string,
  limit: number = 50,
  offset: number = 0
) {
  try {
    return await getMCTickets(prisma, mcIdentityId, projectId, organizationId, limit, offset);
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : 'Failed to fetch MC tickets');
  }
}

export async function fetchMCFeeReport(
  mcIdentityId: string,
  projectId: string,
  organizationId: string,
  periodStart: Date,
  periodEnd: Date
) {
  try {
    return await getMCFeeReport(
      prisma,
      mcIdentityId,
      projectId,
      organizationId,
      periodStart,
      periodEnd
    );
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : 'Failed to fetch MC fee report');
  }
}
