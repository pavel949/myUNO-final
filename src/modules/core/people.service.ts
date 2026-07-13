import { PrismaClient, Identity, RoleAssignment, Organization, RoleType, RoleScopeType, OrganizationType } from '@prisma/client';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';

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
}

interface RevokeRoleInput {
  roleAssignmentId: string;
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

  // Verify identity exists
  const identity = await db.identity.findUnique({ where: { id: identityId } });
  if (!identity) {
    throw new Error(`Identity ${identityId} not found`);
  }

  // Create role assignment
  return db.roleAssignment.create({
    data: {
      identityId,
      role,
      scopeType,
      projectId,
      unitId,
      organizationId,
      providerId,
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
  const { identityId, ttlMinutes = 7 * 24 * 60 } = input; // 7 days default

  const identity = await db.identity.findUnique({ where: { id: identityId } });
  if (!identity) {
    throw new Error(`Identity ${identityId} not found`);
  }

  if (identity.status !== 'invited') {
    throw new Error(`Identity ${identityId} is not in invited status`);
  }

  // Generate a random token
  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);

  // Store the hashed token
  await db.oneTimeToken.create({
    data: {
      identityId,
      purpose: 'account_claim',
      tokenHash,
      expiresAt,
    },
  });

  return token;
}

/**
 * Claim an invited identity by setting password and validating claim token
 */
export async function claimIdentity(db: PrismaClient, input: ClaimIdentityInput): Promise<Identity> {
  const { tokenHash, password } = input;

  // Find the token
  const token = await db.oneTimeToken.findFirst({
    where: { tokenHash },
    include: { identity: true },
  });

  if (!token) {
    throw new Error('Invalid or expired claim link');
  }

  if (token.consumedAt) {
    throw new Error('This claim link has already been used');
  }

  if (new Date() > token.expiresAt) {
    throw new Error('This claim link has expired');
  }

  if (token.identity.status !== 'invited') {
    throw new Error('Identity is not in invited status');
  }

  // Hash the password
  const hashedPassword = await bcrypt.hash(password, 10);

  // Update identity and consume token in a transaction
  const result = await db.$transaction(async (tx) => {
    // Mark token as consumed
    await tx.oneTimeToken.update({
      where: { id: token.id },
      data: { consumedAt: new Date() },
    });

    // Update identity
    return tx.identity.update({
      where: { id: token.identityId },
      data: {
        status: 'active',
        hashedPassword,
        emailVerifiedAt: new Date(), // Claiming via email link verifies the email
      },
    });
  });

  return result;
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
