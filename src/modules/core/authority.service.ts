import type { Identity, RoleAssignment, RoleType } from '@prisma/client';
import { PrismaClient } from '@prisma/client';
import { PERMISSIONS, type AccessLevel } from './permissions';

export type RequiredAccess = 'read' | 'allow';

export interface AuthorityResource {
  projectId?: string;
  unitId?: string;
  organizationId?: string;
  providerId?: string;
}

/**
 * Scope contract used by new v3 write paths.
 *
 * RoleScopeType currently models platform/project/unit. organizationId and
 * providerId already exist on RoleAssignment; when present they are additional
 * qualifiers and must match rather than being ignored.
 */
export function assignmentMatchesAuthorityResource(
  assignment: Pick<RoleAssignment, 'scopeType' | 'projectId' | 'unitId' | 'organizationId' | 'providerId'>,
  resource: AuthorityResource
): boolean {
  if (assignment.scopeType === 'project') {
    if (!assignment.projectId || assignment.projectId !== resource.projectId) return false;
  } else if (assignment.scopeType === 'unit') {
    if (!assignment.unitId || assignment.unitId !== resource.unitId) return false;
  } else if (assignment.scopeType !== 'platform') {
    return false;
  }

  if (assignment.organizationId && assignment.organizationId !== resource.organizationId) return false;
  if (assignment.providerId && assignment.providerId !== resource.providerId) return false;
  return true;
}

export function accessSatisfies(granted: AccessLevel, required: RequiredAccess): boolean {
  if (required === 'read') return granted === 'read' || granted === 'allow';
  return granted === 'allow';
}

/**
 * Explicit-access authorization for new canonical code.
 * - read request: `read` or `allow` permission
 * - write request: `allow` only
 * - scope qualifiers are enforced server-side
 * - blocked identities always denied; admins allowed
 */
export async function canWithAccess(
  db: PrismaClient,
  input: {
    identity: Pick<Identity, 'id' | 'status' | 'isAdmin'>;
    action: string;
    requiredAccess: RequiredAccess;
    resource?: AuthorityResource;
  }
): Promise<boolean> {
  if (input.identity.status === 'blocked') return false;
  if (input.identity.isAdmin) return true;

  const permissionRows = PERMISSIONS.filter(
    (permission) =>
      permission.action === input.action && accessSatisfies(permission.access, input.requiredAccess)
  );
  if (permissionRows.length === 0) return false;

  const allowedRoles = Array.from(new Set(permissionRows.map((permission) => permission.role))) as RoleType[];
  const assignments = await db.roleAssignment.findMany({
    where: {
      identityId: input.identity.id,
      status: 'active',
      role: { in: allowedRoles },
    },
  });

  return assignments.some((assignment) => {
    const permission = permissionRows.find((row) => row.role === assignment.role);
    if (!permission) return false;
    return assignmentMatchesAuthorityResource(assignment, input.resource ?? {});
  });
}
