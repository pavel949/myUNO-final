import type { PrismaClient } from '@prisma/client';
import { checkAvailability } from '@/modules/core';

export type AvailabilityConfidence = 'live' | 'synced' | 'request' | 'stale' | 'blocked';
export type DistributionBookingMode =
  | 'instant'
  | 'request'
  | 'operator_approval'
  | 'partner_approval'
  | 'not_agent_bookable';

export interface ResolvedDistributionPolicy {
  offeringId: string;
  inventorySource: 'managed' | 'partner';
  availabilityMode: 'live' | 'synced' | 'request';
  bookingMode: DistributionBookingMode;
  agentDistributionEnabled: boolean;
  directDistributionEnabled: boolean;
  otaDistributionEnabled: boolean;
  allowAgentMarkup: boolean;
  maxAgentMarkupBps: number | null;
  defaultAgentCommissionBps: number;
  confirmationSlaMinutes: number | null;
  staleAfterMinutes: number;
  supplyOrganizationId: string | null;
  explicit: boolean;
}

export async function resolveDistributionPolicy(
  db: PrismaClient,
  offeringId: string,
): Promise<ResolvedDistributionPolicy> {
  const offering = await db.commercialOffering.findUnique({
    where: { id: offeringId },
    select: {
      id: true,
      status: true,
      unit: { select: { instantBook: true } },
      distributionPolicy: true,
    },
  });
  if (!offering || offering.status !== 'active') throw new Error('DISTRIBUTION_OFFERING_NOT_ACTIVE');
  const p = offering.distributionPolicy;
  if (!p) {
    return {
      offeringId: offering.id,
      inventorySource: 'managed',
      availabilityMode: 'live',
      bookingMode: offering.unit?.instantBook ? 'instant' : 'request',
      agentDistributionEnabled: true,
      directDistributionEnabled: true,
      otaDistributionEnabled: false,
      allowAgentMarkup: true,
      maxAgentMarkupBps: null,
      defaultAgentCommissionBps: 1000,
      confirmationSlaMinutes: null,
      staleAfterMinutes: 120,
      supplyOrganizationId: null,
      explicit: false,
    };
  }
  return {
    offeringId: p.offeringId,
    inventorySource: p.inventorySource as 'managed' | 'partner',
    availabilityMode: p.availabilityMode as 'live' | 'synced' | 'request',
    bookingMode: p.bookingMode as DistributionBookingMode,
    agentDistributionEnabled: p.agentDistributionEnabled,
    directDistributionEnabled: p.directDistributionEnabled,
    otaDistributionEnabled: p.otaDistributionEnabled,
    allowAgentMarkup: p.allowAgentMarkup,
    maxAgentMarkupBps: p.maxAgentMarkupBps,
    defaultAgentCommissionBps: p.defaultAgentCommissionBps,
    confirmationSlaMinutes: p.confirmationSlaMinutes,
    staleAfterMinutes: p.staleAfterMinutes ?? 120,
    supplyOrganizationId: p.supplyOrganizationId,
    explicit: true,
  };
}

export async function resolveAvailabilityConfidence(
  db: PrismaClient,
  input: {
    offeringId: string;
    unitId: string;
    startDate: Date;
    endDate: Date;
    now?: Date;
  },
): Promise<AvailabilityConfidence> {
  const now = input.now ?? new Date();
  const policy = await resolveDistributionPolicy(db, input.offeringId);

  if (!policy.agentDistributionEnabled || policy.bookingMode === 'not_agent_bookable') return 'blocked';
  if (policy.availabilityMode === 'request') return 'request';

  const available = await checkAvailability(db, input.unitId, input.startDate, input.endDate);
  if (!available) return 'blocked';
  if (policy.availabilityMode === 'live') return 'live';

  const mappings = await db.channelMapping.findMany({
    where: { offeringId: input.offeringId },
    select: { syncState: true, lastSyncAt: true, syncErrors: true },
  });
  if (mappings.some((mapping) =>
    mapping.syncState === 'error' ||
    (Array.isArray(mapping.syncErrors) && mapping.syncErrors.length > 0)
  )) return 'stale';

  const latest = mappings.map((m) => m.lastSyncAt)
    .filter((value): value is Date => value instanceof Date)
    .sort((a,b) => b.getTime()-a.getTime())[0];
  if (!latest) return 'stale';

  const ageMinutes = (now.getTime()-latest.getTime())/60000;
  return ageMinutes > policy.staleAfterMinutes ? 'stale' : 'synced';
}

export async function upsertDistributionPolicy(
  db: PrismaClient,
  input: {
    offeringId: string;
    supplyOrganizationId?: string | null;
    inventorySource: 'managed' | 'partner';
    availabilityMode: 'live' | 'synced' | 'request';
    bookingMode: DistributionBookingMode;
    agentDistributionEnabled: boolean;
    directDistributionEnabled: boolean;
    otaDistributionEnabled: boolean;
    allowAgentMarkup: boolean;
    maxAgentMarkupBps?: number | null;
    defaultAgentCommissionBps: number;
    confirmationSlaMinutes?: number | null;
    staleAfterMinutes?: number | null;
    notes?: string | null;
  },
) {
  if (input.defaultAgentCommissionBps < 0) throw new Error('COMMISSION_BPS_INVALID');
  if ((input.maxAgentMarkupBps ?? 0) < 0) throw new Error('MARKUP_BPS_INVALID');
  if (input.inventorySource === 'partner' && !input.supplyOrganizationId) {
    throw new Error('PARTNER_SUPPLY_ORGANIZATION_REQUIRED');
  }
  if (input.availabilityMode === 'request' && input.bookingMode === 'instant') {
    throw new Error('REQUEST_AVAILABILITY_CANNOT_INSTANT_BOOK');
  }
  const data = {
    supplyOrganizationId: input.supplyOrganizationId ?? null,
    inventorySource: input.inventorySource,
    availabilityMode: input.availabilityMode,
    bookingMode: input.bookingMode,
    agentDistributionEnabled: input.agentDistributionEnabled,
    directDistributionEnabled: input.directDistributionEnabled,
    otaDistributionEnabled: input.otaDistributionEnabled,
    allowAgentMarkup: input.allowAgentMarkup,
    maxAgentMarkupBps: input.maxAgentMarkupBps ?? null,
    defaultAgentCommissionBps: input.defaultAgentCommissionBps,
    confirmationSlaMinutes: input.confirmationSlaMinutes ?? null,
    staleAfterMinutes: input.staleAfterMinutes ?? null,
    notes: input.notes ?? null,
  };
  return db.offeringDistributionPolicy.upsert({
    where: { offeringId: input.offeringId },
    create: { offeringId: input.offeringId, ...data },
    update: data,
  });
}
