import { PrismaClient, Identity, RoleAssignment, Organization, RoleType, RoleScopeType, OrganizationType } from '@prisma/client';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { validateRoleAssignmentScope } from './role-assignment-policy';
import { isPropertyCapabilityRole } from './property-capability-policy';
import { grantPropertyCapability, revokePropertyCapability } from './property-capability-grants';

interface SearchIdentitiesInput {
  query?: string;
  limit?: number;
  offset?: number;
}

interface GrantRoleInput {
  identityId: string;
  role: RoleType;
  scopeType: RoleScopeType;
  projectId?: string;
  unitId?: string;
  organizationId?: string;
  providerId?: string;
  grantedByIdentityId: string;
  canDelegate?: boolean;
  parentGrantId?: string | null;
  expiresAt?: string | null;
  expectedUpdatedAt?: string;
}

interface RevokeRoleInput {
  roleAssignmentId: string;
  actorIdentityId?: string;
}

interface BlockIdentityInput {
  identityId: string;
}

interface UnblockIdentityInput {
  identityId: string;
}

interface CreateOrganizationInput {
  name: string;
  orgType: OrganizationType;
  projectId?: string;
  contactEmail: string;
  contactPhone: string;
}

interface UpdateOrganizationInput {
  name?: string;
  contactEmail?: string;
  contactPhone?: string;
}

interface GenerateClaimLinkInput {
  identityId: string;
  ttlMinutes?: number;
}

export interface InviteIdentityInput {
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  preferredLocale?: string;
}

export interface InviteIdentityResult {
  identity: Identity;
  /** False when the email already belonged to someone — nothing was created. */
  created: boolean;
  /**
   * True when the person already has a working account. There is nothing to
   * claim: grant them the role and they are in. Sending a claim link here
   * would be worse than useless — it cannot be redeemed, and it invites the
   * recipient to believe their existing password no longer works.
   */
  alreadyActive: boolean;
}

/**
 * Invite a person who is not on the platform yet.
 *
 * This was the missing first step of F-OWN-1. The whole claim flow existed and
 * worked — the emailed link, the landing page, the token, the password form —
 * and **nothing could put anyone into `invited` status**, so the flow began
 * nowhere. An owner handed over a unit could not be given a way in.
 *
 * Reusing an existing identity rather than creating a second one is the point:
 * an identity is a person, global and singular (CLAUDE.md), and the same human
 * arrives as a guest before they are ever an owner.
 */
export async function inviteIdentity(
  db: PrismaClient,
  input: InviteIdentityInput
): Promise<InviteIdentityResult> {
  if (typeof input.email !== 'string' || input.email.length > 254 ||
    typeof input.firstName !== 'string' || input.firstName.length > 100 ||
    typeof input.lastName !== 'string' || input.lastName.length > 100 ||
    (input.phone !== undefined && (typeof input.phone !== 'string' || input.phone.length > 32)) ||
    (input.preferredLocale !== undefined && !['en', 'ru', 'th', 'zh'].includes(input.preferredLocale)))
    throw new Error('Enter a valid email, name and supported language');
  const email = input.email.trim().toLowerCase();
  const firstName = input.firstName.trim();
  const lastName = input.lastName.trim();

  if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email)) throw new Error('A valid email address is required');
  if (!firstName || !lastName) throw new Error('A first and last name are required');

  const existing = await db.identity.findUnique({ where: { email } });
  if (existing) {
    if (!['active', 'invited'].includes(existing.status))
      throw new Error('This account is unavailable. Review its status before inviting it.');
    // Never downgrade a live account to `invited`: that would suspend a working
    // login on the strength of somebody typing a familiar address into a form.
    return {
      identity: existing,
      created: false,
      alreadyActive: existing.status !== 'invited',
    };
  }

  const identity = await db.identity.create({
    data: {
      email,
      firstName,
      lastName,
      ...(input.phone ? { phone: input.phone.trim() } : {}),
      preferredLocale: input.preferredLocale || 'ru',
      status: 'invited',
    },
  });

  return { identity, created: true, alreadyActive: false };
}

interface ClaimIdentityInput {
  tokenHash: string;
  password: string;
}

/**
 * Hash a claim token for storage (one-way)
 */
function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Search identities by email, name, or phone
 */
export async function searchIdentities(
  db: PrismaClient,
  input: SearchIdentitiesInput
): Promise<{ identities: Identity[]; total: number }> {
  const { query = '', limit = 20, offset = 0 } = input;

  const where = query
    ? {
        OR: [
          { email: { contains: query, mode: 'insensitive' as const } },
          { firstName: { contains: query, mode: 'insensitive' as const } },
          { lastName: { contains: query, mode: 'insensitive' as const } },
          { phone: { contains: query, mode: 'insensitive' as const } },
        ],
      }
    : {};

  const [identities, total] = await Promise.all([
    db.identity.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    }),
    db.identity.count({ where }),
  ]);

  return { identities, total };
}

/**
 * Grant a role to an identity with optional scope
 */
