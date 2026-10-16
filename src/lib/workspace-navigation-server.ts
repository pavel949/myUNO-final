import type { PrismaClient, RoleType } from '@prisma/client';
import { getCurrentUser, type CurrentUser } from '@/app/actions/getCurrentUser';
import { getActiveStayId } from '@/app/actions/getActiveStay';
import { prisma } from '@/lib/prisma';
import { availableSurfaces, resolveLanding } from '@/modules/core/landing';
import { validateRoleAssignmentScope } from '@/modules/core/role-assignment-policy';
import { getPropertyWorkspaces } from '@/modules/core/property-workspaces';
import { createEmployeeCreationService } from '@/modules/onboarding/employee-creation.service';
import { EmployeeCreationError } from '@/modules/onboarding/employee-creation.schema';
import { getOperatingSpaceOverviewAccess, OperatingAccessError } from '@/modules/ops/operating-space-access.service';
import { getMCManagedUnits } from '@/modules/projects';
import type { WorkspaceLink, WorkspaceNavigationContext, WorkspaceOption, WorkspaceScope } from './workspace-navigation';

const emptyScope = (): WorkspaceScope => ({ projectIds: [], organizationIds: [], spaceIds: [], unitIds: [] });
const link = (href: string, name: string): WorkspaceLink => ({ href, labelKey: `workspace.link.${name}` });
function option(id: string, name: string, href: string, scope: Partial<WorkspaceScope>, values: Partial<WorkspaceOption> = {}): WorkspaceOption {
  return { id, labelKey: `workspace.option.${name}`, href, todayHref: null, calendarHref: null,
    propertiesHref: href, more: [], scope: { ...emptyScope(), ...scope }, ...values };
}
export const EMPTY_WORKSPACE_NAVIGATION_CONTEXT: WorkspaceNavigationContext = {
  identityKey: null, signedIn: false, propertyOptions: [], serviceOptions: [], personalLinks: [], controlPlane: null,
};
const CALENDAR_DEPARTMENTS = ['reservations', 'front_desk', 'housekeeping', 'maintenance', 'guest_care', 'pricing'];

