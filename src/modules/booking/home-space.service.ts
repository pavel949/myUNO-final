import { PrismaClient } from '@prisma/client';

export interface InStayHomeSpaceData {
  booking: {
    id: string;
    startDate: string;
    endDate: string;
    status: string;
    checkedInAt: string | null;
    unit: {
      id: string;
      name: string;
      projectId: string;
      project: {
        id: string;
        name: string;
        handbookKey: string | null;
      };
    };
    guest: { id: string; nationality: string | null } | null;
  };
  activeOrders: Array<{
    id: string;
    serviceId: string;
    serviceName: string;
    status: string;
    totalThb: number;
    scheduledStart: string;
    scheduledEnd: string;
  }>;
  announcements: Array<{
    id: string;
    title: string;
    body: string;
    createdAt: string;
  }>;
}

/**
 * Get in-stay home space data: booking details, active service orders, announcements.
 * Accessible only to the booking's guest (guestIdentityId must match).
 */
export async function getInStayHomeSpace(
  db: PrismaClient,
  bookingId: string,
  guestIdentityId: string
): Promise<InStayHomeSpaceData> {
  const booking = await db.booking.findUnique({
    where: { id: bookingId },
    include: {
      unit: {
        select: {
          id: true,
          name: true,
          projectId: true,
          project: {
            select: {
              id: true,
              name: true,
              handbookKey: true,
            },
          },
        },
      },
      guests: {
        select: {
          id: true,
          nationality: true,
        },
        take: 1,
      },
    },
  });

  if (!booking) {
    throw new Error('Booking not found');
  }

  // Enforce guest ownership (D1: guest-ownership check)
  if (booking.guestIdentityId !== guestIdentityId) {
    throw new Error('Access denied');
  }

  // Fetch active service orders for this booking
  const activeOrders = await db.serviceOrder.findMany({
    where: {
      booking_id: bookingId,
      status: {
        in: ['placed', 'paid', 'accepted'],
      },
    },
    include: {
      service: {
        select: {
          id: true,
          title: true,
          description: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: 10,
  });

  // Fetch announcements for the project
  const announcements = await db.announcement.findMany({
    where: {
      projectId: booking.unit.projectId,
      status: 'published',
    },
    select: {
      id: true,
      title: true,
      body: true,
      createdAt: true,
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: 5,
  });

  return {
    booking: {
      id: booking.id,
      startDate: booking.startDate.toISOString(),
      endDate: booking.endDate.toISOString(),
      status: booking.status,
      checkedInAt: booking.checkedInAt?.toISOString() || null,
      unit: booking.unit,
      guest: booking.guests[0] || null,
    },
    activeOrders: activeOrders.map((order) => ({
      id: order.id,
      serviceId: order.service_id,
      serviceName: order.service.title,
      status: order.status,
      totalThb: order.total_thb,
      scheduledStart: order.scheduled_start.toISOString(),
      scheduledEnd: order.scheduled_end.toISOString(),
    })),
    announcements: announcements.map((a) => ({
      id: a.id,
      title: a.title,
      body: a.body,
      createdAt: a.createdAt.toISOString(),
    })),
  };
}
