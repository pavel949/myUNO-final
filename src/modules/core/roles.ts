import { RoleType, RoleScopeType } from '@prisma/client';
import { prisma } from '@/lib/prisma';

interface GrantRoleInput {
  identityId: string;
  role: RoleType;
  scopeType: RoleScopeType;
  projectId?: string;
  unitId?: string;
  organizationId?: string;
  providerId?: string;
  grantedByIdentityId: string; // who is granting the role
}

interface RevokeRoleInput {
  identityId: string;
  role: RoleType;
  scopeType: RoleScopeType;
  projectId?: string;
  unitId?: string;
}

/**
 * Grant a role to an identity in a specific scope.
 * Validates that the granter has permission to grant roles.
 * Creates or updates the role assignment.
 */
export async function grantRole(input: GrantRoleInput) {
  const {
    identityId,
    role,
    scopeType,
    projectId,
    unitId,
    organizationId,
    providerId,
    grantedByIdentityId,
  } = input;

  // Validate scope consistency
  if (scopeType === 'project' && !projectId) {
    throw new Error('projectId is required for project-scoped roles');
  }

  if (scopeType === 'unit' && !unitId) {
    throw new Error('unitId is required for unit-scoped roles');
  }

  // Check that the granter is an admin (for now, simple check)
  const granter = await prisma.identity.findUnique({
    where: { id: grantedByIdentityId },
  });

  if (!granter || !granter.isAdmin) {
    throw new Error('Only admins can grant roles');
  }

  // Try to find and update existing assignment, or create new one
  const existing = await prisma.roleAssignment.findFirst({
    where: {
      identityId,
      role,
      scopeType,
      projectId: scopeType === 'project' ? projectId : null,
      unitId: scopeType === 'unit' ? unitId : null,
    },
  });

  if (existing) {
    // Reactivate if revoked
    return await prisma.roleAssignment.update({
      where: { id: existing.id },
      data: {
        status: 'active',
        grantedByIdentityId,
        updatedAt: new Date(),
      },
    });
  }

  // Create new role assignment
  return await prisma.roleAssignment.create({
    data: {
      identityId,
      role,
      scopeType,
      projectId: scopeType === 'project' ? projectId : undefined,
      unitId: scopeType === 'unit' ? unitId : undefined,
      organizationId,
      providerId,
      status: 'active',
      grantedByIdentityId,
    },
  });
}

/**
 * Revoke a role from an identity.
 * Sets the role assignment status to 'revoked' (soft delete).
 */
export async function revokeRole(input: RevokeRoleInput) {
  const { identityId, role, scopeType, projectId, unitId } = input;

  const assignment = await prisma.roleAssignment.findFirst({
    where: {
      identityId,
      role,
      scopeType,
      projectId: scopeType === 'project' ? projectId : null,
      unitId: scopeType === 'unit' ? unitId : null,
    },
  });

  if (!assignment) {
    throw new Error('Role assignment not found');
  }

  return await prisma.roleAssignment.update({
    where: { id: assignment.id },
    data: { status: 'revoked' },
  });
}

/**
 * Get all role assignments for an identity.
 */
export async function getIdentityRoleAssignments(identityId: string) {
  return await prisma.roleAssignment.findMany({
    where: { identityId },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Get all role assignments in a project.
 */
export async function getProjectRoleAssignments(projectId: string) {
  return await prisma.roleAssignment.findMany({
    where: {
      projectId,
      status: 'active',
    },
    include: {
      identity: true,
    },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Get all role assignments for a unit.
 */
export async function getUnitRoleAssignments(unitId: string) {
  return await prisma.roleAssignment.findMany({
    where: {
      unitId,
      status: 'active',
    },
    include: {
      identity: true,
    },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Get all identities with a specific role in a project.
 */
export async function getIdentitiesWithRole(projectId: string, role: RoleType) {
  return await prisma.roleAssignment.findMany({
    where: {
      projectId,
      role,
      status: 'active',
    },
    include: {
      identity: true,
    },
  });
}
