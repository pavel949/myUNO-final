import crypto from 'crypto';
import type { PrismaClient } from '@prisma/client';

export interface FederationEventInput {
  systemKey: string;
  environment: string;
  displayName?: string;
  eventId: string;
  aggregateType: string;
  aggregateExternalId: string;
  eventType: string;
  eventVersion?: number;
  occurredAt: Date;
  payload: Record<string, unknown>;
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const obj = value as Record<string, unknown>;
  return `{${Object.keys(obj).sort().map((k) => `${JSON.stringify(k)}:${canonicalJson(obj[k])}`).join(',')}}`;
}

function payloadHash(payload: Record<string, unknown>): string {
  return crypto.createHash('sha256').update(canonicalJson(payload)).digest('hex');
}

/**
 * F16 / AT25. Durable at-least-once ingest with exact event dedup and aggregate
 * checkpointing. Older versions are retained as evidence but never regress the
 * aggregate checkpoint. No downstream write happens here; project-specific
 * consumers read accepted inbox rows and apply idempotent projections/commands.
 */
export async function ingestFederationEvent(db: PrismaClient, input: FederationEventInput) {
  if (!input.systemKey || !input.environment || !input.eventId || !input.aggregateType || !input.aggregateExternalId || !input.eventType) {
    throw new Error('Incomplete federation event');
  }
  const hash = payloadHash(input.payload);

  return db.$transaction(async (tx) => {
    const system = await tx.externalSystem.upsert({
      where: { systemKey_environment: { systemKey: input.systemKey, environment: input.environment } },
      create: {
        systemKey: input.systemKey,
        environment: input.environment,
        displayName: input.displayName || input.systemKey,
        status: 'active',
      },
      update: input.displayName ? { displayName: input.displayName } : {},
    });

    const existing = await tx.externalEventInbox.findUnique({
      where: { externalSystemId_eventId: { externalSystemId: system.id, eventId: input.eventId } },
    });
    if (existing) {
      if (existing.payloadHash !== hash) {
        throw new Error('Federation event id was replayed with different payload');
      }
      return { status: 'duplicate' as const, inboxId: existing.id, systemId: system.id };
    }

    const checkpoint = await tx.externalAggregateCheckpoint.findUnique({
      where: {
        externalSystemId_aggregateType_aggregateExternalId: {
          externalSystemId: system.id,
          aggregateType: input.aggregateType,
          aggregateExternalId: input.aggregateExternalId,
        },
      },
    });

    const staleByVersion = input.eventVersion !== undefined && checkpoint?.lastEventVersion !== null && checkpoint?.lastEventVersion !== undefined
      ? BigInt(input.eventVersion) <= checkpoint.lastEventVersion
      : false;
    const staleByTime = input.eventVersion === undefined && checkpoint
      ? input.occurredAt <= checkpoint.lastOccurredAt
      : false;
    const stale = Boolean(staleByVersion || staleByTime);

    const inbox = await tx.externalEventInbox.create({
      data: {
        externalSystemId: system.id,
        eventId: input.eventId,
        aggregateType: input.aggregateType,
        aggregateExternalId: input.aggregateExternalId,
        eventType: input.eventType,
        eventVersion: input.eventVersion === undefined ? null : BigInt(input.eventVersion),
        occurredAt: input.occurredAt,
        payload: input.payload as any,
        payloadHash: hash,
        status: stale ? 'stale' : 'received',
      },
    });

    if (!stale) {
      await tx.externalAggregateCheckpoint.upsert({
        where: {
          externalSystemId_aggregateType_aggregateExternalId: {
            externalSystemId: system.id,
            aggregateType: input.aggregateType,
            aggregateExternalId: input.aggregateExternalId,
          },
        },
        create: {
          externalSystemId: system.id,
          aggregateType: input.aggregateType,
          aggregateExternalId: input.aggregateExternalId,
          lastEventId: input.eventId,
          lastEventVersion: input.eventVersion === undefined ? null : BigInt(input.eventVersion),
          lastOccurredAt: input.occurredAt,
        },
        update: {
          lastEventId: input.eventId,
          lastEventVersion: input.eventVersion === undefined ? null : BigInt(input.eventVersion),
          lastOccurredAt: input.occurredAt,
        },
      });
    }

    return { status: stale ? 'stale' as const : 'accepted' as const, inboxId: inbox.id, systemId: system.id };
  });
}

export async function upsertExternalMapping(db: PrismaClient, input: {
  externalSystemId: string;
  entityType: string;
  internalId: string;
  externalId: string;
  externalVersion?: number;
  metadata?: Record<string, unknown>;
}) {
  return db.externalMapping.upsert({
    where: {
      externalSystemId_entityType_externalId: {
        externalSystemId: input.externalSystemId,
        entityType: input.entityType,
        externalId: input.externalId,
      },
    },
    create: {
      externalSystemId: input.externalSystemId,
      entityType: input.entityType,
      internalId: input.internalId,
      externalId: input.externalId,
      externalVersion: input.externalVersion === undefined ? null : BigInt(input.externalVersion),
      lastSeenAt: new Date(),
      metadata: (input.metadata || {}) as any,
    },
    update: {
      internalId: input.internalId,
      externalVersion: input.externalVersion === undefined ? null : BigInt(input.externalVersion),
      lastSeenAt: new Date(),
      metadata: (input.metadata || {}) as any,
    },
  });
}

export async function markFederationEventProcessed(db: PrismaClient, inboxId: string) {
  return db.externalEventInbox.update({
    where: { id: inboxId },
    data: { status: 'processed', processedAt: new Date(), errorCode: null },
  });
}

export async function markFederationEventFailed(db: PrismaClient, inboxId: string, errorCode: string) {
  return db.externalEventInbox.update({
    where: { id: inboxId },
    data: { status: 'failed', errorCode: errorCode.slice(0, 100) },
  });
}
