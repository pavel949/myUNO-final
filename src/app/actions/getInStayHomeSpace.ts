'use server';

import { prisma } from '@/lib/prisma';

export async function fetchInStayHomeSpace(bookingId: string, guestIdentityId: string) {
  try {
    // Fetch booking with stay details
    const booking = await prisma.booking.findUnique({
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

    if (booking.guestIdentityId !== guestIdentityId) {
      throw new Error('Access denied');
    }

    // Fetch active service orders for this booking
    const activeOrders = await prisma.serviceOrder.findMany({
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
    const announcements = await prisma.announcement.findMany({
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
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : 'Failed to fetch in-stay home space');
  }
}
