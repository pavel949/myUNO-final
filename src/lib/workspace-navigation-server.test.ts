import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import type { CurrentUser } from '@/app/actions/getCurrentUser';

const mocked = vi.hoisted(() => ({ narrow: vi.fn(), creation: vi.fn(), spaceAccess: vi.fn(), managed: vi.fn(), activeStay: vi.fn() }));
vi.mock('@/lib/prisma', () => ({ prisma: {} }));
vi.mock('@/app/actions/getCurrentUser', () => ({ getCurrentUser: vi.fn() }));
vi.mock('@/app/actions/getActiveStay', () => ({ getActiveStayId: mocked.activeStay }));
vi.mock('@/modules/core/property-workspaces', () => ({ getPropertyWorkspaces: mocked.narrow }));
vi.mock('@/modules/onboarding/employee-creation.service', () => ({ createEmployeeCreationService: () => ({ list: mocked.creation }) }));
vi.mock('@/modules/ops/operating-space-access.service', () => ({ getOperatingSpaceOverviewAccess: mocked.spaceAccess, OperatingAccessError: class extends Error {} }));
vi.mock('@/modules/projects', () => ({ getMCManagedUnits: mocked.managed }));
import { loadWorkspaceNavigationContext } from './workspace-navigation-server';
import { OperatingAccessError } from '@/modules/ops/operating-space-access.service';

