import type { Identity, PrismaClient, RoleAssignment, UnitEngagementType } from '@prisma/client';
import { can } from './permissions';

export type UnitCommercialAuthorityMode =
  | 'owner'
  | 'management_company'
  | 'myuno'
  | 'unassigned';

export interface UnitCommercialAuthority {
  mode: UnitCommercialAuthorityMode;
  engagementId: string | null;
  engagementType: UnitEngagementType | null;
  ownerIdentityId: string | null;
  managementOrgId: string | null;
}

function assignmentMatchesUnit(
  assignment: Pick<RoleAssignment, 'scopeType' | 'projectId' | 'unitId'>,
  projectId: string,
  unitId: string
): boolean {
  if (assignment.scopeType === 'platform') return true;
  if (assignment.scopeType === 'project') return assignment.projectId === projectId;
  if (assignment.scopeType === 'unit') return assignment.unitId === unitId;
  return false;
}

/**
 * Canonical commercial authority for a physical unit.
 *
 * Role membership answers "who are you?". The active UnitEngagement answers
 * "who currently controls this home's commercial operation?". Keeping those
 * separate prevents an owner role from silently overriding a signed management
 * mandate and prevents a project-level MC member from operating another MC's
 * inventory.
 */
export async function resolveUnitCommercialAuthority(
  db: PrismaClient,
  unitId: string
): Promise<UnitCommercialAuthority | null> {
  const unit = await db.unit.findUnique({
    where: { id: unitId },
    select: {
      ownerIdentityId: true,
      engagements: {
        where: { status: 'active' },
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: {
          id: true,
          engagementType: true,
          ownerIdentityId: true,
          managementOrgId: true,
        },
      },
    },
  });
  if (!unit) return null;

  const engagement = unit.engagements[0] ?? null;
  if (!engagement) {
    return {
      mode: 'unassigned',
      engagementId: null,
      engagementType: null,
      ownerIdentityId: unit.ownerIdentityId,
      managementOrgId: null,
    };
  }

  const mode: UnitCommercialAuthorityMode =
    engagement.engagementType === 'owner_direct'
      ? 'owner'
      : engagement.engagementType === 'via_management_company'
        ? 'management_company'
        : 'myuno';

  return {
    mode,
    engagementId: engagement.id,
    engagementType: engagement.engagementType,
    ownerIdentityId: engagement.ownerIdentityId || unit.ownerIdentityId,
    managementOrgId: engagement.managementOrgId,
  };
}

export async function canWriteUnitCommercial(
  db: PrismaClient,
  identity: Identity,
  unitId: string,
  projectId: string
): Promise<boolean> {
  if (identity.status === 'blocked') return false;
  if (identity.isAdmin) return true;

  const authority = await resolveUnitCommercialAuthority(db, unitId);
  if (!authority) return false;

  const assignments = await db.roleAssignment.findMany({
    where: {
      identityId: identity.id,
      status: 'active',
      role: { in: ['owner', 'mc_member', 'staff_ops'] },
    },
  });

  const scoped = assignments.filter((assignment) =>
    assignmentMatchesUnit(assignment, projectId, unitId)
  );

  // Self-managed inventory: the verified owner is the commercial operator.
  if (
    authority.mode === 'owner' &&
    authority.ownerIdentityId === identity.id &&
    scoped.some((assignment) => assignment.role === 'owner')
  ) {
    return true;
  }

  // MC-managed inventory: organization membership is part of the authority
  // check. A project-scoped member of another MC must not inherit write access.
  if (
    authority.mode === 'management_company' &&
    authority.managementOrgId &&
    scoped.some(
      (assignment) =>
        assignment.role === 'mc_member' &&
        assignment.organizationId === authority.managementOrgId
    )
  ) {
    return true;
  }

  // Assigned myUNO staff retain operational support rights in every authority
  // mode. This preserves the existing support path while primary ownership of
  // pricing remains explicit in the UI.
  if (scoped.some((assignment) => assignment.role === 'staff_ops')) {
    return can({
      identity,
      action: 'units:manage_availability_and_pricing',
      requiredAccess: 'allow',
      resource: { projectId, unitId },
    });
  }

  // Draft/unassigned inventory keeps the legacy staff/MC path so onboarding
  // can be completed before a mandate is activated.
  if (authority.mode === 'unassigned') {
    return can({
      identity,
      action: 'units:manage_availability_and_pricing',
      requiredAccess: 'allow',
      resource: { projectId, unitId },
    });
  }

  return false;
}

export async function canWriteUnitListing(
  db: PrismaClient,
  identity: Identity,
  unitId: string,
  projectId: string
): Promise<boolean> {
  if (identity.status === 'blocked') return false;
  if (identity.isAdmin) return true;

  const authority = await resolveUnitCommercialAuthority(db, unitId);
  if (!authority) return false;

  const assignments = await db.roleAssignment.findMany({
    where: {
      identityId: identity.id,
      status: 'active',
      role: { in: ['owner', 'mc_member', 'staff_ops'] },
    },
  });
  const scoped = assignments.filter((assignment) =>
    assignmentMatchesUnit(assignment, projectId, unitId)
  );

  if (
    authority.mode === 'owner' &&
    authority.ownerIdentityId === identity.id &&
    scoped.some((assignment) => assignment.role === 'owner')
  ) {
    return true;
  }

  if (
    authority.mode === 'management_company' &&
    authority.managementOrgId &&
    scoped.some(
      (assignment) =>
        assignment.role === 'mc_member' &&
        assignment.organizationId === authority.managementOrgId
    )
  ) {
    return true;
  }

  if (scoped.some((assignment) => assignment.role === 'staff_ops')) {
    return can({
      identity,
      action: 'units:edit_listing',
      requiredAccess: 'allow',
      resource: { projectId, unitId },
    });
  }

  if (authority.mode === 'unassigned') {
    return can({
      identity,
      action: 'units:edit_listing',
      requiredAccess: 'allow',
      resource: { projectId, unitId },
    });
  }

  return false;
}