/** Re-read current authority. Session role names and stored workspace preferences are insufficient. */
export async function loadWorkspaceNavigationContext(db: PrismaClient, user: CurrentUser | null, activeBookingId: string | null = null): Promise<WorkspaceNavigationContext> {
  if (!user) return { ...EMPTY_WORKSPACE_NAVIGATION_CONTEXT };
  const actor = await db.identity.findUnique({ where: { id: user.identityId }, select: {
    id: true, status: true, isAdmin: true,
    roleAssignments: { where: { status: 'active' }, select: {
      role: true, scopeType: true, projectId: true, unitId: true, organizationId: true, providerId: true,
    } },
  } });
  if (actor?.status !== 'active') return { ...EMPTY_WORKSPACE_NAVIGATION_CONTEXT };
  const roles = actor.roleAssignments.filter(role => {
    try { validateRoleAssignmentScope(role); return true; } catch { return false; }
  });
  const projectIds = [...new Set(roles.flatMap(role => role.projectId ? [role.projectId] : []))];
  const orgIds = [...new Set(roles.flatMap(role => role.organizationId ? [role.organizationId] : []))];
  const [projects, organizations, policies, ownedUnits, narrow, creation, spaces] = await Promise.all([
    db.project.findMany({ where: actor.isAdmin ? {} : { id: { in: projectIds } }, select: { id: true, name: true } }),
    db.organization.findMany({ where: { id: { in: orgIds }, status: 'active' }, select: { id: true, name: true } }),
    db.projectStaffPermission.findMany({ where: { identityId: actor.id, projectId: { in: projectIds } }, select: { projectId: true, departments: true } }),
    roles.some(role => role.role === 'owner') ? db.unit.findMany({ where: { ownerIdentityId: actor.id }, select: { id: true, projectId: true } }) : [],
    getPropertyWorkspaces(db, actor.id),
    createEmployeeCreationService(db).list(actor.id).catch(error => {
      if (error instanceof EmployeeCreationError && error.status === 403) return null;
      throw error;
    }),
    db.operatingSpace.findMany({ where: { status: 'active', organization: { status: 'active' },
      ...(actor.isAdmin ? {} : { members: { some: { identityId: actor.id, active: true } } }),
    }, select: { id: true }, orderBy: { name: 'asc' } }),
  ]);
  const realProjects = new Set(projects.map(row => row.id));
  const realOrgs = new Set(organizations.map(row => row.id));
  const staffIds = [...new Set(roles.filter(role =>
    (role.role === 'staff_ops' || role.role === 'onsite_host') && role.scopeType === 'project' && !role.unitId && role.projectId && realProjects.has(role.projectId),
  ).map(role => role.projectId!))];
  const policy = new Map(policies.map(row => [row.projectId, row.departments]));
  const calendarIds = actor.isAdmin ? [...realProjects] : staffIds.filter(id =>
    !policy.has(id) || CALENDAR_DEPARTMENTS.some(department => policy.get(id)!.includes(department)));
  const operationalUnits = actor.isAdmin || staffIds.length ? await db.unit.findMany({
    where: { status: { not: 'offboarded' }, ...(actor.isAdmin ? {} : { projectId: { in: staffIds } }) },
    select: { id: true, projectId: true },
  }) : [];
  const propertyOptions: WorkspaceOption[] = [];
  for (const candidate of spaces) {
    try {
      const access = await getOperatingSpaceOverviewAccess(db, actor.id, candidate.id);
      // Creation-only membership intentionally fails this daily-operations projection.
      const can = (capability: keyof typeof access.byCapability) => Boolean(access.byCapability[capability]?.length);
      const units = await db.unit.findMany({ where: { id: { in: access.unitIds } }, select: { id: true, projectId: true } });
      const href = '/ops/spaces/' + encodeURIComponent(access.space.id);
      const q = '?spaceId=' + encodeURIComponent(access.space.id);
      const more = [
        ...(can('manage_tasks') ? [link('/ops/tasks' + q, 'tasks')] : []),
        ...(can('manage_housekeeping') ? [link('/ops/housekeeping' + q, 'housekeeping')] : []),
        ...(can('manage_maintenance') ? [link('/ops/maintenance' + q, 'maintenance')] : []),
        ...(can('manage_reservations') ? [link('/ops/reservations' + q, 'reservations')] : []),
      ];
      propertyOptions.push(option('space:' + access.space.id, 'space', href, {
        spaceIds: [access.space.id], organizationIds: [access.space.organizationId],
        projectIds: [...new Set(units.map(unit => unit.projectId))], unitIds: access.unitIds,
      }, { scopeName: access.space.name, todayHref: href, calendarHref: can('view_calendar') ? '/ops/calendar/board' + q : null, propertiesHref: href, more }));
    } catch (error) {
      if (!(error instanceof OperatingAccessError)) throw error;
    }
  }
  if (actor.isAdmin || staffIds.length) propertyOptions.unshift(option('ops', 'ops', '/ops', {
    projectIds: actor.isAdmin ? [...realProjects] : staffIds, unitIds: operationalUnits.map(unit => unit.id),
  }, { todayHref: '/ops', calendarHref: calendarIds.length ? '/ops/calendar/board' : null,
    propertiesHref: propertyOptions.length || actor.isAdmin ? '/ops/spaces' : '/ops',
    calendarScope: { ...emptyScope(), projectIds: calendarIds, unitIds: operationalUnits.filter(unit => calendarIds.includes(unit.projectId)).map(unit => unit.id) } }));
  // A project calendar may be narrower than Today. Keep a dedicated permitted list on its target.
  const ops = propertyOptions.find(item => item.id === 'ops');
  if (ops && calendarIds.length === 1) ops.calendarHref = '/ops/calendar/board?projectId=' + encodeURIComponent(calendarIds[0]);

  const mcRoles = roles.filter(role => role.role === 'mc_member' && role.scopeType === 'project' && !role.unitId &&
    role.projectId && realProjects.has(role.projectId) && role.organizationId && realOrgs.has(role.organizationId));
  for (const role of mcRoles) {
    const id = `mc:${role.projectId}:${role.organizationId}`;
    if (propertyOptions.some(item => item.id === id)) continue;
    const units = await getMCManagedUnits(db, actor.id, role.projectId!, role.organizationId!);
    const managedIds = new Set(units.map(unit => unit.id));
    const compatibleSpaces = propertyOptions.filter(item => item.id.startsWith('space:') &&
      item.scope.organizationIds.includes(role.organizationId!) && item.scope.unitIds.some(id => managedIds.has(id)));
    const spaceIds = compatibleSpaces.flatMap(item => item.scope.spaceIds);
    const calendarSpaceIds = compatibleSpaces.filter(item => item.calendarHref).flatMap(item => item.scope.spaceIds);
    const taskSpaceIds = compatibleSpaces.filter(item => item.more.some(link => link.href.startsWith('/ops/tasks?'))).flatMap(item => item.scope.spaceIds);
    const q = '?' + new URLSearchParams({ projectId: role.projectId!, organizationId: role.organizationId! });
    propertyOptions.push(option(id, 'mc', '/mc' + q, { projectIds: [role.projectId!], organizationIds: [role.organizationId!], unitIds: units.map(unit => unit.id), spaceIds }, {
      taskSpaceIds, calendarScope: { projectIds: [role.projectId!], organizationIds: [role.organizationId!], unitIds: units.map(unit => unit.id), spaceIds: calendarSpaceIds },
      scopeName: [projects.find(project => project.id === role.projectId)?.name, organizations.find(org => org.id === role.organizationId)?.name].filter(Boolean).join(' · '),
      todayHref: '/mc' + q, calendarHref: '/ops/calendar/board' + q + '&mc=1',
      propertiesHref: '/mc' + q + '#managed-properties', more: [],
    }));
  }
  const ownerHref = ownedUnits.length === 1 ? '/owner/units/' + encodeURIComponent(ownedUnits[0].id) : '/owner';
  if (ownedUnits.length) propertyOptions.push(option('owner', 'owner', ownerHref, {
    unitIds: ownedUnits.map(unit => unit.id), projectIds: [...new Set(ownedUnits.map(unit => unit.projectId))],
  }, { todayHref: ownerHref, more: [link('/owner/statements', 'statements')] }));
  const juristicIds = [...new Set(roles.filter(role => role.role === 'juristic_member' && role.scopeType === 'project' &&
    role.projectId && realProjects.has(role.projectId)).map(role => role.projectId!))];
  if (juristicIds.length) propertyOptions.push(option('juristic', 'juristic', '/juristic', { projectIds: juristicIds }, { todayHref: '/juristic' }));
  const residentIds = [...new Set(roles.filter(role => role.role === 'resident' && role.projectId && realProjects.has(role.projectId)).map(role => role.projectId!))];
  if (residentIds.length) propertyOptions.push(option('residence', 'residence', '/residence', { projectIds: residentIds }, { todayHref: '/residence' }));
  if (narrow.length) propertyOptions.push(option('property', 'property', '/property', {}, {
    more: narrow.map(name => link('/property/' + name, name === 'booking-mode' ? 'booking_mode' : name)),
  }));
  // Retained drafts are personal history, never current workspace permission.
  if (creation?.spaces.length) propertyOptions.push(option('creation', 'creation', '/property/create', {
    spaceIds: creation.spaces.map(space => space.id), organizationIds: [...new Set(creation.spaces.map(space => space.organizationId))],
    projectIds: [...new Set(creation.spaces.flatMap(space => space.projects.map(project => project.id)))],
  }, { more: [link('/property/create', 'create')] }));

  // Existing provider routes act for the first current provider membership, not an arbitrary query ID.
  const sessionProviderId = user.roles.find(role => role.role === 'provider_member' && role.providerId)?.providerId;
  const providerRole = roles.find(role => role.role === 'provider_member' && role.providerId === sessionProviderId && !!role.providerId);
  const provider = providerRole ? await db.provider.findUnique({ where: { id: providerRole.providerId! }, select: { id: true } }) : null;
  const serviceOptions = provider ? [option('provider:' + provider.id, 'provider', '/provider', {}, {
    todayHref: '/provider', propertiesHref: '/provider/services', more: [link('/provider/services', 'services'), link('/provider/remittances', 'remittances')],
  })] : [];
  const personalRoles = roles.map(role => role.role).filter(role => role === 'guest' || role === 'buyer' || (role === 'resident' && residentIds.length));
  const personalLinks = availableSurfaces({ isAdmin: false, roles: personalRoles, activeBookingId }).map(surface => ({
    href: surface.path, labelKey: surface.reason === 'active_stay' ? 'workspace.link.stay' :
      surface.reason === 'resident' ? 'workspace.option.residence' : surface.reason === 'buyer' ? 'workspace.link.buyer' : 'workspace.link.trips',
  }));
  // Preserve established role precedence only after filtering through real authority above.
  const safeRoleTypes: RoleType[] = roles.map(role => role.role).filter(role =>
    role === 'owner' ? ownedUnits.length > 0 : role === 'staff_ops' || role === 'onsite_host' ? staffIds.length > 0 :
      role === 'mc_member' ? mcRoles.length > 0 : role === 'juristic_member' ? juristicIds.length > 0 : false);
  const preferred = resolveLanding({ isAdmin: false, roles: safeRoleTypes });
  propertyOptions.sort((a, b) => Number(b.href.split('?')[0] === preferred.path) - Number(a.href.split('?')[0] === preferred.path));
  return { identityKey: actor.id, signedIn: true, propertyOptions, serviceOptions, personalLinks,
    controlPlane: actor.isAdmin ? { href: '/app/admin', labelKey: 'workspace.option.admin' } : null };
}

export async function getWorkspaceNavigationContext(user?: CurrentUser | null): Promise<WorkspaceNavigationContext> {
  const current = user === undefined ? await getCurrentUser() : user;
  return loadWorkspaceNavigationContext(prisma, current, current ? await getActiveStayId() : null);
}
