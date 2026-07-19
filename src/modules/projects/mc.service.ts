import { PrismaClient } from '@prisma/client';
import { getConfig } from '@/modules/config';

/**
 * Get all units managed by an MC member.
 * Filters to units where:
 * - Engagement type is via_management_company
 * - Management org ID matches the MC member's organization
 * - Engagement status is active
 */
export async function getMCManagedUnits(
  db: PrismaClient,
  mcIdentityId: string,
  projectId: string,
  organizationId: string
) {
  // Verify the identity has mc_member role for this project + org
  const roleAssignment = await db.roleAssignment.findFirst({
    where: {
      identityId: mcIdentityId,
      role: 'mc_member',
      projectId,
      organizationId,
      status: 'active',
    },
  });

  if (!roleAssignment) {
    throw new Error('MC member does not have access to this project/organization');
  }

  // Get units managed by this organization in this project
  const units = await db.unit.findMany({
    where: {
      projectId,
      engagements: {
        some: {
          engagementType: 'via_management_company',
          managementOrgId: organizationId,
          status: 'active',
        },
      },
    },
    select: {
      id: true,
      name: true,
      projectId: true,
      descriptionKey: true,
      baseNightlyThb: true,
      status: true,
      engagements: {
        where: { status: 'active' },
        select: {
          id: true,
          engagementType: true,
          feeOverridePct: true,
        },
        take: 1,
      },
    },
    orderBy: {
      name: 'asc',
    },
  });

  return units;
}

/**
 * Get bookings for MC-managed units in a project.
 * Only returns bookings for units the MC actually manages.
 */
export async function getMCBookings(
  db: PrismaClient,
  mcIdentityId: string,
  projectId: string,
  organizationId: string,
  limit: number = 50,
  offset: number = 0
) {
  // Verify access
  const roleAssignment = await db.roleAssignment.findFirst({
    where: {
      identityId: mcIdentityId,
      role: 'mc_member',
      projectId,
      organizationId,
      status: 'active',
    },
  });

  if (!roleAssignment) {
    throw new Error('MC member does not have access to this project/organization');
  }

  // Get unit IDs managed by this MC
  const managedUnitIds = await db.unit.findMany({
    where: {
      projectId,
      engagements: {
        some: {
          engagementType: 'via_management_company',
          managementOrgId: organizationId,
          status: 'active',
        },
      },
    },
    select: {
      id: true,
    },
  });

  const unitIds = managedUnitIds.map((u) => u.id);

  // Get bookings for these units
  const bookings = await db.booking.findMany({
    where: {
      unitId: {
        in: unitIds,
      },
      status: {
        in: ['pending_payment', 'confirmed', 'checked_in', 'checked_out'],
      },
    },
    select: {
      id: true,
      startDate: true,
      endDate: true,
      totalThb: true,
      status: true,
      guestIdentity: {
        select: {
          id: true,
          firstName: true,
        },
      },
      unit: {
        select: {
          id: true,
          name: true,
        },
      },
      guests: {
        select: {
          nationality: true,
        },
        take: 1,
      },
    },
    orderBy: {
      startDate: 'desc',
    },
    skip: offset,
    take: limit,
  });

  return bookings;
}

/**
 * Get tickets for MC-managed units in a project.
 */
