import { PrismaClient, BuyerSignalKey, BuyerSignalStatus } from '@prisma/client';

// Fallback defaults; thresholds should be read from config in production
const DEFAULT_REPEAT_STAY_THRESHOLD = 2;
const DEFAULT_LONG_STAY_NIGHTS = 28;
const DEFAULT_LISTING_ENGAGEMENT_VIEW_COUNT = 3;

/**
 * Detect buyer signals from completed stays, long stays, and engagement patterns.
 * Each signal creation is audit-logged per doc 13 §4.
 */
export async function detectBuyerSignals(
  db: PrismaClient,
  auditActorIdentityId?: string
) {
  await detectRepeatStaySignals(db, auditActorIdentityId);
  await detectLongStaySignals(db, auditActorIdentityId);
  await detectListingEngagementSignals(db, auditActorIdentityId);
}

/**
 * Detect repeat_stay signals for identities with ≥threshold completed stays.
 * Audit-logs the signal creation/update.
 */
async function detectRepeatStaySignals(
  db: PrismaClient,
  auditActorIdentityId?: string
) {
  // Candidates are the booking guest identities themselves (doc 13 §4):
  // completed stays counted per guestIdentityId, not per registered
  // BookingGuest row (which would miss guests who never filed passports).
  const repeatGuests = await db.booking.groupBy({
    by: ['guestIdentityId'],
    where: { status: 'completed' },
    _count: { _all: true },
  });

  for (const guest of repeatGuests) {
    if (!guest.guestIdentityId) continue;
    const completedStays = guest._count._all;

    if (completedStays >= DEFAULT_REPEAT_STAY_THRESHOLD) {
      const strength = completedStays >= 3 ? 3 : 2;
      const signal = await db.buyerSignal.upsert({
        where: {
          identityId_signalKey: {
            identityId: guest.guestIdentityId,
            signalKey: BuyerSignalKey.repeat_stay,
          },
        },
        update: {
          strength,
          status: BuyerSignalStatus.open,
          closedAt: null,
        },
        create: {
          identityId: guest.guestIdentityId,
          signalKey: BuyerSignalKey.repeat_stay,
          strength,
          status: BuyerSignalStatus.open,
        },
      });

      // Audit log the signal (use a generic actor if none provided)
      if (auditActorIdentityId) {
        await db.auditLog.create({
          data: {
            actorIdentityId: auditActorIdentityId,
            action: 'signal_detected',
            entityType: 'buyer_signal',
            entityId: signal.id,
            data: {
              signalKey: BuyerSignalKey.repeat_stay,
              strength,
              completedStays,
            },
          },
        });
      }
    }
  }
}

/**
 * Detect long_stay signals for stays ≥ threshold nights.
 * Audit-logs the signal creation/update.
 */
