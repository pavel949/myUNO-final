import { PrismaClient, AnalyticsEventKey } from '@prisma/client';

export interface TrackDimensions {
  projectId?: string | null;
  unitId?: string | null;
  bookingId?: string | null;
  serviceOrderId?: string | null;
  identityId?: string | null;
  actorIdentityId?: string | null;
  [key: string]: string | number | boolean | null | undefined;
}

export async function track(
  db: PrismaClient,
  eventKey: AnalyticsEventKey,
  dimensions: TrackDimensions = {}
) {
  try {
    // Extract known dimensions. Null is a valid explicit value for global or
    // standalone activity that has no property/unit/booking context.
    const {
      projectId,
      unitId,
      bookingId,
      serviceOrderId,
      identityId,
      actorIdentityId,
      ...eventDimensions
    } = dimensions;

    // Create the event (append-only, no PII in payload per doc 12).
    await db.analyticsEvent.create({
      data: {
        eventKey,
        projectId: projectId ?? null,
        unitId: unitId ?? null,
        bookingId: bookingId ?? null,
        serviceOrderId: serviceOrderId ?? null,
        identityId: identityId ?? null,
        actorIdentityId: actorIdentityId ?? null,
        dimensions: eventDimensions as Record<string, any>,
      },
    });
  } catch (error) {
    // Analytics is derived and must not break the source-of-truth write path.
    console.error(`[Analytics] Failed to track ${eventKey}:`, error);
  }
}
