import type { Identity, RoleAssignment, RoleType } from '@prisma/client';
import { PrismaClient } from '@prisma/client';
import { PERMISSIONS, resolvePermissionAction, type AccessLevel } from './permissions';

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

  // Route-level action names predate the doc 03 matrix vocabulary and are
  // aliased to canonical names. `can()` resolves them; this must too, or a
  // caller passing a legacy name (`compliance:confirm_permitted_use`,
  // `units:update`, `config:edit`) matches zero permission rows and is denied
  // for everyone but admin — failing closed, but silently and confusingly.
  const resolvedAction = resolvePermissionAction(input.action);

  const permissionRows = PERMISSIONS.filter(
    (permission) =>
      permission.action === resolvedAction && accessSatisfies(permission.access, input.requiredAccess)
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
