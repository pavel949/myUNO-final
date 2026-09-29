import { PrismaClient, RegulatoryCredential } from '@prisma/client';
import { evaluateCommercialEligibility } from './commercial-eligibility.engine';

/**
 * The credential types the eligibility engine actually checks for
 * (commercial-eligibility.engine.ts). Kept here as a code constant, not a
 * config catalog entry, because they are fixed Thai regulatory categories
 * the engine's own logic is hard-coded against (same choice the engine
 * already made for `offeringType`) — a catalog entry could drift from what
 * the engine actually reads.
 */
export const REGULATORY_CREDENTIAL_TYPES = [
  'hotel_business_license',
  'accommodation_exemption',
  'title_legal_use',
] as const;
export type RegulatoryCredentialType = (typeof REGULATORY_CREDENTIAL_TYPES)[number];

export const REGULATORY_CREDENTIAL_STATUSES = ['active', 'expired', 'revoked', 'pending'] as const;
export type RegulatoryCredentialStatus = (typeof REGULATORY_CREDENTIAL_STATUSES)[number];

export const REGULATORY_CREDENTIAL_SCOPE_LEVELS = ['organization', 'project', 'unit'] as const;
export type RegulatoryCredentialScopeLevel = (typeof REGULATORY_CREDENTIAL_SCOPE_LEVELS)[number];

export interface CreateRegulatoryCredentialInput {
  requirementKey?: string;
  jurisdictionCountry?: string;
  credentialType: string;
  scopeLevel: string;
  organizationId?: string;
  projectId?: string;
  unitId?: string;
  registrationNumber?: string;
  issuingAuthority?: string;
  legalHolderName?: string;
  issueDate?: Date;
  effectiveDate?: Date;
  expiryDate?: Date;
  status?: string;
  exemptionBasis?: string;
  notes?: string;
  verifiedByIdentityId: string;
}

function assertCredentialType(value: string): asserts value is RegulatoryCredentialType {
  if (!(REGULATORY_CREDENTIAL_TYPES as readonly string[]).includes(value)) {
    throw new Error(
      `Unknown credential type "${value}". Must be one of: ${REGULATORY_CREDENTIAL_TYPES.join(', ')}`
    );
  }
}

function assertScopeLevel(value: string): asserts value is RegulatoryCredentialScopeLevel {
  if (!(REGULATORY_CREDENTIAL_SCOPE_LEVELS as readonly string[]).includes(value)) {
    throw new Error(
      `Unknown scope level "${value}". Must be one of: ${REGULATORY_CREDENTIAL_SCOPE_LEVELS.join(', ')}`
    );
  }
}

function assertStatus(value: string): asserts value is RegulatoryCredentialStatus {
  if (!(REGULATORY_CREDENTIAL_STATUSES as readonly string[]).includes(value)) {
    throw new Error(
      `Unknown status "${value}". Must be one of: ${REGULATORY_CREDENTIAL_STATUSES.join(', ')}`
    );
  }
}

/**
 * Record a jurisdictional regulatory credential (hotel business licence,
 * accommodation exemption, title legal-use verification, …) against an
 * organization, project or unit. Admin-only writer — the piece Q71 found
 * missing: without it, the eligibility engine below had real check logic
 * but nothing to check.
 */
export async function createRegulatoryCredential(
  db: PrismaClient,
  input: CreateRegulatoryCredentialInput
): Promise<RegulatoryCredential> {
  assertCredentialType(input.credentialType);
  assertScopeLevel(input.scopeLevel);
  if (input.status) assertStatus(input.status);

  if (input.scopeLevel === 'unit') {
    if (!input.unitId) throw new Error('scopeLevel "unit" requires unitId');
    const unit = await db.unit.findUnique({ where: { id: input.unitId } });
    if (!unit) throw new Error(`Unit ${input.unitId} not found`);
  } else if (input.scopeLevel === 'project') {
    if (!input.projectId) throw new Error('scopeLevel "project" requires projectId');
    const project = await db.project.findUnique({ where: { id: input.projectId } });
    if (!project) throw new Error(`Project ${input.projectId} not found`);
  } else {
    if (!input.organizationId) throw new Error('scopeLevel "organization" requires organizationId');
    const organization = await db.organization.findUnique({ where: { id: input.organizationId } });
    if (!organization) throw new Error(`Organization ${input.organizationId} not found`);
  }

  return db.regulatoryCredential.create({
    data: {
      requirementKey: input.requirementKey || input.credentialType,
      jurisdictionCountry: input.jurisdictionCountry || 'TH',
      credentialType: input.credentialType,
      scopeLevel: input.scopeLevel,
      organizationId: input.scopeLevel === 'organization' ? input.organizationId : null,
      projectId: input.scopeLevel === 'project' ? input.projectId : null,
      unitId: input.scopeLevel === 'unit' ? input.unitId : null,
      registrationNumber: input.registrationNumber || null,
      issuingAuthority: input.issuingAuthority || null,
      legalHolderName: input.legalHolderName || null,
      issueDate: input.issueDate || null,
      effectiveDate: input.effectiveDate || null,
      expiryDate: input.expiryDate || null,
      status: input.status || 'active',
      exemptionBasis: input.exemptionBasis || null,
      verificationStatus: 'verified',
      verifiedByIdentityId: input.verifiedByIdentityId,
      verifiedAt: new Date(),
      notes: input.notes || null,
    },
  });
}

