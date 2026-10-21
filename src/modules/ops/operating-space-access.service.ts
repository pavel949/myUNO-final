import { isAllowedImageType } from '@/modules/media/media.service';
import { isAllowedVideoType } from '@/modules/media/video-policy';
import type { Prisma, PrismaClient } from '@prisma/client';
import { CAPABILITY_DEPARTMENTS } from './operating-space-capabilities';
import { currentEngagementWhere } from '@/modules/projects/engagement-scope';
import { OPERATING_SPACE_CAPABILITIES, type OperatingSpaceCapability } from './operating-space.service';
import { isOperatingCreationCapability } from './operating-creation-capabilities';

type Db = PrismaClient | Prisma.TransactionClient;
export const TASK_DEPARTMENTS = ['housekeeping', 'front_desk', 'maintenance', 'guest_care', 'reservations'] as const;
export class OperatingAccessError extends Error {
  constructor(message: string, public readonly status = 403) { super(message); }
}

/**
 * Local administrators cannot safely inherit unit-only legacy booking readers
 * across workspace boundaries. Omit the entire ambiguous physical unit rather
 * than hide foreign occupancy and incorrectly present it as available.
 * Foreign historical group bindings remain blocked until explicitly reconciled.
 */
export async function isolatedWorkspaceAdministratorUnitIds(db: Db, spaceId: string, unitIds: string[], now = new Date()) {
  if (!unitIds.length) return [];
  const rows = await db.unit.findMany({ where: { id: { in: unitIds },
    operatingSpaces: { none: { operatingSpaceId: { not: spaceId }, active: true,
      startsOn: { lte: now }, OR: [{ endsOn: null }, { endsOn: { gt: now } }],
      operatingSpace: { status: 'active', organization: { status: 'active' } },
    } },
    bookings: { none: { reservationGroup: { operatingSpaceId: { not: null }, NOT: { operatingSpaceId: spaceId } } } },
    importedReservationPlacements: { none: { source: { reservationGroup: {
      operatingSpaceId: { not: null }, NOT: { operatingSpaceId: spaceId },
    } } } },
  }, select: { id: true } });
  return rows.map(row => row.id);
}

/** Every invocation reads current identity and grants; cookies supply only identityId. */
export async function getOperationalActor(db: Db, identityId: string) {
  const actor = await db.identity.findUnique({ where: { id: identityId }, select: {
    id: true, status: true, isAdmin: true,
    roleAssignments: { where: { status: 'active' }, select: {
      role: true, scopeType: true, projectId: true, unitId: true, organizationId: true,
    } },
  } });
  if (!actor || actor.status !== 'active') throw new OperatingAccessError('Active account required');
  return actor;
}

/** Preserve legacy authority while intersecting an explicit set of physical units. */
export async function getLegacyOperationalUnitIds(
  db: Db, identityId: string, departments: readonly string[], candidateUnitIds?: string[], organizationId?: string, mcOnly = false,
) {
  const actor = await getOperationalActor(db, identityId);
  if (candidateUnitIds && !candidateUnitIds.length) return [];
  const candidate = candidateUnitIds ? { id: { in: candidateUnitIds } } : {};
  if (actor.isAdmin) return (await db.unit.findMany({ where: candidate, select: { id: true } })).map(u => u.id);
  const staffProjects = [...new Set(actor.roleAssignments.filter(r =>
    !mcOnly && (r.role === 'staff_ops' || r.role === 'onsite_host') && r.scopeType === 'project' && !r.unitId && r.projectId
  ).map(r => r.projectId!))];
  const policies = await db.projectStaffPermission.findMany({
    where: { identityId, projectId: { in: staffProjects } }, select: { projectId: true, departments: true },
  });
  const policy = new Map(policies.map(p => [p.projectId, p.departments]));
  const projects = staffProjects.filter(id => !policy.has(id) || departments.some(d => policy.get(id)!.includes(d)));
  const mcScopes = actor.roleAssignments.filter(r => r.role === 'mc_member' && r.scopeType === 'project' && r.projectId && r.organizationId && !r.unitId && (!organizationId || r.organizationId === organizationId));
  const authority: Prisma.UnitWhereInput[] = [
    ...(projects.length ? [{ projectId: { in: projects } }] : []),
    ...mcScopes.map(r => ({ projectId: r.projectId!, engagements: { some: {
      managementOrgId: r.organizationId!, managementOrg: { status: 'active' as const },
      engagementType: 'via_management_company' as const, ...currentEngagementWhere(),
    } } })),
  ];
  if (!authority.length) return [];
  return (await db.unit.findMany({ where: { ...candidate, OR: authority }, select: { id: true } })).map(u => u.id);
}

