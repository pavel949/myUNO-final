import type { CurrentUser } from '@/app/actions/getCurrentUser';
import { prisma } from '@/lib/prisma';

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

export function getMCOrganizationIdsForProject(
  user: CurrentUser,
  projectId: string
): string[] {
  return Array.from(
    new Set(
      user.roles
        .filter(
          (assignment) =>
            assignment.role === 'mc_member' &&
            assignment.projectId === projectId &&
            Boolean(assignment.organizationId)
        )
        .map((assignment) => assignment.organizationId as string)
    )
  );
}

export async function hasManagedUnitMcAccess(
  user: CurrentUser,
  input: { projectId: string; unitId: string }
): Promise<boolean> {
  if (user.isAdmin) {
    return true;
  }

  const organizationIds = getMCOrganizationIdsForProject(user, input.projectId);
  if (organizationIds.length === 0) {
    return false;
  }

  const engagement = await prisma.unitEngagement.findFirst({
    where: {
      unitId: input.unitId,
      engagementType: 'via_management_company',
      status: 'active',
      managementOrgId: { in: organizationIds },
    },
    select: { id: true },
  });

  return Boolean(engagement);
}

export function hasProjectStaffAccess(user: CurrentUser, projectId: string): boolean {
  if (user.isAdmin) {
    return true;
  }

  return user.roles.some(
    (assignment) => STAFF_ROLES.has(assignment.role) && assignment.projectId === projectId
  );
}

/**
 * Staff or admin only — never MC/juristic. Board 19's permission matrix
 * states "open a guest passport" as one of its two absolutes; TM30 passport
 * details are exactly that, so this deliberately does not fall through to
 * `hasManagedUnitMcAccess` the way canAccessTm30Filing (mark-filed/failed)
 * does. See requirePassportAccess (core), which this route's handler calls
 * for the reason+audit-log half of the same rule.
 */
export function canViewTm30PassportDetails(user: CurrentUser, input: { projectId: string }): boolean {
  return hasProjectStaffAccess(user, input.projectId);
}

/** Staff or MC member with an active managed-unit engagement may file TM30 (doc 03). */
export async function canAccessTm30Filing(
  user: CurrentUser,
  input: { projectId: string; unitId: string }
): Promise<boolean> {
  if (user.isAdmin || hasProjectStaffAccess(user, input.projectId)) {
    return true;
  }
  return hasManagedUnitMcAccess(user, input);
}

/** MC member with a via-MC engagement may run mobilization on their units (doc 03). */
export async function canAccessMcMobilizationUnit(
  user: CurrentUser,
  input: { projectId: string; unitId: string }
): Promise<boolean> {
  if (user.isAdmin) {
    return true;
  }

  const organizationIds = getMCOrganizationIdsForProject(user, input.projectId);
  if (organizationIds.length === 0) {
    return false;
  }

  const engagement = await prisma.unitEngagement.findFirst({
    where: {
      unitId: input.unitId,
      engagementType: 'via_management_company',
      managementOrgId: { in: organizationIds },
      status: { in: ['draft', 'active'] },
    },
    select: { id: true },
  });

  return Boolean(engagement);
}
