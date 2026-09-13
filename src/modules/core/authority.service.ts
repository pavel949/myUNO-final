import type { Identity, RoleAssignment, RoleType } from '@prisma/client';
import { PrismaClient } from '@prisma/client';
import { PERMISSIONS, type AccessLevel } from './permissions';

export type RequiredAccess = 'read' | 'allow';

export interface AuthorityResource {
  projectId?: string;
  unitId?: string;
}

export function accessSatisfies(granted: AccessLevel, required: RequiredAccess): boolean {
  if (required === 'read') return granted === 'read' || granted === 'allow';
  return granted === 'allow';
}

function assignmentMatchesResource(
  assignment: Pick<RoleAssignment, 'scopeType' | 'projectId' | 'unitId'>,
  resource: AuthorityResource
): boolean {
  if (assignment.scopeType === 'platform') return true;
  if (assignment.scopeType === 'project') {
    return Boolean(assignment.projectId) && assignment.projectId === resource.projectId;
  }
  if (assignment.scopeType === 'unit') {
    return Boolean(assignment.unitId) && assignment.unitId === resource.unitId;
  }
  return false;
}

/**
 * Explicit read/write authorization for routes that cannot safely use legacy can().
 * Legacy can() intentionally treats `read` and `allow` the same, so mutation
 * routes must use this seam until the remaining call sites are migrated.
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
    return assignmentMatchesResource(assignment, input.resource ?? {});
  });
}