async function detectLongStaySignals(
  db: PrismaClient,
  auditActorIdentityId?: string
) {
  const longStays = await db.booking.findMany({
    where: { status: 'completed' },
    select: { id: true, guestIdentityId: true, startDate: true, endDate: true },
  });

  for (const stay of longStays) {
    const nights = Math.ceil(
      (new Date(stay.endDate).getTime() - new Date(stay.startDate).getTime()) /
        (1000 * 60 * 60 * 24)
    );

    if (nights >= DEFAULT_LONG_STAY_NIGHTS) {
      const signal = await db.buyerSignal.upsert({
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

      if (auditActorIdentityId) {
        await db.auditLog.create({
          data: {
            actorIdentityId: auditActorIdentityId,
            action: 'signal_detected',
            entityType: 'buyer_signal',
            entityId: signal.id,
            data: {
              signalKey: BuyerSignalKey.long_stay,
              nights,
              bookingId: stay.id,
            },
          },
        });
      }
    }
  }
}

/**
 * Detect listing_engagement signals for identities viewing ≥ threshold units in 30 days.
 * Audit-logs the signal creation/update.
 */
async function detectListingEngagementSignals(
  db: PrismaClient,
  auditActorIdentityId?: string
) {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const engagementEvents = await db.analyticsEvent.findMany({
    where: {
      eventKey: 'page_unit_viewed',
      occurredAt: { gte: thirtyDaysAgo },
      identityId: { not: null },
    },
    select: { identityId: true, unitId: true },
  });

  const engagementMap = new Map<string, Set<string>>();
  for (const event of engagementEvents) {
    if (!event.identityId || !event.unitId) continue;
    if (!engagementMap.has(event.identityId)) {
      engagementMap.set(event.identityId, new Set());
    }
    engagementMap.get(event.identityId)!.add(event.unitId);
  }

  for (const [identityId, units] of engagementMap) {
    if (units.size >= DEFAULT_LISTING_ENGAGEMENT_VIEW_COUNT) {
      const signal = await db.buyerSignal.upsert({
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

      if (auditActorIdentityId) {
        await db.auditLog.create({
          data: {
            actorIdentityId: auditActorIdentityId,
            action: 'signal_detected',
            entityType: 'buyer_signal',
            entityId: signal.id,
            data: {
              signalKey: BuyerSignalKey.listing_engagement,
              uniqueUnitsViewed: units.size,
            },
          },
        });
      }
    }
  }
}

/**
 * Record signal transition (reviewed, handed_to_capital, dismissed) with audit log.
 */
export async function transitionBuyerSignal(
  db: PrismaClient,
  signalId: string,
  newStatus: BuyerSignalStatus,
  transitionByIdentityId: string,
  notes?: string
) {
  const signal = await db.buyerSignal.update({
    where: { id: signalId },
    data: {
      status: newStatus,
      reviewedByIdentityId: transitionByIdentityId,
      notes,
      ...(newStatus !== BuyerSignalStatus.open && { closedAt: new Date() }),
    },
  });

  // Audit log the transition
  await db.auditLog.create({
    data: {
      actorIdentityId: transitionByIdentityId,
      action: 'signal_transitioned',
      entityType: 'buyer_signal',
      entityId: signal.id,
      data: {
        fromStatus: signal.status,
        toStatus: newStatus,
        notes,
      },
    },
  });

  return signal;
}

/**
 * Create or update a staff-flagged purchase_question signal.
 * Called when staff flag a message as indicating purchase interest.
 */
export async function flagPurchaseQuestion(
  db: PrismaClient,
  identityId: string,
  flaggedByIdentityId: string,
  notes?: string
) {
  const signal = await db.buyerSignal.upsert({
    where: {
      identityId_signalKey: {
        identityId,
        signalKey: BuyerSignalKey.purchase_question,
      },
    },
    update: {
      status: BuyerSignalStatus.open,
      closedAt: null,
    },
    create: {
      identityId,
      signalKey: BuyerSignalKey.purchase_question,
      strength: 3,
      status: BuyerSignalStatus.open,
    },
  });

  // Audit log the flag
  await db.auditLog.create({
    data: {
      actorIdentityId: flaggedByIdentityId,
      action: 'signal_detected',
      entityType: 'buyer_signal',
      entityId: signal.id,
      data: {
        signalKey: BuyerSignalKey.purchase_question,
        strength: 3,
        flagReason: notes,
      },
    },
  });

  return signal;
}

/**
 * Create or update a direct_inquiry signal for owner sell-interest.
 * Called when an owner indicates intent to sell or when a buyer lead is submitted.
 */
export async function createDirectInquiry(
  db: PrismaClient,
  identityId: string,
  recordedByIdentityId?: string,
  notes?: string
) {
  const signal = await db.buyerSignal.upsert({
    where: {
      identityId_signalKey: {
        identityId,
        signalKey: BuyerSignalKey.direct_inquiry,
      },
    },
    update: {
      status: BuyerSignalStatus.open,
      closedAt: null,
    },
    create: {
      identityId,
      signalKey: BuyerSignalKey.direct_inquiry,
      strength: 3,
      status: BuyerSignalStatus.open,
    },
  });

  // Audit log the inquiry
  if (recordedByIdentityId) {
    await db.auditLog.create({
      data: {
        actorIdentityId: recordedByIdentityId,
        action: 'signal_detected',
        entityType: 'buyer_signal',
        entityId: signal.id,
        data: {
          signalKey: BuyerSignalKey.direct_inquiry,
          strength: 3,
          inquirySource: notes,
        },
      },
    });
  }

  return signal;
}
