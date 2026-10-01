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
      where: { unitId_offeringType: { unitId, offeringType } },
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

export const ONBOARDING_TRANSITIONS: Record<DerivedOnboardingState, readonly DerivedOnboardingState[]> = {
  draft: ['unit_matched', 'authority_pending', 'blocked'],
  unit_matched: ['authority_pending', 'authority_verified', 'blocked'],
  authority_pending: ['authority_verified', 'blocked'],
  authority_verified: ['commercial_configured', 'engagement_configured', 'readiness_pending', 'blocked'],
  commercial_configured: ['engagement_configured', 'readiness_pending', 'ready_for_activation', 'blocked'],
  engagement_configured: ['readiness_pending', 'ready_for_activation', 'blocked'],
  readiness_pending: ['ready_for_activation', 'blocked'],
  ready_for_activation: ['active', 'readiness_pending', 'blocked'],
  active: ['readiness_pending', 'blocked'],
  blocked: ['unit_matched', 'authority_pending', 'authority_verified', 'commercial_configured', 'engagement_configured', 'readiness_pending', 'ready_for_activation'],
};

export function canOnboardingTransition(
  from: DerivedOnboardingState,
  to: DerivedOnboardingState,
): boolean {
  return from === to || ONBOARDING_TRANSITIONS[from].includes(to);
}

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
      media: { select: { mediaId: true }, take: 1 },
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


type ActivationDb = Prisma.TransactionClient | import('@prisma/client').PrismaClient;

function credentialCurrent(
  credential: { status: string; verificationStatus: string; effectiveDate: Date | null; expiryDate: Date | null },
  now: Date,
) {
  return credential.status === 'active' &&
    credential.verificationStatus === 'verified' &&
    (!credential.effectiveDate || credential.effectiveDate <= now) &&
    (!credential.expiryDate || credential.expiryDate >= now);
}

export async function assertCommercialOfferingReadyForActivation(
  db: ActivationDb,
  unitId: string,
  offeringType: string,
) {
  const unit = await db.unit.findUnique({
    where: { id: unitId },
    include: {
      project: { select: { projectType: true } },
      inventoryCategory: { include: { ratePlans: { where: { status: 'active' } } } },
      media: true,
      sleepingSpaces: { include: { beds: true } },
      engagements: { where: { status: 'active' } },
      complianceRecords: true,
      regulatoryCredentials: true,
      ratePlans: { where: { status: 'active' } },
      mobilizationChecklist: true,
    },
  });
  if (!unit) throw new Error('Unit not found');

  const type = offeringType === 'short_stay' ? 'short_term_stay' : offeringType;
  const blockers: string[] = [];

  if (!unit.ownerIdentityId) blockers.push('verified_owner_required');

  if (type === 'short_term_stay' || type === 'long_term_rental') {
    if (!unit.engagements.length) blockers.push('active_operating_engagement_required');
    if (
      !unit.permittedUseConfirmedAt ||
      !unit.complianceRecords.some((record) => record.recordType === 'permitted_use' && record.status === 'confirmed')
    ) {
      blockers.push('permitted_use_confirmation_required');
    }
  }

  if (type === 'short_term_stay') {
    if (!unit.inventoryCategory || unit.inventoryCategory.status !== 'live') blockers.push('live_inventory_category_required');
    if (!unit.inventoryCategory || unit.inventoryCategory.baseNightlyThb <= 0 || unit.inventoryCategory.minNights < 1) {
      blockers.push('valid_stay_pricing_required');
    }
    if (!unit.ratePlans.length && !(unit.inventoryCategory?.ratePlans.length)) blockers.push('active_rate_plan_required');
    if (!unit.coverMediaId || unit.media.length < 3) blockers.push('exact_unit_media_required');
    if (!unit.sleepingSpaces.some((space) => space.beds.length > 0)) blockers.push('sleeping_spaces_required');
    const completed = new Set(
      unit.mobilizationChecklist
        .filter((item) => item.status === 'done' || item.status === 'skipped')
        .map((item) => item.step),
    );
    if (completed.size < 7) blockers.push('hospitality_mobilization_required');
  }

  if (type === 'sale') {
    const now = new Date();
    const title = unit.regulatoryCredentials.some(
      (credential) => credential.credentialType === 'title_legal_use' && credentialCurrent(credential, now),
    );
    const authority = unit.regulatoryCredentials.some(
      (credential) => credential.credentialType === 'sale_authority' && credentialCurrent(credential, now),
    );
    if (!title) blockers.push('verified_title_legal_use_required');
    if (!authority) blockers.push('verified_sale_authority_required');
  }

  if (blockers.length) {
    throw new Error(`offering_activation_blocked:${blockers.join(',')}`);
  }
}
