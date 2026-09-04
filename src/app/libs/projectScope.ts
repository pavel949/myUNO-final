import type { CurrentUser } from '@/app/actions/getCurrentUser';

const STAFF_ROLES = new Set(['staff_ops', 'onsite_host']);

export interface MCProjectScope {
  projectId: string;
  organizationId: string;
}

export function getStaffProjectIds(user: CurrentUser): string[] {
  return Array.from(
    new Set(
      user.roles
        .filter((assignment) => STAFF_ROLES.has(assignment.role))
        .map((assignment) => assignment.projectId)
        .filter((projectId): projectId is string => Boolean(projectId))
    )
  );
}

export function getMCProjectScopes(user: CurrentUser): MCProjectScope[] {
  const seen = new Set<string>();
  const scopes: MCProjectScope[] = [];
  for (const assignment of user.roles) {
    if (
      assignment.role !== 'mc_member' ||
      !assignment.projectId ||
      !assignment.organizationId
    ) {
      continue;
    }
    const key = `${assignment.projectId}:${assignment.organizationId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    scopes.push({
      projectId: assignment.projectId,
      organizationId: assignment.organizationId,
    });
  }
  return scopes;
}

export function hasProjectStaffAccess(user: CurrentUser, projectId: string): boolean {
  if (user.isAdmin) {
    return true;
  }

  return user.roles.some(
    (assignment) => STAFF_ROLES.has(assignment.role) && assignment.projectId === projectId
  );
}
