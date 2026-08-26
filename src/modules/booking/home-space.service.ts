import { PrismaClient } from '@prisma/client';
import { getConfig } from '@/modules/config';
import { listPublicServices, pickLocalizedServiceCopy } from '@/modules/services';
import { getProjectAnnouncements } from '@/modules/comms';
import { getRequestLocale } from '@/lib/i18n';

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
        slug: string;
        handbookKey: string | null;
      };
    };
    guest: { id: string; nationality: string | null } | null;
  };
  /** wa.me concierge deep link from project config (null = CTA hidden). */
  conciergeWhatsappUrl: string | null;
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
  /**
   * The services rail (doc 06 S6) — only what is actually orderable at this
   * stay's project, so the rail can never advertise a service the guest
   * cannot have.
   */
  services: Array<{
    id: string;
    title: string;
    categoryKey: string;
    basePriceThb: number | null;
    priceModel: string;
    providerName: string;
    isVetted: boolean;
  }>;
  /**
   * Roles this viewer holds on the stay's unit or project *besides* being its
   * guest. An owner sleeping in their own unit is the ordinary case (F-OWN-6):
   * the in-stay card is what they need, and `RoleContextBanner` keeps the
   * other hat legible instead of silently swapping their view.
   */
  secondaryRoles: string[];
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
          ownerIdentityId: true,
          project: {
            select: {
              id: true,
              name: true,
              slug: true,
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

  // Announcements this guest is actually an audience for.
  //
  // This used to be a raw `findMany` on project + published, which ignored the
  // `audience` field entirely: an announcement addressed to owners or to staff
  // appeared on a guest's home space, and an expired one never went away. The
  // comms module already knew how to do this correctly — the duplicate query
  // here simply did not ask it. `guests_in_stay` is passed explicitly because
  // this viewer's membership of that audience comes from having a stay in
  // progress, not from a role row.
  const visible = await getProjectAnnouncements(
    db,
    booking.unit.projectId,
    guestIdentityId,
    { alsoInclude: ['guests_in_stay'] }
  );
  const announcements = visible.slice(0, 5);

  // The rail is scoped to this stay's project by the services module itself,
  // so a guest is never shown a service another project's providers offer.
  const services = await listPublicServices(db, booking.unit.projectId);
  const locale = getRequestLocale();

  // Every other hat this viewer wears on this unit or project. Unit ownership
  // lives on the unit row rather than in RoleAssignment, so it is read
  // separately and merged.
  const roleAssignments = await db.roleAssignment.findMany({
    where: {
      identityId: guestIdentityId,
      status: 'active',
      OR: [{ unitId: booking.unit.id }, { projectId: booking.unit.projectId }],
    },
    select: { role: true },
  });

  const secondaryRoles = Array.from(
    new Set([
      ...(booking.unit.ownerIdentityId === guestIdentityId ? ['owner'] : []),
      ...roleAssignments.map((r) => r.role as string),
    ])
  ).filter((role) => role !== 'guest');

  // Concierge deep link from project config (LY-7); empty = hidden
  const whatsappNumber = await getConfig(db, 'comms.whatsapp_number', {
    projectId: booking.unit.projectId,
  });
  const conciergeWhatsappUrl = whatsappNumber
    ? `https://wa.me/${whatsappNumber.replace(/[^0-9]/g, '')}`
    : null;

  return {
    conciergeWhatsappUrl,
    secondaryRoles,
    services: services.map((s) => ({
      id: s.id,
      title: pickLocalizedServiceCopy(s, locale).title,
      categoryKey: s.categoryKey,
      basePriceThb: s.basePriceThb ?? null,
      priceModel: s.priceModel,
      providerName: s.provider?.name ?? '',
      isVetted: Boolean(s.isVetted),
    })),
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
