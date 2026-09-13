'use server';

import { prisma } from '@/lib/prisma';
import { requireSessionIdentityId } from './session-identity';
import {
  getMCDashboard,
  getMCManagedUnits,
  getMCBookings,
  getMCTickets,
  getMCServiceOrders,
} from '@/modules/projects';

export async function fetchMCDashboard(projectId: string, organizationId: string) {
  // `getMCDashboard` already refuses a project/organization this member has no
  // role assignment for. That check is only worth anything once the member is
  // the caller rather than whoever the caller named.
  const mcIdentityId = await requireSessionIdentityId();
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