export async function getScopedOperationalAccess(
  db: Db, identityId: string, spaceId: string, capability: OperatingSpaceCapability,
  departments: readonly string[],
) {
  if (isOperatingCreationCapability(capability)) {
    throw new OperatingAccessError('Creation requires the reviewed property-intake workflow');
  }
  const actor = await getOperationalActor(db, identityId);
  const space = await db.operatingSpace.findUnique({ where: { id: spaceId }, select: {
    id: true, key: true, name: true, status: true, organizationId: true, timezone: true,
    organization: { select: { status: true } },
  } });
  if (!space || space.status !== 'active' || space.organization.status !== 'active') {
    throw new OperatingAccessError('Operating space is not active');
  }
  let isWorkspaceAdministrator = false;
  if (!actor.isAdmin) {
    const membership = await db.operatingSpaceMember.findUnique({
      where: { operatingSpaceId_identityId: { operatingSpaceId: spaceId, identityId } },
      select: { active: true, capabilities: true, isAdministrator: true },
    });
    if (!membership?.active || (!membership.isAdministrator && !membership.capabilities.includes(capability))) {
      throw new OperatingAccessError('Operating space capability required');
    }
    isWorkspaceAdministrator = membership.isAdministrator;
  }
  const now = new Date();
  const attached = await db.operatingSpaceUnit.findMany({ where: {
    operatingSpaceId: spaceId, active: true, startsOn: { lte: now },
    OR: [{ endsOn: null }, { endsOn: { gt: now } }],
  }, select: { unitId: true } });
  const eligible = new Set((await eligibleOrganizationUnits(db, space.organizationId, now)).map(u => u.id));
  const candidateIds = attached.map(u => u.unitId).filter(id => eligible.has(id));
  const unitIds = isWorkspaceAdministrator ? await isolatedWorkspaceAdministratorUnitIds(db, spaceId, candidateIds, now) :
    await getLegacyOperationalUnitIds(db, identityId, departments, candidateIds, space.organizationId);
  // Never label local authority isAdmin: downstream callers use that flag to bypass global checks.
  return { space, unitIds, isAdmin: actor.isAdmin, isWorkspaceAdministrator };
}

export async function assertOperationalTaskAccess(
  db: Db, identityId: string,
  task: { unitId: string; projectId: string; operatingSpaceId: string | null },
  capability: OperatingSpaceCapability = 'manage_tasks',
) {
  const unit = await db.unit.findUnique({ where: { id: task.unitId }, select: { projectId: true } });
  if (!unit || unit.projectId !== task.projectId) throw new OperatingAccessError('Task scope is invalid');
  const ids = task.operatingSpaceId !== null
    ? (await getScopedOperationalAccess(db, identityId, task.operatingSpaceId, capability, TASK_DEPARTMENTS)).unitIds
    : await getLegacyOperationalUnitIds(db, identityId, TASK_DEPARTMENTS, [task.unitId]);
  if (!ids.includes(task.unitId)) throw new OperatingAccessError('Task is outside your authorized scope');
}

/** Keep scoped tasks scoped even on the legacy all-tasks page. */
export async function operationalTaskVisibility(db: Db, identityId: string): Promise<Prisma.OperationalTaskWhereInput> {
  const actor = await getOperationalActor(db, identityId);
  if (actor.isAdmin) return {};
  const legacy = await getLegacyOperationalUnitIds(db, identityId, TASK_DEPARTMENTS);
  const memberships = await db.operatingSpaceMember.findMany({ where: {
    identityId, active: true, OR: [{ capabilities: { has: 'manage_tasks' } }, { isAdministrator: true }],
    operatingSpace: { status: 'active', organization: { status: 'active' } },
  }, select: { operatingSpaceId: true } });
  const scopes: Prisma.OperationalTaskWhereInput[] = [{ operatingSpaceId: null, unitId: { in: legacy } }];
  for (const member of memberships) {
    const access = await getScopedOperationalAccess(db, identityId, member.operatingSpaceId, 'manage_tasks', TASK_DEPARTMENTS);
    scopes.push({ operatingSpaceId: member.operatingSpaceId, unitId: { in: access.unitIds } });
  }
  return { OR: scopes };
}

export function validOperatingCapabilities(value: unknown): value is OperatingSpaceCapability[] {
  return Array.isArray(value) && value.length <= OPERATING_SPACE_CAPABILITIES.length &&
    value.every(v => typeof v === 'string' && (OPERATING_SPACE_CAPABILITIES as readonly string[]).includes(v));
}

/** Existing operating relationships establish eligibility; attaching never creates a mandate. */
export async function eligibleOrganizationUnits(db: Db, organizationId: string, now = new Date()) {
  const org = await db.organization.findUnique({ where: { id: organizationId }, select: { id: true, status: true } });
  if (!org || org.status !== 'active') throw new OperatingAccessError('Choose an active organization', 400);
  return db.unit.findMany({ where: {
    status: { not: 'offboarded' },
    OR: [
      { engagements: { some: { managementOrgId: organizationId, engagementType: 'via_management_company', mandateMediaId: { not: null }, ...currentEngagementWhere(now) } } },
      { project: { orgRoles: { some: {
        organizationId, roleKey: { in: ['operator', 'resort_operator', 'management_operator', 'property_manager', 'management_company'] },
        provenance: 'verified',
        AND: [ { OR: [{ effectiveFrom: null }, { effectiveFrom: { lte: now } }] },
          { OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }] } ],
      } } } },
    ],
  }, select: { id: true, name: true, projectId: true, project: { select: { name: true } } }, orderBy: [{ project: { name: 'asc' } }, { name: 'asc' }] });
}


