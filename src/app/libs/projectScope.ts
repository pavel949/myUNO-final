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
        .filter((assignment) => STAFF_ROLES.has(assignment.role) && !assignment.unitId)
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
  input: { projectId: string | null; unitId: string }
): Promise<boolean> {
  if (user.isAdmin) {
    return true;
  }

  // No project means no MC engagement scope to match against.
  if (input.projectId === null) {
    return false;
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

export function hasProjectStaffAccess(user: CurrentUser, projectId: string | null): boolean {
  if (user.isAdmin) {
    return true;
  }

  // A subject with no project (a standalone service order) is outside every
  // project's staff scope. Admin above is the only way in.
  if (projectId === null) {
    return false;
  }

  return user.roles.some(
    (assignment) => STAFF_ROLES.has(assignment.role) && !assignment.unitId && assignment.projectId === projectId
  );
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

/** Project-scoped operational permission. Both the active role and department grant are required.
 * Platform admins alone bypass project scope. */
export async function hasProjectDepartmentAccess(
  user: CurrentUser,
  projectId: string | null,
  department: string,
): Promise<boolean> {
  if (user.isAdmin) return true;
  if (!projectId || !hasProjectStaffAccess(user, projectId)) return false;
  const grant = await prisma.projectStaffPermission.findUnique({
    where: { projectId_identityId: { projectId, identityId: user.identityId } },
    select: { departments: true },
  });
  // Legacy project roles remain valid until a department policy is explicitly configured.
  return grant ? grant.departments.includes(department) : true;
}

/** Include only properties where the staff member has an active role AND at least
 * one of the requested departmental capabilities. */

/**
 * Resolve the exact physical units this operator may touch inside a candidate
 * set. This is the canonical operational intersection used by PMS surfaces:
 *
 *   candidate scope (OperatingSpace / route)
 *   ∩ project or unit staff grants
 *   ∪ active MC-managed units covered by the member's organization grant.
 *
 * Unit-scoped staff grants intentionally do not widen project access.
 */
export async function getAuthorizedOperationalUnitIds(
  user: CurrentUser,
  candidateUnitIds: readonly string[],
  departments: readonly string[] = [],
): Promise<string[]> {
  const uniqueCandidates = Array.from(new Set(candidateUnitIds.filter(Boolean)));
  if (!uniqueCandidates.length) return [];
  if (user.isAdmin) return uniqueCandidates;

  const candidateSet = new Set(uniqueCandidates);
  const exactStaffUnitIds = new Set(
    user.roles
      .filter((assignment) => STAFF_ROLES.has(assignment.role) && Boolean(assignment.unitId))
      .map((assignment) => assignment.unitId as string)
      .filter((unitId) => candidateSet.has(unitId))
  );

  const projectIds = await getDepartmentProjectIds(user, departments);
  if (projectIds.length) {
    const projectUnits = await prisma.unit.findMany({
      where: { id: { in: uniqueCandidates }, projectId: { in: projectIds } },
      select: { id: true },
    });
    for (const unit of projectUnits) exactStaffUnitIds.add(unit.id);
  }

  const mcScopes = getMCProjectScopes(user);
  if (mcScopes.length) {
    const candidates = await prisma.unit.findMany({
      where: { id: { in: uniqueCandidates } },
      select: { id: true, projectId: true },
    });
    const orgsByProject = new Map<string, string[]>();
    for (const scope of mcScopes) {
      const list = orgsByProject.get(scope.projectId) || [];
      list.push(scope.organizationId);
      orgsByProject.set(scope.projectId, list);
    }
    const eligibleIds = candidates
      .filter((unit) => orgsByProject.has(unit.projectId))
      .map((unit) => unit.id);
    if (eligibleIds.length) {
      const engagements = await prisma.unitEngagement.findMany({
        where: {
          unitId: { in: eligibleIds },
          engagementType: 'via_management_company',
          status: 'active',
          managementOrgId: { not: null },
        },
        select: { unitId: true, managementOrgId: true, unit: { select: { projectId: true } } },
      });
      for (const engagement of engagements) {
        if (
          engagement.managementOrgId &&
          orgsByProject.get(engagement.unit.projectId)?.includes(engagement.managementOrgId)
        ) exactStaffUnitIds.add(engagement.unitId);
      }
    }
  }

  return uniqueCandidates.filter((unitId) => exactStaffUnitIds.has(unitId));
}

export async function getDepartmentProjectIds(
  user: CurrentUser,
  departments: readonly string[],
): Promise<string[]> {
  if (user.isAdmin) {
    const projects=await prisma.project.findMany({select:{id:true}});
    return projects.map(project=>project.id);
  }
  const roleIds=getStaffProjectIds(user);
  if (!roleIds.length) return [];
  const grants=await prisma.projectStaffPermission.findMany({
    where:{projectId:{in:roleIds},identityId:user.identityId},
    select:{projectId:true,departments:true},
  });
  const configured=new Map(grants.map(grant=>[grant.projectId,grant.departments]));
  return roleIds.filter(projectId=>!configured.has(projectId)||departments.some(dept=>configured.get(projectId)?.includes(dept)));
}
