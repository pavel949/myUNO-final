import { PrismaClient } from '@prisma/client';
import { getConfig } from '@/modules/config';
import { listPublicServices, pickLocalizedServiceCopy } from '@/modules/services';
import { getProjectAnnouncements } from '@/modules/comms';
import { getRequestLocale } from '@/lib/i18n';
import { decrypt } from '@/lib/encryption';

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
    adults: number;
    children: number;
    balanceDueThb: number;
  };
  /** True only when at least one TM30 for this stay has been filed. */
  tm30Filed: boolean;
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
    hasRating?: boolean;
    rating?: number;
  }>;
  announcements: Array<{
    id: string;
    title: string;
    body: string;
    createdAt: string;
    postedAs: string;
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
  /**
   * Private arrival details. Null until the booking is eligible for release.
   * Secrets are decrypted only after guest ownership + verification + time
   * checks have passed.
   */
  arrivalGuide: {
    checkInMethod: string;
    entryCode: string;
    lockboxLocation: string;
    lockboxCode: string;
    wifiSsid: string;
    wifiPassword: string;
    parkingInstructions: string;
    arrivalNotes: string;
    emergencyContact: string;
  } | null;
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
      tm30Filings: {
        select: { status: true },
      },
      accessInstruction: {
        select: { ciphertext: true },
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

  // Fetch active and completed service orders for this booking
  // Active: placed, paid, accepted
  // Completed: fulfilled (eligible for rating)
  const activeOrders = await db.serviceOrder.findMany({
    where: {
      booking_id: bookingId,
      status: {
        in: ['placed', 'paid', 'accepted', 'fulfilled'],
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

  // For each fulfilled order, check if it has a rating
  const orderIds = activeOrders.map((o) => o.id);
  const reviews = await db.review.findMany({
    where: {
      target_type: 'service_order',
      target_id: {
        in: orderIds,
      },
      author_identity_id: guestIdentityId,
    },
    select: {
      target_id: true,
      rating: true,
    },
  });

  const reviewMap = new Map(reviews.map((r) => [r.target_id, r]));

  const activeOrdersWithRatings = activeOrders.map((order) => {
    const review = reviewMap.get(order.id);
    return {
      id: order.id,
      serviceId: order.service_id,
      serviceName: order.service.title,
      status: order.status,
      totalThb: order.total_thb,
      scheduledStart: order.scheduled_start.toISOString(),
      scheduledEnd: order.scheduled_end.toISOString(),
      hasRating: !!review,
      rating: review?.rating,
    };
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

  // Arrival secrets are intentionally not part of the public unit/listing
  // projection. Release them only to the booking guest, after verification,
  // inside the configured pre-arrival window (or once checked in).
  const verificationComplete =
    booking.verificationStatus === 'passports_received' ||
    booking.verificationStatus === 'not_required';
  const releaseHours =
    (await getConfig(db, 'compliance.passport_required_hours_before_checkin', {
      projectId: booking.unit.projectId,
    })) ?? 24;
  const releaseAt = new Date(
    booking.startDate.getTime() - Number(releaseHours) * 60 * 60 * 1000
  );
  const canReleaseArrivalGuide =
    booking.status === 'checked_in' ||
    (booking.status === 'confirmed' && verificationComplete && new Date() >= releaseAt);

  let arrivalGuide: InStayHomeSpaceData['arrivalGuide'] = null;
  if (canReleaseArrivalGuide && booking.accessInstruction?.ciphertext) {
    try {
      const decoded = JSON.parse(decrypt(booking.accessInstruction.ciphertext)) as Record<string, unknown>;
      const text = (key: string, legacyKey?: string) => {
        const value = decoded[key] ?? (legacyKey ? decoded[legacyKey] : undefined);
        return typeof value === 'string' ? value : '';
      };
      arrivalGuide = {
        checkInMethod: text('checkInMethod'),
        entryCode: text('entryCode'),
        lockboxLocation: text('lockboxLocation'),
        lockboxCode: text('lockboxCode'),
        wifiSsid: text('wifiSsid'),
        wifiPassword: text('wifiPassword'),
        parkingInstructions: text('parkingInstructions'),
        arrivalNotes: text('arrivalNotes', 'handoverNotes'),
        emergencyContact: text('emergencyContact'),
      };
    } catch {
      // Never log decrypted arrival secrets or the ciphertext. A malformed
      // legacy record simply remains unavailable until an operator resaves it.
      arrivalGuide = null;
    }
  }

  return {
    conciergeWhatsappUrl,
    secondaryRoles,
    arrivalGuide,
    services: services.map((s) => ({
      id: s.id,
      title: pickLocalizedServiceCopy(s, locale).title,
      categoryKey: s.categoryKey,
      basePriceThb: s.basePriceThb ?? null,
      priceModel: s.priceModel,
      providerName: s.provider?.name ?? '',
      isVetted: Boolean(s.isVetted),
    })),
    tm30Filed: booking.tm30Filings.some((filing) => filing.status === 'filed'),
    booking: {
      id: booking.id,
      startDate: booking.startDate.toISOString(),
      endDate: booking.endDate.toISOString(),
      status: booking.status,
      checkedInAt: booking.checkedInAt?.toISOString() || null,
      unit: booking.unit,
      guest: booking.guests[0] || null,
      adults: booking.adults,
      children: booking.children,
      balanceDueThb: booking.balanceDueThb,
    },
    activeOrders: activeOrdersWithRatings,
    announcements: announcements.map((a) => ({
      id: a.id,
      title: a.title,
      body: a.body,
      createdAt: a.createdAt.toISOString(),
      postedAs: a.postedAs,
    })),
  };
}
