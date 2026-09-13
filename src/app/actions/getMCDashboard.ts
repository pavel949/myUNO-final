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

    const unitIds = (unitsRaw as any[]).map((unit) => unit.id);
    const canonicalRows = unitIds.length
      ? await prisma.unit.findMany({
          where: { id: { in: unitIds } },
          select: {
            id: true,
            inventoryCategory: {
              select: {
                id: true,
                categoryKey: true,
                name: true,
                baseNightlyThb: true,
                minNights: true,
                ratePlans: {
                  where: { status: 'active', code: 'BAR' },
                  take: 1,
                  select: { code: true, minNights: true },
                },
              },
            },
          },
        })
      : [];
    const canonicalByUnit = new Map(canonicalRows.map((row) => [row.id, row.inventoryCategory]));

    const units = (unitsRaw as any[]).map((unit) => {
      const category = canonicalByUnit.get(unit.id);
      return {
        ...unit,
        // Keep the client field for compatibility, but derive it from the
        // canonical sellable category rather than Unit.baseNightlyThb.
        baseNightlyThb: (category?.baseNightlyThb ?? unit.baseNightlyThb) / 100,
        inventoryCategory: category
          ? {
              id: category.id,
              categoryKey: category.categoryKey,
              name: category.name,
              minNights: category.ratePlans[0]?.minNights ?? category.minNights,
              ratePlanCode: category.ratePlans[0]?.code ?? 'BAR',
            }
          : null,
      };
    });

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

    return { dashboard, units, bookings, tickets, serviceOrders };
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : 'Failed to fetch MC dashboard');
  }
}
