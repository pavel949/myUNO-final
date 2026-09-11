import { PrismaClient, AnalyticsEventKey } from '@prisma/client';

export interface TrackDimensions {
  projectId?: string;
  unitId?: string;
  bookingId?: string;
  serviceOrderId?: string;
  identityId?: string;
  actorIdentityId?: string;
  [key: string]: string | number | boolean | null | undefined;
}

export async function track(
  db: PrismaClient,
  eventKey: AnalyticsEventKey,
  dimensions: TrackDimensions = {}
) {
  try {
    // Extract known dimensions
    const {
      projectId,
      unitId,
      bookingId,
      serviceOrderId,
      identityId,
      actorIdentityId,
      ...eventDimensions
    } = dimensions;

    // Create the event (append-only, no PII in payload per doc 12)
    await db.analyticsEvent.create({
      data: {
        eventKey,
        projectId: projectId || null,
        unitId: unitId || null,
        bookingId: bookingId || null,
        serviceOrderId: serviceOrderId || null,
        identityId: identityId || null,
        actorIdentityId: actorIdentityId || null,
        dimensions: eventDimensions as Record<string, any>,
      },
    });
  } catch (error) {
    // Log but don't throw — analytics failures should never break the main flow
    console.error(`[Analytics] Failed to track ${eventKey}:`, error);
  }
}