export async function grantRole(db: PrismaClient, input: GrantRoleInput): Promise<RoleAssignment> {
  const { identityId, role, scopeType, projectId, unitId, organizationId, providerId, grantedByIdentityId } = input;

  validateRoleAssignmentScope(input);
  if (isPropertyCapabilityRole(role)) {
    const result = await grantPropertyCapability(db, grantedByIdentityId, {
      identityId, role, scopeType, projectId, unitId,
      canDelegate: input.canDelegate, parentGrantId: input.parentGrantId,
      expiresAt: input.expiresAt, expectedUpdatedAt: input.expectedUpdatedAt,
    });
    return result.grant;
  }

  // Restricted employee grants must not piggyback on operational invitation paths.
  if (role === 'content_contributor') {
    const granter = await db.identity.findUnique({
      where: { id: grantedByIdentityId },
      select: { isAdmin: true, status: true },
    });
    if (!granter?.isAdmin || granter.status !== 'active') {
      throw new Error('Only active admins can grant content contributor roles');
    }
  }

  // Verify identity exists
  const identity = await db.identity.findUnique({ where: { id: identityId } });
  if (!identity) {
    throw new Error(`Identity ${identityId} not found`);
  }

  const normalizedProjectId = scopeType === 'platform' ? null : (projectId ?? null);
  const normalizedUnitId = scopeType === 'unit' ? unitId! : null;
  const normalizedOrganizationId = organizationId ?? null;
  const normalizedProviderId = providerId ?? null;

  if (normalizedProjectId) {
    const project = await db.project.findUnique({ where: { id: normalizedProjectId }, select: { id: true } });
    if (!project) {
      throw new Error(`Project ${normalizedProjectId} not found`);
    }
  }

  if (scopeType === 'unit') {
    const unit = await db.unit.findUnique({
      where: { id: normalizedUnitId as string },
      select: { id: true, projectId: true },
    });
    if (!unit) {
      throw new Error(`Unit ${normalizedUnitId} not found`);
    }
    if (unit.projectId !== normalizedProjectId) {
      throw new Error(`Unit ${normalizedUnitId} does not belong to project ${normalizedProjectId}`);
    }
  }

  const existing = await db.roleAssignment.findFirst({
    where: {
      identityId,
      role,
      scopeType,
      projectId: normalizedProjectId,
      unitId: normalizedUnitId,
      organizationId: normalizedOrganizationId,
      providerId: normalizedProviderId,
    },
    include: {
      identity: true,
      project: true,
      unit: true,
      organization: true,
    },
  });

  if (existing) {
    return db.roleAssignment.update({
      where: { id: existing.id },
      data: {
        status: 'active',
        grantedByIdentityId,
      },
      include: {
        identity: true,
        project: true,
        unit: true,
        organization: true,
      },
    });
  }

  return db.roleAssignment.create({
    data: {
      identityId,
      role,
      scopeType,
      projectId: normalizedProjectId,
      unitId: normalizedUnitId,
      organizationId: normalizedOrganizationId,
      providerId: normalizedProviderId,
      grantedByIdentityId,
      status: 'active',
    },
    include: {
      identity: true,
      project: true,
      unit: true,
      organization: true,
    },
  });
}

/**
 * Revoke a role assignment
 */
export async function revokeRole(db: PrismaClient, input: RevokeRoleInput): Promise<RoleAssignment> {
  const { roleAssignmentId } = input;
  const assignment = await db.roleAssignment.findUnique({ where: { id: roleAssignmentId } });
  if (assignment && isPropertyCapabilityRole(assignment.role)) {
    if (!input.actorIdentityId) throw new Error('Current actor is required to revoke a property capability');
    return (await revokePropertyCapability(db, input.actorIdentityId, roleAssignmentId)).grant;
  }
  return db.roleAssignment.update({
    where: { id: roleAssignmentId },
    data: { status: 'revoked' },
    include: {
      identity: true,
      project: true,
      unit: true,
      organization: true,
    },
  });
}

/**
 * Block an identity (they lose all access)
 */
export async function blockIdentity(db: PrismaClient, input: BlockIdentityInput): Promise<Identity> {
  const { identityId } = input;

  const identity = await db.identity.findUnique({ where: { id: identityId } });
  if (!identity) {
    throw new Error(`Identity ${identityId} not found`);
  }

  return db.identity.update({
    where: { id: identityId },
    data: { status: 'blocked' },
  });
}

/**
 * Unblock an identity
 */
export async function unblockIdentity(db: PrismaClient, input: UnblockIdentityInput): Promise<Identity> {
  const { identityId } = input;

  const identity = await db.identity.findUnique({ where: { id: identityId } });
  if (!identity) {
    throw new Error(`Identity ${identityId} not found`);
  }

  if (identity.status !== 'blocked') {
    throw new Error(`Identity ${identityId} is not blocked`);
  }

  return db.identity.update({
    where: { id: identityId },
    data: { status: 'active' },
  });
}

/**
 * Create an organization (MC or juristic person)
 */
export async function createOrganization(
  db: PrismaClient,
  input: CreateOrganizationInput
): Promise<Organization> {
  const { name, orgType, projectId, contactEmail, contactPhone } = input;

  return db.organization.create({
    data: {
      name,
      orgType,
      projectId,
      contactEmail,
      contactPhone,
      status: 'active',
    },
  });
}

