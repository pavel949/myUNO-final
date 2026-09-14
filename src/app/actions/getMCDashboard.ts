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

    // Resolve the commercial base through the canonical InventoryCategory.
    // Unit.baseNightlyThb remains only a compatibility fallback for an old or
    // not-yet-migrated row; production live units are category-linked.
    const unitIds = (unitsRaw as Array<{ id: string }>).map((unit) => unit.id);
    const canonicalPrices = unitIds.length
      ? await prisma.unit.findMany({
          where: { id: { in: unitIds } },
          select: {
            id: true,
            baseNightlyThb: true,
            inventoryCategory: { select: { baseNightlyThb: true } },
          },
        })
      : [];
    const priceByUnitId = new Map(
      canonicalPrices.map((unit) => [
        unit.id,
        unit.inventoryCategory?.baseNightlyThb ?? unit.baseNightlyThb,
      ])
    );

    // Money is stored in satang; convert exactly once at the server→client boundary.
    const units = (unitsRaw as any[]).map((unit) => ({
      ...unit,
      baseNightlyThb: (priceByUnitId.get(unit.id) ?? unit.baseNightlyThb) / 100,
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
