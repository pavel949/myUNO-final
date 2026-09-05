'use server';

import { prisma } from '@/lib/prisma';
import {
  getMCDashboard,
  getMCManagedUnits,
  getMCBookings,
  getMCTickets,
  getMCFeeReport,
  getMCServiceOrders,
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
    const serviceOrdersRaw = await getMCServiceOrders(
      prisma,
      mcIdentityId,
      projectId,
      organizationId,
      50
    );

    // Cast to any to avoid type mismatches between Prisma and client types.
    // baseNightlyThb / totalThb are satang like every other amount in the
    // platform (CLAUDE.md); convert to baht here, once, at the boundary to
    // the client component (Q47 — the MC dashboard previously showed every
    // nightly rate and booking total 100x too large).
    const units = (unitsRaw as any[]).map((unit) => ({
      ...unit,
      baseNightlyThb: unit.baseNightlyThb / 100,
    }));
    const bookings = (bookingsRaw as any[]).map((booking) => ({
      ...booking,
      totalThb: booking.totalThb / 100,
    }));
    const tickets = ticketsRaw as any;
    const serviceOrders = (serviceOrdersRaw as any[]).map((order) => ({
      ...order,
      scheduledStart: order.scheduled_start,
      totalThb: order.total_thb / 100,
      noteToProvider: order.note_to_provider,
      paid: order.payments.length > 0,
    }));

    return {
      dashboard,
      units,
      bookings,
      tickets,
      serviceOrders,
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
