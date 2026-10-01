import type { Prisma } from '@prisma/client';

export type RequestedOffer = 'short_stay' | 'monthly' | 'yearly' | 'sale';
export type CanonicalOfferingType = 'short_term_stay' | 'long_term_rental' | 'sale';
export type RequestedOperatingModel = 'owner_direct' | 'via_management_company' | 'direct_managed';

export type PropertySubmissionLike = {
  kind?: string | null;
  offers?: unknown;
  operatingModel?: unknown;
};

export function requestedOfferToCanonical(offer: RequestedOffer): CanonicalOfferingType {
  if (offer === 'short_stay') return 'short_term_stay';
  if (offer === 'monthly' || offer === 'yearly') return 'long_term_rental';
  return 'sale';
}

export function canonicalOfferings(input: unknown): CanonicalOfferingType[] {
  if (!Array.isArray(input)) return [];
  const valid = input.filter(
    (value): value is RequestedOffer =>
      typeof value === 'string' && ['short_stay', 'monthly', 'yearly', 'sale'].includes(value),
  );
  return [...new Set(valid.map(requestedOfferToCanonical))];
}

export function classifyPropertySubmission(data: PropertySubmissionLike): 'sale' | 'rental' | 'management' {
  const offers = Array.isArray(data.offers)
    ? data.offers.filter((value): value is RequestedOffer =>
        typeof value === 'string' && ['short_stay', 'monthly', 'yearly', 'sale'].includes(value),
      )
    : [];
  if (offers.length === 1 && offers[0] === 'sale') return 'sale';
  if (data.kind === 'management' || data.operatingModel === 'direct_managed') return 'management';
  if (offers.some((offer) => offer === 'short_stay' || offer === 'monthly' || offer === 'yearly')) return 'rental';
  return 'management';
}

export function normalizeUnitIdentifier(value: string): string {
  return value
    .normalize('NFKD')
    .toLowerCase()
    .replace(/\b(building|tower|unit|villa|room)\b/g, '')
    .replace(/[^a-z0-9]+/g, '');
}

export async function resolveCanonicalUnitTx(
  tx: Prisma.TransactionClient,
  input: {
    projectId: string;
    existingUnitId?: string | null;
    unitName: string;
  },
): Promise<{ unitId: string | null; duplicateCandidateId: string | null }> {
  if (input.existingUnitId) {
    const unit = await tx.unit.findFirst({
      where: { id: input.existingUnitId, projectId: input.projectId },
      select: { id: true },
    });
    if (!unit) throw new Error('Selected existing property does not belong to this project.');
    return { unitId: unit.id, duplicateCandidateId: null };
  }

  const needle = normalizeUnitIdentifier(input.unitName);
  if (!needle) return { unitId: null, duplicateCandidateId: null };

  const candidates = await tx.unit.findMany({
    where: { projectId: input.projectId },
    select: { id: true, name: true },
    take: 500,
  });
  const duplicate = candidates.find((candidate) => normalizeUnitIdentifier(candidate.name) === needle);
  return { unitId: null, duplicateCandidateId: duplicate?.id ?? null };
}

export async function ensureDraftCommercialOfferingsTx(
  tx: Prisma.TransactionClient,
  unitId: string,
  requestedOffers: unknown,
) {
  const types = canonicalOfferings(requestedOffers);
  for (const offeringType of types) {
    await tx.commercialOffering.upsert({
      where: { commercial_offering_unit_type_unique: { unitId, offeringType } },
      create: { unitId, offeringType, status: 'draft' },
      update: {},
    });
  }
  return types;
}

export type DerivedOnboardingState =
  | 'draft'
  | 'unit_matched'
  | 'authority_pending'
  | 'authority_verified'
  | 'commercial_configured'
  | 'engagement_configured'
  | 'readiness_pending'
  | 'ready_for_activation'
  | 'active'
  | 'blocked';

export async function deriveUnitOnboardingState(
  tx: Prisma.TransactionClient,
  unitId: string,
): Promise<{ state: DerivedOnboardingState; blockers: string[] }> {
  const unit = await tx.unit.findUnique({
    where: { id: unitId },
    select: {
      ownerIdentityId: true,
      permittedUseConfirmedAt: true,
      commercialOfferings: { select: { offeringType: true, status: true } },
      engagements: { select: { engagementType: true, status: true, mandateMediaId: true, noiCapAnnualThb: true, managementOrgId: true } },
      ratePlans: { select: { id: true, status: true } },
      media: { select: { id: true }, take: 1 },
    },
  });
  if (!unit) return { state: 'blocked', blockers: ['UNIT_NOT_FOUND'] };

  const blockers: string[] = [];
  if (!unit.ownerIdentityId) blockers.push('AUTHORITY_NOT_VERIFIED');

  const requested = unit.commercialOfferings.filter((o) => o.status === 'draft' || o.status === 'active');
  const shortStay = requested.some((o) => o.offeringType === 'short_term_stay');
  if (shortStay) {
    if (!unit.permittedUseConfirmedAt) blockers.push('PERMITTED_USE_NOT_VERIFIED');
    if (!unit.ratePlans.some((plan) => plan.status === 'active')) blockers.push('SHORT_STAY_RATE_PLAN_MISSING');
    if (!unit.media.length) blockers.push('PUBLIC_MEDIA_MISSING');
  }

  const draftEngagement = unit.engagements.find((e) => e.status === 'draft');
  if (draftEngagement?.engagementType === 'direct_managed') {
    if (!draftEngagement.mandateMediaId) blockers.push('MANAGEMENT_MANDATE_MISSING');
    if (!draftEngagement.noiCapAnnualThb) blockers.push('DIRECT_MANAGED_ECONOMICS_MISSING');
  }
  if (draftEngagement?.engagementType === 'via_management_company' && !draftEngagement.managementOrgId) {
    blockers.push('MANAGEMENT_ORGANIZATION_MISSING');
  }

  if (unit.engagements.some((e) => e.status === 'active') || requested.some((o) => o.status === 'active')) {
    return { state: blockers.length ? 'blocked' : 'active', blockers };
  }
  if (!unit.ownerIdentityId) return { state: 'authority_pending', blockers };
  if (!requested.length && !unit.engagements.length) return { state: 'authority_verified', blockers };
  if (requested.length && !unit.engagements.length) return { state: blockers.length ? 'readiness_pending' : 'commercial_configured', blockers };
  if (unit.engagements.length) return { state: blockers.length ? 'readiness_pending' : 'ready_for_activation', blockers };
  return { state: 'unit_matched', blockers };
}
