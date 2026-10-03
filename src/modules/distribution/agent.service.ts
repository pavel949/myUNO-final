import { randomUUID } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import { checkAvailability, computePriceBreakdown } from '@/modules/core';

export interface AgentContext {
  identityId: string;
  agencyOrganizationId: string | null;
}

export async function getAgentContext(
  db: PrismaClient,
  identityId: string,
): Promise<AgentContext | null> {
  const role = await db.roleAssignment.findFirst({
    where: {
      identityId,
      role: 'agent_member',
      status: 'active',
    },
    select: {
      identityId: true,
      organizationId: true,
    },
    orderBy: { createdAt: 'asc' },
  });
  if (!role) return null;
  return {
    identityId: role.identityId,
    agencyOrganizationId: role.organizationId,
  };
}

export async function registerProtectedClient(
  db: PrismaClient,
  context: AgentContext,
  input: {
    clientName: string;
    clientPhone?: string | null;
    clientWhatsapp?: string | null;
    clientIdentityId?: string | null;
    transactionScope?: string;
    destinationScope?: string | null;
    expiresAt: Date;
    notes?: string | null;
  },
) {
  if (!input.clientName.trim()) throw new Error('CLIENT_NAME_REQUIRED');
  if (input.expiresAt <= new Date()) throw new Error('PROTECTION_EXPIRY_INVALID');

  const conflicting = await db.agentClientProtection.findFirst({
    where: {
      status: 'active',
      expiresAt: { gt: new Date() },
      agentIdentityId: { not: context.identityId },
      OR: [
        ...(input.clientIdentityId ? [{ clientIdentityId: input.clientIdentityId }] : []),
        ...(input.clientPhone ? [{ clientPhone: input.clientPhone }] : []),
        ...(input.clientWhatsapp ? [{ clientWhatsapp: input.clientWhatsapp }] : []),
      ],
    },
    select: { id: true },
  });
  if (conflicting) throw new Error('CLIENT_ALREADY_PROTECTED');

  return db.agentClientProtection.create({
    data: {
      agentIdentityId: context.identityId,
      agencyOrganizationId: context.agencyOrganizationId,
      clientIdentityId: input.clientIdentityId ?? null,
      clientName: input.clientName.trim(),
      clientPhone: input.clientPhone ?? null,
      clientWhatsapp: input.clientWhatsapp ?? null,
      transactionScope: input.transactionScope ?? 'all',
      destinationScope: input.destinationScope ?? null,
      expiresAt: input.expiresAt,
      notes: input.notes ?? null,
    },
  });
}

export async function createAgentShortlist(
  db: PrismaClient,
  context: AgentContext,
  input: {
    title: string;
    unitIds: string[];
    clientProtectionId?: string | null;
    brandMode?: string;
    notes?: string | null;
  },
) {
  const uniqueUnitIds = Array.from(new Set(input.unitIds));
  if (!input.title.trim()) throw new Error('SHORTLIST_TITLE_REQUIRED');
  if (!uniqueUnitIds.length) throw new Error('SHORTLIST_UNITS_REQUIRED');

  const units = await db.unit.findMany({
    where: {
      id: { in: uniqueUnitIds },
      status: 'live',
      project: { status: 'live' },
    },
    select: { id: true },
  });
  if (units.length !== uniqueUnitIds.length) throw new Error('SHORTLIST_UNIT_NOT_DISTRIBUTABLE');

  if (input.clientProtectionId) {
    const protection = await db.agentClientProtection.findFirst({
      where: {
        id: input.clientProtectionId,
        agentIdentityId: context.identityId,
        status: 'active',
        expiresAt: { gt: new Date() },
      },
      select: { id: true },
    });
    if (!protection) throw new Error('CLIENT_PROTECTION_NOT_FOUND');
  }

  return db.agentShortlist.create({
    data: {
      agentIdentityId: context.identityId,
      agencyOrganizationId: context.agencyOrganizationId,
      clientProtectionId: input.clientProtectionId ?? null,
      title: input.title.trim(),
      brandMode: input.brandMode ?? 'myuno',
      notes: input.notes ?? null,
      items: {
        create: uniqueUnitIds.map((unitId, index) => ({
          unitId,
          sortOrder: index,
        })),
      },
    },
    include: {
      items: {
        include: {
          unit: {
            select: {
              id: true,
              name: true,
              project: { select: { id: true, name: true } },
            },
          },
        },
        orderBy: { sortOrder: 'asc' },
      },
    },
  });
}

