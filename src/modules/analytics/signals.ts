import { PrismaClient, BuyerSignalKey, BuyerSignalStatus } from '@prisma/client';

const DEFAULT_REPEAT_STAY_THRESHOLD = 2;
const DEFAULT_LONG_STAY_NIGHTS = 28;

export async function detectBuyerSignals(db: PrismaClient) {
  // Detect repeat_stay signals
  await detectRepeatStaySignals(db);

  // Detect long_stay signals
  await detectLongStaySignals(db);

  // Detect listing_engagement signals (based on analytics events)
  // This runs after the AnalyticsEvent stream is populated
  await detectListingEngagementSignals(db);
}

async function detectRepeatStaySignals(db: PrismaClient) {
  // Find identities with ≥ threshold completed stays
  const repeatGuests = await db.bookingGuest.findMany({
    where: {
      booking: {
        status: 'completed',
      },
    },
    select: {
      identityId: true,
    },
    distinct: ['identityId'],
  });

  for (const guest of repeatGuests) {
    if (!guest.identityId) continue;

    const completedStays = await db.booking.count({
      where: {
        guestIdentityId: guest.identityId,
        status: 'completed',
      },
    });

    if (completedStays >= DEFAULT_REPEAT_STAY_THRESHOLD) {
      // Create or update signal
      const strength = completedStays >= 3 ? 3 : 2;

      await db.buyerSignal.upsert({
        where: {
          identityId_signalKey: {
            identityId: guest.identityId,
            signalKey: BuyerSignalKey.repeat_stay,
          },
        },
        update: {
          strength,
          status: BuyerSignalStatus.open,
          closedAt: null,
        },
        create: {
          identityId: guest.identityId,
          signalKey: BuyerSignalKey.repeat_stay,
          strength,
          status: BuyerSignalStatus.open,
        },
      });
    }
  }
}

async function detectLongStaySignals(db: PrismaClient) {
  // Find bookings ≥ long stay threshold
  const longStays = await db.booking.findMany({
    where: {
      status: 'completed',
    },
    select: {
      id: true,
      guestIdentityId: true,
      startDate: true,
      endDate: true,
    },
  });

  for (const stay of longStays) {
    const nights = Math.ceil(
      (new Date(stay.endDate).getTime() - new Date(stay.startDate).getTime()) /
        (1000 * 60 * 60 * 24)
    );

    if (nights >= DEFAULT_LONG_STAY_NIGHTS) {
      await db.buyerSignal.upsert({
        where: {
          identityId_signalKey: {
            identityId: stay.guestIdentityId,
            signalKey: BuyerSignalKey.long_stay,
          },
        },
        update: {
          status: BuyerSignalStatus.open,
          closedAt: null,
        },
        create: {
          identityId: stay.guestIdentityId,
          signalKey: BuyerSignalKey.long_stay,
          strength: 2,
          status: BuyerSignalStatus.open,
        },
      });
    }
  }
}

async function detectListingEngagementSignals(db: PrismaClient) {
  // Find identities with ≥3 page.unit_viewed events in 30 days
  // (this would typically run after analytics events are populated)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const engagementEvents = await db.analyticsEvent.findMany({
    where: {
      eventKey: 'page_unit_viewed',
      occurredAt: {
        gte: thirtyDaysAgo,
      },
      identityId: {
        not: null,
      },
    },
    select: {
      identityId: true,
      unitId: true,
    },
  });

  // Group by identity and count unique units viewed
  const engagementMap = new Map<string, Set<string>>();
  for (const event of engagementEvents) {
    if (!event.identityId || !event.unitId) continue;

    if (!engagementMap.has(event.identityId)) {
      engagementMap.set(event.identityId, new Set());
    }
    engagementMap.get(event.identityId)!.add(event.unitId);
  }

  // Create signals for identities with ≥3 unit views
  for (const [identityId, units] of engagementMap) {
    if (units.size >= 3) {
      await db.buyerSignal.upsert({
        where: {
          identityId_signalKey: {
            identityId,
            signalKey: BuyerSignalKey.listing_engagement,
          },
        },
        update: {
          status: BuyerSignalStatus.open,
          closedAt: null,
        },
        create: {
          identityId,
          signalKey: BuyerSignalKey.listing_engagement,
          strength: 1,
          status: BuyerSignalStatus.open,
        },
      });
    }
  }
}