export interface UpdateRegulatoryCredentialInput {
  status?: string;
  registrationNumber?: string;
  issuingAuthority?: string;
  legalHolderName?: string;
  issueDate?: Date;
  effectiveDate?: Date;
  expiryDate?: Date;
  exemptionBasis?: string;
  notes?: string;
  verifiedByIdentityId: string;
}

/**
 * Edit an existing credential — most commonly flipping status to `expired`
 * or `revoked`, or recording a renewed expiry date. Every edit re-stamps
 * verifiedBy/verifiedAt: a credential's status is a legal claim, so who
 * last attested to it must always be current.
 */
export async function updateRegulatoryCredential(
  db: PrismaClient,
  id: string,
  input: UpdateRegulatoryCredentialInput
): Promise<RegulatoryCredential> {
  const existing = await db.regulatoryCredential.findUnique({ where: { id } });
  if (!existing) throw new Error(`RegulatoryCredential ${id} not found`);
  if (input.status) assertStatus(input.status);

  return db.regulatoryCredential.update({
    where: { id },
    data: {
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.registrationNumber !== undefined ? { registrationNumber: input.registrationNumber } : {}),
      ...(input.issuingAuthority !== undefined ? { issuingAuthority: input.issuingAuthority } : {}),
      ...(input.legalHolderName !== undefined ? { legalHolderName: input.legalHolderName } : {}),
      ...(input.issueDate !== undefined ? { issueDate: input.issueDate } : {}),
      ...(input.effectiveDate !== undefined ? { effectiveDate: input.effectiveDate } : {}),
      ...(input.expiryDate !== undefined ? { expiryDate: input.expiryDate } : {}),
      ...(input.exemptionBasis !== undefined ? { exemptionBasis: input.exemptionBasis } : {}),
      ...(input.notes !== undefined ? { notes: input.notes } : {}),
      verifiedByIdentityId: input.verifiedByIdentityId,
      verifiedAt: new Date(),
    },
  });
}

export interface ListRegulatoryCredentialsFilter {
  projectId?: string;
  unitId?: string;
  organizationId?: string;
}

export async function listRegulatoryCredentials(
  db: PrismaClient,
  filter: ListRegulatoryCredentialsFilter = {}
) {
  return db.regulatoryCredential.findMany({
    where: {
      ...(filter.projectId ? { projectId: filter.projectId } : {}),
      ...(filter.unitId ? { unitId: filter.unitId } : {}),
      ...(filter.organizationId ? { organizationId: filter.organizationId } : {}),
    },
    include: {
      project: { select: { id: true, name: true } },
      unit: { select: { id: true, name: true, projectId: true } },
      organization: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
}

export interface RegulatoryCredentialGoLiveCheck {
  ok: boolean;
  reason?: string;
  missingCredentials?: string[];
}

/**
 * The RegulatoryCredential half of the go-live gate — independent of, and
 * in addition to, the existing ComplianceRecord(permitted_use) gate (Q71
 * founder ruling, 2026-09-29): permitted_use is the general right to
 * operate the unit; this checks the specific short-term-rental licensing
 * status. Wired only into transitions TO live (units.ts, compliance.service
 * .ts) — an already-live unit is never re-evaluated, so nothing already
 * selling is retroactively affected by a unit having no credential rows yet.
 */
export async function checkRegulatoryCredentialForGoLive(
  db: PrismaClient,
  unitId: string
): Promise<RegulatoryCredentialGoLiveCheck> {
  const result = await evaluateCommercialEligibility(db, { unitId, offeringType: 'short_term_stay' });
  if (result.blockingReasons.includes('REQUIRED_CREDENTIAL_MISSING')) {
    return {
      ok: false,
      reason: `Unit cannot go live without an active regulatory credential (${result.missingCredentials.join(' or ')}). Record one under Admin → Compliance → Regulatory credentials.`,
      missingCredentials: result.missingCredentials,
    };
  }
  return { ok: true };
}