/** Shared effective-unit projection for workspace navigation and count-only cards. */
export async function getOperatingSpaceOverviewAccess(db: Db, identityId: string, spaceId: string) {
  const actor = await getOperationalActor(db, identityId);
  const membership = actor.isAdmin ? null : await db.operatingSpaceMember.findUnique({
    where: { operatingSpaceId_identityId: { operatingSpaceId: spaceId, identityId } },
    select: { active: true, capabilities: true, isAdministrator: true },
  });
  if (!actor.isAdmin && !membership?.active) throw new OperatingAccessError('Operating space membership required');
  const dailyCapabilities = OPERATING_SPACE_CAPABILITIES.filter(cap => !isOperatingCreationCapability(cap));
  const capabilities = actor.isAdmin || membership?.isAdministrator ? dailyCapabilities :
    dailyCapabilities.filter(cap => membership!.capabilities.includes(cap));
  // Admin scope is independent of department. Resolve the canonical intersection
  // once, rather than repeating the same database reads for all 13 capabilities
  // on every root-layout render. This is invocation-local, never an auth cache.
  if (actor.isAdmin) {
    const access = await getScopedOperationalAccess(db, identityId, spaceId, 'view_calendar', CAPABILITY_DEPARTMENTS.view_calendar);
    // A role changed during the read: fail closed rather than reuse staff scope
    // as administrative authority for unrelated capabilities.
    if (!access.isAdmin) throw new OperatingAccessError('Authority changed; reload the workspace');
    return {
      space: access.space, unitIds: access.unitIds, isAdmin: true,
      isWorkspaceAdministrator: false,
      byCapability: Object.fromEntries(dailyCapabilities.map(capability => [capability, [...access.unitIds]])) as Partial<Record<OperatingSpaceCapability, string[]>>,
    };
  }
  const byCapability: Partial<Record<OperatingSpaceCapability, string[]>> = {};
  let space: Awaited<ReturnType<typeof getScopedOperationalAccess>>['space'] | undefined;
  for (const capability of capabilities) {
    const access = await getScopedOperationalAccess(db, identityId, spaceId, capability, CAPABILITY_DEPARTMENTS[capability]);
    space = access.space;
    byCapability[capability] = access.unitIds;
  }
  const unitIds = [...new Set(Object.values(byCapability).flat())];
  if (!space || (!actor.isAdmin && !unitIds.length)) throw new OperatingAccessError('No effective workspace access');
  return { space, unitIds, byCapability, isAdmin: actor.isAdmin, isWorkspaceAdministrator: Boolean(membership?.isAdministrator) };
}

/** Team assignment never treats membership of an arbitrary team as unit authority. */
export async function assertOperationalTeamAssignment(db: Db, teamId: string, scope: {
  unitId: string; projectId: string; operatingSpaceId: string | null;
}) {
  if (!scope.operatingSpaceId) throw new OperatingAccessError('Team assignment requires an explicit operating space', 400);
  const team = await db.operatingTeam.findFirst({ where: { id: teamId, operatingSpaceId: scope.operatingSpaceId, active: true },
    select: { members: { where: { active: true }, select: { identityId: true } } },
  });
  if (!team?.members.length) throw new OperatingAccessError('Choose an active team with eligible members');
  for (const member of team.members) await assertOperationalTaskAccess(db, member.identityId, scope);
}

/** A private task attachment is not a gallery publication or a private-file download. */
export async function assertOperationalTaskMediaAccess(db: Db, actorId: string, scope: {
  unitId: string; projectId: string; operatingSpaceId: string | null;
}, mediaIds: string[]) {
  if (mediaIds.some(id => typeof id !== 'string' || !id)) throw new OperatingAccessError('Invalid task attachment', 400);
  const actor = await getOperationalActor(db, actorId);
  await assertOperationalTaskAccess(db, actor.id, scope);
  const assets = await db.mediaAsset.findMany({ where: {
    id: { in: mediaIds }, kind: { in: ['photo', 'document', 'receipt'] },
    sizeBytes: { gt: 0 }, OR: [{ deleteAfter: null }, { deleteAfter: { gt: new Date() } }],
    AND: [{ OR: [
      { uploadedByIdentityId: actor.id },
      ...(actor.isAdmin ? [
        { unitMedia: { some: { unitId: scope.unitId } } },
        { operationalTaskMedia: { some: { task: { unitId: scope.unitId, projectId: scope.projectId } } } },
      ] : []),
    ] }],
  }, select: { id: true, kind: true, mimeType: true } });
  if (assets.length !== mediaIds.length || assets.some(asset =>
    !(isAllowedImageType(asset.mimeType) ||
      ((asset.kind === 'document' || asset.kind === 'receipt') && asset.mimeType === 'application/pdf') ||
      (asset.kind === 'document' && isAllowedVideoType(asset.mimeType)))
  )) throw new OperatingAccessError('Use an allowed attachment you uploaded, or an existing attachment on this home with founder access');
}