export async function createAgentQuote(
  db: PrismaClient,
  context: AgentContext,
  input: {
    unitId: string;
    startDate: Date;
    endDate: Date;
    adults: number;
    children?: number;
    markupSatang?: number;
    discountSatang?: number;
    commissionRateBps?: number;
    clientProtectionId?: string | null;
    validUntil?: Date | null;
    publicNote?: string | null;
  },
) {
  const children = input.children ?? 0;
  const party = input.adults + children;
  const markupSatang = input.markupSatang ?? 0;
  const discountSatang = input.discountSatang ?? 0;
  const commissionRateBps = input.commissionRateBps ?? 1000;

  if (party < 1) throw new Error('QUOTE_PARTY_REQUIRED');
  if (input.endDate <= input.startDate) throw new Error('QUOTE_DATES_INVALID');
  if (markupSatang < 0 || discountSatang < 0) throw new Error('QUOTE_ADJUSTMENT_INVALID');
  if (commissionRateBps < 0) throw new Error('QUOTE_COMMISSION_INVALID');

  if (input.clientProtectionId) {
    const protection = await db.agentClientProtection.findFirst({
      where: {
        id: input.clientProtectionId,
        agentIdentityId: context.identityId,
        status: 'active',
        expiresAt: { gt: new Date() },
      },
      select: { id: true },
    });
    if (!protection) throw new Error('CLIENT_PROTECTION_NOT_FOUND');
  }

  const [breakdown, availability] = await Promise.all([
    computePriceBreakdown(
      db,
      input.unitId,
      input.startDate,
      input.endDate,
      party,
    ),
    checkAvailability(db, input.unitId, input.startDate, input.endDate),
  ]);

  const baseTotalSatang = breakdown.total_thb;
  const clientTotalSatang = Math.max(
    0,
    baseTotalSatang + markupSatang - discountSatang,
  );
  const commissionSatang = Math.round(baseTotalSatang * commissionRateBps / 10000);

  return db.agentQuote.create({
    data: {
      agentIdentityId: context.identityId,
      agencyOrganizationId: context.agencyOrganizationId,
      clientProtectionId: input.clientProtectionId ?? null,
      baseTotalSatang,
      markupSatang,
      discountSatang,
      feesSatang: breakdown.cleaning_fee_thb + breakdown.service_fee_thb,
      taxesSatang: breakdown.occupancy_tax_thb,
      clientTotalSatang,
      commissionSatang,
      availabilityState: availability ? 'live' : 'blocked',
      validUntil: input.validUntil ?? null,
      priceBreakdown: breakdown,
      publicNote: input.publicNote ?? null,
      items: {
        create: {
          unitId: input.unitId,
          startDate: input.startDate,
          endDate: input.endDate,
          adults: input.adults,
          children,
          baseSatang: baseTotalSatang,
          markupSatang,
          clientSatang: clientTotalSatang,
          rateSnapshot: breakdown,
        },
      },
    },
    include: {
      items: {
        include: {
          unit: {
            select: {
              id: true,
              name: true,
              project: { select: { id: true, name: true } },
            },
          },
        },
      },
    },
  });
}

export async function createAgentShareLink(
  db: PrismaClient,
  context: AgentContext,
  input: {
    shortlistId?: string;
    quoteId?: string;
    brandMode?: string;
    expiresAt?: Date | null;
  },
) {
  const hasShortlist = Boolean(input.shortlistId);
  const hasQuote = Boolean(input.quoteId);
  if (hasShortlist === hasQuote) throw new Error('SHARE_LINK_TARGET_REQUIRED');

  if (input.shortlistId) {
    const shortlist = await db.agentShortlist.findFirst({
      where: { id: input.shortlistId, agentIdentityId: context.identityId },
      select: { id: true },
    });
    if (!shortlist) throw new Error('SHORTLIST_NOT_FOUND');
  }
  if (input.quoteId) {
    const quote = await db.agentQuote.findFirst({
      where: { id: input.quoteId, agentIdentityId: context.identityId },
      select: { id: true },
    });
    if (!quote) throw new Error('QUOTE_NOT_FOUND');
  }

  return db.agentSharedLink.create({
    data: {
      agentIdentityId: context.identityId,
      shortlistId: input.shortlistId ?? null,
      quoteId: input.quoteId ?? null,
      token: randomUUID().replace(/-/g, ''),
      brandMode: input.brandMode ?? 'myuno',
      expiresAt: input.expiresAt ?? null,
    },
  });
}