export async function getMCTickets(
  db: PrismaClient,
  mcIdentityId: string,
  projectId: string,
  organizationId: string,
  limit: number = 50,
  offset: number = 0
) {
  // Verify access
  const roleAssignment = await db.roleAssignment.findFirst({
    where: {
      identityId: mcIdentityId,
      role: 'mc_member',
      projectId,
      organizationId,
      status: 'active',
    },
  });

  if (!roleAssignment) {
    throw new Error('MC member does not have access to this project/organization');
  }

  // Get unit IDs managed by this MC
  const managedUnitIds = await db.unit.findMany({
    where: {
      projectId,
      engagements: {
        some: {
          engagementType: 'via_management_company',
          managementOrgId: organizationId,
          status: 'active',
        },
      },
    },
    select: {
      id: true,
    },
  });

  const unitIds = managedUnitIds.map((u) => u.id);

  // Get tickets for these units
  const tickets = await db.ticket.findMany({
    where: {
      unitId: {
        in: unitIds,
      },
      status: {
        not: 'closed',
      },
    },
    select: {
      id: true,
      title: true,
      description: true,
      status: true,
      priority: true,
      createdAt: true,
      updatedAt: true,
      raisedBy: {
        select: {
          id: true,
          firstName: true,
        },
      },
      unit: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
    skip: offset,
    take: limit,
  });

  return tickets;
}

/**
 * Get MC dashboard overview: units count, bookings count, open tickets count.
 */
export async function getMCDashboard(
  db: PrismaClient,
  mcIdentityId: string,
  projectId: string,
  organizationId: string
) {
  // Verify access
  const roleAssignment = await db.roleAssignment.findFirst({
    where: {
      identityId: mcIdentityId,
      role: 'mc_member',
      projectId,
      organizationId,
      status: 'active',
    },
  });

  if (!roleAssignment) {
    throw new Error('MC member does not have access to this project/organization');
  }

  // Get managed units
  const units = await getMCManagedUnits(db, mcIdentityId, projectId, organizationId);

  // Count bookings this month
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  const countBookings = (from: Date, to: Date) =>
    db.booking.count({
      where: {
        unitId: {
          in: units.map((u) => u.id),
        },
        startDate: {
          lt: to,
        },
        endDate: {
          gt: from,
        },
        status: {
          in: ['confirmed', 'checked_in', 'checked_out'],
        },
      },
    });

  const [monthBookings, prevMonthBookings] = await Promise.all([
    countBookings(monthStart, monthEnd),
    countBookings(prevMonthStart, monthStart),
  ]);

  // Count open tickets
  const openTickets = await db.ticket.count({
    where: {
      unitId: {
        in: units.map((u) => u.id),
      },
      status: {
        not: 'closed',
      },
    },
  });

  return {
    identityId: mcIdentityId,
    projectId,
    organizationId,
    unitsCount: units.length,
    bookingsThisMonth: monthBookings,
    bookingsPrevMonth: prevMonthBookings,
    openTicketsCount: openTickets,
  };
}

/**
 * Get fee report for the MC: platform fees charged per period.
 * Groups by booking/service order and shows the MC's fee share.
 */
export async function getMCFeeReport(
  db: PrismaClient,
  mcIdentityId: string,
  projectId: string,
  organizationId: string,
  periodStart: Date,
  periodEnd: Date
) {
  // Verify access
  const roleAssignment = await db.roleAssignment.findFirst({
    where: {
      identityId: mcIdentityId,
      role: 'mc_member',
      projectId,
      organizationId,
      status: 'active',
    },
  });

  if (!roleAssignment) {
    throw new Error('MC member does not have access to this project/organization');
  }

  // Get managed units
  const units = await getMCManagedUnits(db, mcIdentityId, projectId, organizationId);
  const unitIds = units.map((u) => u.id);

  // Get booking revenue in period for these units
  const bookings = await db.booking.findMany({
    where: {
      unitId: { in: unitIds },
      status: { in: ['confirmed', 'checked_out'] },
      startDate: { lt: periodEnd },
      endDate: { gt: periodStart },
    },
    select: {
      id: true,
      totalThb: true,
      startDate: true,
      unit: {
        select: {
          name: true,
          engagements: {
            where: { status: 'active' },
            select: {
              feeOverridePct: true,
            },
            take: 1,
          },
        },
      },
    },
  });

  // Get service order revenue in period
  const serviceOrders = await db.serviceOrder.findMany({
    where: {
      unit_id: { in: unitIds },
      status: { in: ['fulfilled', 'closed'] },
      createdAt: {
        gte: periodStart,
        lt: periodEnd,
      },
    },
    select: {
      id: true,
      total_thb: true,
      createdAt: true,
      unit: {
        select: {
          name: true,
          engagements: {
            where: { status: 'active' },
            select: {
              feeOverridePct: true,
            },
            take: 1,
          },
        },
      },
    },
  });

  // Calculate platform fee lines
  const feeLines: Array<{
    id: string;
    type: 'booking_platform_fee' | 'service_platform_fee';
    description: string;
    unitName: string | null;
    grossAmount: number;
    feePercentage: number;
    feeAmount: number;
    date: Date;
  }> = [];

  for (const booking of bookings) {
    const feeOverride = booking.unit.engagements[0]?.feeOverridePct;
    const configDefault = await getConfig(db, 'engagement.via_mc.platform_fee_pct', {
      projectId,
    });
    const feePct = feeOverride ? Number(feeOverride) : (configDefault ?? 12);

    feeLines.push({
      id: `booking-${booking.id}`,
      type: 'booking_platform_fee' as const,
      description: `Platform fee for ${booking.unit.name}`,
      unitName: booking.unit.name,
      grossAmount: booking.totalThb,
      feePercentage: feePct,
      feeAmount: Math.round(booking.totalThb * (feePct / 100)),
      date: booking.startDate,
    });
  }

  for (const order of serviceOrders) {
    // Skip orders without a unit (common area orders don't charge platform fee)
    if (!order.unit) continue;

    const feeOverride = order.unit.engagements[0]?.feeOverridePct;
    const configDefault = await getConfig(db, 'services.take_rate_pct', {
      projectId,
    });
    const feePct = feeOverride ? Number(feeOverride) : (configDefault ?? 15);

    feeLines.push({
      id: `service-${order.id}`,
      type: 'service_platform_fee' as const,
      description: `Platform fee for service order`,
      unitName: order.unit.name,
      grossAmount: order.total_thb,
      feePercentage: feePct,
      feeAmount: Math.round(order.total_thb * (feePct / 100)),
      date: order.createdAt,
    });
  }

  // Sort by date
  feeLines.sort((a, b) => b.date.getTime() - a.date.getTime());

  // Calculate totals
  const grossTotal = feeLines.reduce((sum, line) => sum + line.grossAmount, 0);
  const feeTotal = feeLines.reduce((sum, line) => sum + line.feeAmount, 0);

  return {
    organizationId,
    periodStart,
    periodEnd,
    feeLines,
    summaryThb: {
      grossAmount: grossTotal,
      platformFeeAmount: feeTotal,
    },
  };
}