/**
 * Update an organization
 */
export async function updateOrganization(
  db: PrismaClient,
  organizationId: string,
  input: UpdateOrganizationInput
): Promise<Organization> {
  const org = await db.organization.findUnique({ where: { id: organizationId } });
  if (!org) {
    throw new Error(`Organization ${organizationId} not found`);
  }

  return db.organization.update({
    where: { id: organizationId },
    data: input,
  });
}

/**
 * Delete an organization
 */
export async function deleteOrganization(db: PrismaClient, organizationId: string): Promise<Organization> {
  const org = await db.organization.findUnique({ where: { id: organizationId } });
  if (!org) {
    throw new Error(`Organization ${organizationId} not found`);
  }

  return db.organization.delete({ where: { id: organizationId } });
}

/**
 * Generate a claim link for an invited identity
 */
export async function generateClaimLink(db: PrismaClient, input: GenerateClaimLinkInput): Promise<string> {
  const { identityId, ttlMinutes = 7 * 24 * 60 } = input;
  if (!Number.isSafeInteger(ttlMinutes) || ttlMinutes <= 0 || ttlMinutes > 7 * 24 * 60)
    throw new Error('Claim link expiry must be between one minute and seven days');
  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashToken(token);
  // The same identity lock serializes resend, first claim and administrator block.
  await db.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM identity WHERE id = ${identityId} FOR UPDATE`;
    const identity = await tx.identity.findUnique({ where: { id: identityId } });
    if (!identity) throw new Error(`Identity ${identityId} not found`);
    if (identity.status !== 'invited') throw new Error(`Identity ${identityId} is not in invited status`);
    await tx.oneTimeToken.updateMany({ where: { identityId, purpose: 'account_claim', consumedAt: null },
      data: { consumedAt: new Date() } });
    await tx.oneTimeToken.create({ data: { identityId, purpose: 'account_claim', tokenHash,
      expiresAt: new Date(Date.now() + ttlMinutes * 60 * 1000) } });
  });
  return token;
}

/** Claim exactly once. Never let concurrent claims overwrite the first chosen password. */
export async function claimIdentity(db: PrismaClient, input: ClaimIdentityInput): Promise<Identity> {
  const { tokenHash, password } = input;
  if (typeof tokenHash !== 'string' || !/^[a-f0-9]{64}$/.test(tokenHash))
    throw new Error('Invalid or expired claim link');
  if (typeof password !== 'string' || password.length < 8 || Buffer.byteLength(password, 'utf8') > 72)
    throw new Error('Use a password of at least 8 characters and at most 72 UTF-8 bytes');
  // This lookup chooses the lock target only; all authority checks happen again inside it.
  const reference = await db.oneTimeToken.findFirst({ where: { tokenHash, purpose: 'account_claim' },
    select: { id: true, identityId: true } });
  if (!reference) throw new Error('Invalid or expired claim link');
  const hashedPassword = await bcrypt.hash(password, 10);
  return db.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM identity WHERE id = ${reference.identityId} FOR UPDATE`;
    await tx.$queryRaw`SELECT id FROM one_time_token WHERE id = ${reference.id} FOR UPDATE`;
    const token = await tx.oneTimeToken.findFirst({ where: { id: reference.id, tokenHash, purpose: 'account_claim' },
      include: { identity: true } });
    if (!token) throw new Error('Invalid or expired claim link');
    if (token.consumedAt) throw new Error('This claim link has already been used');
    if (token.expiresAt <= new Date()) throw new Error('This claim link has expired');
    if (token.identity.status !== 'invited') throw new Error('Identity is not in invited status');
    await tx.oneTimeToken.update({ where: { id: token.id }, data: { consumedAt: new Date() } });
    const identity = await tx.identity.update({ where: { id: token.identityId },
      // Account-claim links may be handed over by an authorized inviter.
      // Possession proves this claim, not control of the email mailbox.
      // A separately verified timestamp, if any, is left untouched.
      data: { status: 'active', hashedPassword } });
    await tx.auditLog.create({ data: { actorIdentityId: identity.id, action: 'people.account_claimed',
      entityType: 'Identity', entityId: identity.id, data: {} } });
    return identity;
  });
}

/**
 * Get roles for an identity
 */
export async function getIdentityRoles(db: PrismaClient, identityId: string): Promise<RoleAssignment[]> {
  return db.roleAssignment.findMany({
    where: {
      identityId,
      status: 'active',
    },
    include: {
      identity: true,
      project: true,
      unit: true,
      organization: true,
    },
  });
}

/**
 * List organizations
 */
export async function listOrganizations(
  db: PrismaClient,
  filters?: {
    orgType?: OrganizationType;
    projectId?: string;
  }
): Promise<Organization[]> {
  const where: any = {};

  if (filters?.orgType) {
    where.orgType = filters.orgType;
  }

  if (filters?.projectId) {
    where.projectId = filters.projectId;
  }

  return db.organization.findMany({
    where,
    include: {
      roleAssignments: true,
      engagements: true,
    },
    orderBy: { name: 'asc' },
  });
}