const role = (name: string, fields: Record<string, unknown> = {}) => ({ role: name, scopeType: 'project', projectId: 'p', unitId: null, organizationId: null, providerId: null, ...fields });
const user = (roles: ReturnType<typeof role>[] = []): CurrentUser => ({ identityId: 'u', email: null, firstName: 'U', lastName: '', isAdmin: false, roles: roles as CurrentUser['roles'] });
function database(roles: ReturnType<typeof role>[] = [], overrides: Record<string, unknown> = {}) {
  const raw = {
    identity: { findUnique: vi.fn().mockResolvedValue({ id: 'u', status: 'active', isAdmin: false, roleAssignments: roles, ...overrides }) },
    project: { findMany: vi.fn().mockResolvedValue([{ id: 'p', name: 'Project' }]) },
    organization: { findMany: vi.fn().mockResolvedValue([{ id: 'o', name: 'Organization' }]) },
    projectStaffPermission: { findMany: vi.fn().mockResolvedValue([]) },
    unit: { findMany: vi.fn().mockResolvedValue([]) },
    operatingSpace: { findMany: vi.fn().mockResolvedValue([]) },
    provider: { findUnique: vi.fn().mockResolvedValue({ id: 'provider' }) },
  };
  return { raw, db: raw as unknown as PrismaClient };
}
beforeEach(() => {
  vi.clearAllMocks();
  mocked.narrow.mockResolvedValue([]);
  mocked.creation.mockResolvedValue({ spaces: [], items: [] });
  mocked.managed.mockResolvedValue([]);
});
describe('current server authority projection', () => {
  it('does no database work for anonymous visitors', async () => {
    const { db, raw } = database();
    const context = await loadWorkspaceNavigationContext(db, null);
    expect(context.signedIn).toBe(false);
    expect(raw.identity.findUnique).not.toHaveBeenCalled();
  });
  it('drops all navigation when the current identity is no longer active', async () => {
    const { db } = database([], { status: 'blocked', isAdmin: true });
    expect(await loadWorkspaceNavigationContext(db, user())).toMatchObject({ signedIn: false, propertyOptions: [], controlPlane: null });
    expect(mocked.narrow).not.toHaveBeenCalled();
  });
  it('never promotes malformed staff/provider/MC role names into workspaces', async () => {
    const roles = [role('staff_ops', { scopeType: 'unit', unitId: 'unit' }), role('mc_member'), role('provider_member', { scopeType: 'platform', projectId: null })];
    const { db } = database(roles);
    const context = await loadWorkspaceNavigationContext(db, user(roles));
    expect(context.propertyOptions).toEqual([]);
    expect(context.serviceOptions).toEqual([]);
  });
  it('requires actual ownership, rather than owner role alone', async () => {
    const { db, raw } = database([role('owner')]);
    expect((await loadWorkspaceNavigationContext(db, user())).propertyOptions).toEqual([]);
    raw.unit.findMany.mockResolvedValue([{ id: 'u1', projectId: 'p' }]);
    expect((await loadWorkspaceNavigationContext(db, user())).propertyOptions[0]).toMatchObject({ id: 'owner', calendarHref: null, scope: { unitIds: ['u1'] } });
  });
  it('uses effective narrow capabilities without giving them operations or calendar', async () => {
    mocked.narrow.mockResolvedValue(['content', 'pricing']);
    const { db } = database([role('pricing_editor')]);
    const context = await loadWorkspaceNavigationContext(db, user());
    expect(mocked.narrow).toHaveBeenCalledWith(db, 'u');
    expect(context.propertyOptions).toHaveLength(1);
    expect(context.propertyOptions[0]).toMatchObject({ id: 'property', todayHref: null, calendarHref: null });
    expect(context.propertyOptions[0].more.map(link => link.href)).toEqual(['/property/content', '/property/pricing']);
  });
  it('creation-only current grant exposes creation, never daily operations', async () => {
    mocked.creation.mockResolvedValue({ spaces: [{ id: 's', organizationId: 'o', projects: [{ id: 'p' }] }], items: [] });
    const { db } = database();
    const context = await loadWorkspaceNavigationContext(db, user());
    expect(context.propertyOptions.map(item => item.id)).toEqual(['creation']);
    expect(context.propertyOptions[0]).toMatchObject({ href: '/property/create', todayHref: null, calendarHref: null });
  });
  it('retained intake history cannot restore revoked creation authority', async () => {
    mocked.creation.mockResolvedValue({ spaces: [], items: [{ id: 'old', hasCreationAccess: false }] });
    const { db } = database();
    expect((await loadWorkspaceNavigationContext(db, user())).propertyOptions).toEqual([]);
  });
  it('calendar access is narrower than the staff Today scope', async () => {
    const { db, raw } = database([role('staff_ops'), role('staff_ops', { projectId: 'finance' })]);
    raw.project.findMany.mockResolvedValue([{ id: 'p', name: 'Project' }, { id: 'finance', name: 'Finance' }]);
    raw.projectStaffPermission.findMany.mockResolvedValue([{ projectId: 'p', departments: ['reservations'] }, { projectId: 'finance', departments: ['finance'] }]);
    const ops = (await loadWorkspaceNavigationContext(db, user())).propertyOptions.find(item => item.id === 'ops')!;
    expect(ops.scope.projectIds).toEqual(['p', 'finance']);
    expect(ops.calendarScope?.projectIds).toEqual(['p']);
    expect(ops.calendarHref).toBe('/ops/calendar/board?projectId=p');
  });
  it('finance-only staff has no invented calendar', async () => {
    const { db, raw } = database([role('staff_ops')]);
    raw.projectStaffPermission.findMany.mockResolvedValue([{ projectId: 'p', departments: ['finance'] }]);
    expect((await loadWorkspaceNavigationContext(db, user())).propertyOptions[0].calendarHref).toBeNull();
  });
  it('effective operating-space rejection cannot be replaced by a membership row', async () => {
    const { db, raw } = database();
    raw.operatingSpace.findMany.mockResolvedValue([{ id: 's' }]);
    mocked.spaceAccess.mockRejectedValue(new OperatingAccessError('No effective workspace access'));
    expect((await loadWorkspaceNavigationContext(db, user())).propertyOptions).toEqual([]);
  });
  it('provider surfaces need current matching membership and a real provider', async () => {
    const roles = [role('provider_member', { scopeType: 'platform', projectId: null, providerId: 'provider' })];
    const { db, raw } = database(roles);
    expect((await loadWorkspaceNavigationContext(db, user(roles))).serviceOptions[0].id).toBe('provider:provider');
    raw.provider.findUnique.mockResolvedValue(null);
    expect((await loadWorkspaceNavigationContext(db, user(roles))).serviceOptions).toEqual([]);
  });
  it('valid MC scope remains explicit and exposes authorized scope names', async () => {
    const roles = [role('mc_member', { organizationId: 'o' })];
    const { db } = database(roles);
    const option = (await loadWorkspaceNavigationContext(db, user(roles))).propertyOptions[0];
    expect(option).toMatchObject({ id: 'mc:p:o', scopeName: 'Project · Organization', href: '/mc?projectId=p&organizationId=o' });
    expect(option.propertiesHref).toContain('#managed-properties');
  });
  it('active stay remains a personal link and does not select work context', async () => {
    const { db } = database();
    const context = await loadWorkspaceNavigationContext(db, user(), 'own-booking');
    expect(context.personalLinks).toEqual([{ href: '/bookings/own-booking/home-space', labelKey: 'workspace.link.stay' }]);
    expect(context.propertyOptions).toEqual([]);
  });
  it('admin control plane is a distinct explicit destination', async () => {
    const { db } = database([], { isAdmin: true });
    const context = await loadWorkspaceNavigationContext(db, user());
    expect(context.controlPlane?.href).toBe('/app/admin');
    expect(context.propertyOptions.every(item => !item.href.startsWith('/app/admin'))).toBe(true);
    expect(context.serviceOptions).toEqual([]);
  });
});
it('MC Calendar targets the canonical board without a redirect that drops spaceId', async () => {
  const roles = [role('mc_member', { organizationId: 'o' })];
  const { db } = database(roles);
  expect((await loadWorkspaceNavigationContext(db, user(roles))).propertyOptions[0].calendarHref)
    .toBe('/ops/calendar/board?projectId=p&organizationId=o&mc=1');
});
it('ops calendar scope carries only units from permitted departments', async () => {
  const { db, raw } = database([role('staff_ops'), role('staff_ops', { projectId: 'finance' })]);
  raw.project.findMany.mockResolvedValue([{ id: 'p', name: 'P' }, { id: 'finance', name: 'Finance' }]);
  raw.projectStaffPermission.findMany.mockResolvedValue([{ projectId: 'p', departments: ['reservations'] }, { projectId: 'finance', departments: ['finance'] }]);
  raw.unit.findMany.mockResolvedValue([{ id: 'u1', projectId: 'p' }, { id: 'u2', projectId: 'finance' }]);
  const result = await loadWorkspaceNavigationContext(db, user());
  expect(result.propertyOptions[0].scope.unitIds).toEqual(['u1', 'u2']);
  expect(result.propertyOptions[0].calendarScope?.unitIds).toEqual(['u1']);
});
