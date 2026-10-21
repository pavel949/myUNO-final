import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { db, resetDb, createIdentity, createProject, createUnit, createBooking } from '@/test/util';
import { managePlatformAccount, manageWorkspaceAccount, setSuperAdministrator, setWorkspaceAdministrator, workspaceAdministrator } from './administration.service';
import { getScopedOperationalAccess, getOperatingSpaceOverviewAccess } from '@/modules/ops/operating-space-access.service';
import { can } from './permissions';
import { resolveBookingOperationsAccess } from '@/app/libs/bookingOperationsAccess';
import { requestIdentityDeletion } from './retention.service';
import { claimIdentity, generateClaimLink, inviteIdentity } from './people.service';
import { login } from '@/modules/auth/auth';
import { createSessionToken } from '@/modules/auth/session';

let cookie: string | undefined;
vi.mock('react', async original => ({ ...(await original<typeof import('react')>()), cache: <T>(fn: T) => fn }));
vi.mock('next/headers', () => ({ cookies: async () => ({ get: () => cookie ? { value: cookie } : undefined }) }));
import { getSessionUser } from '@/lib/session';
import { PATCH } from '@/app/api/ops/spaces/[spaceId]/people/[identityId]/route';
import { PUT as appoint } from '@/app/api/ops/spaces/[spaceId]/people/[identityId]/administrator/route';
import { PATCH as globalEdit } from '@/app/api/admin/people/[identityId]/manage/route';

async function fixture() {
  const root = await createIdentity({ isAdmin: true });
  const founder = await db.identity.update({ where: { id: root.id }, data: {
    isSuperAdmin: true, emailVerifiedAt: new Date(), hashedPassword: await bcrypt.hash('TestPassword1', 4),
  } });
  const managerIdentity = await createIdentity();
  const manager = await db.identity.update({ where: { id: managerIdentity.id }, data: { hashedPassword: founder.hashedPassword } });
  const employee = await createIdentity();
  const legacy = await createIdentity({ isAdmin: true });
  const project = await createProject();
  const unit = await createUnit({ projectId: project.id });
  const outside = await createUnit({ projectId: project.id });
  const org = await db.organization.create({ data: { name: 'Test operator', orgType: 'management_company',
    contactEmail: 'operator@example.test', contactPhone: '+66000000000' } });
  await db.projectOrganizationRole.create({ data: { projectId: project.id, organizationId: org.id, roleKey: 'operator', provenance: 'verified' } });
  const space = await db.operatingSpace.create({ data: { key: 'test-scope', name: 'Test scope', organizationId: org.id } });
  const otherSpace = await db.operatingSpace.create({ data: { key: 'other-scope', name: 'Other scope', organizationId: org.id } });
  await db.operatingSpaceUnit.create({ data: { operatingSpaceId: space.id, unitId: unit.id, startsOn: new Date(0) } });
  await db.operatingSpaceUnit.create({ data: { operatingSpaceId: otherSpace.id, unitId: outside.id, startsOn: new Date(0) } });
  const member = await db.operatingSpaceMember.create({ data: { operatingSpaceId: space.id, identityId: employee.id } });
  const otherMember = await db.operatingSpaceMember.create({ data: { operatingSpaceId: otherSpace.id, identityId: employee.id } });
  const managerGrant = await setWorkspaceAdministrator(db, founder.id, space.id, manager.id, { enabled: true, expectedUpdatedAt: null });
  return { founder, manager, employee, legacy, project, unit, outside, org, space, otherSpace, member, otherMember, managerGrant };
}
const at = (value: { updatedAt: Date }) => value.updatedAt.toISOString();
const hash = (value: string) => crypto.createHash('sha256').update(value).digest('hex');
const request = (body: unknown) => new NextRequest('http://localhost/api/test', {
  method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
});

describe('Protected superadministrator and bounded workspace administration', () => {
  beforeEach(async () => { await resetDb(); cookie = undefined; });

  it('creates no global role or staff grant when appointing a local administrator', async () => {
    const f = await fixture();
    const manager = await db.identity.findUniqueOrThrow({ where: { id: f.manager.id } });
    expect(manager.isAdmin).toBe(false); expect(manager.isSuperAdmin).toBe(false);
    expect(await db.roleAssignment.count({ where: { identityId: manager.id } })).toBe(0);
    for (const action of ['people:view', 'people:edit', 'admin:edit_configuration', 'admin:grant_revoke_roles'])
      expect(await can({ identity: manager, action, resource: { resourceType: 'platform' } }, db)).toBe(false);
    const access = await getScopedOperationalAccess(db, manager.id, f.space.id, 'manage_reservations', ['reservations']);
    expect(access.unitIds).toEqual([f.unit.id]); expect(access.isAdmin).toBe(false);
    const overview = await getOperatingSpaceOverviewAccess(db, manager.id, f.space.id);
    expect(overview.byCapability.view_finance).toEqual([f.unit.id]);
    expect(await can({ identity: manager, action: 'stays:approve_decline_booking_requests', resource: { projectId: f.project.id, unitId: f.unit.id } }, db)).toBe(true);
    expect(await can({ identity: manager, action: 'stays:approve_decline_booking_requests', resource: { projectId: f.project.id, unitId: f.outside.id } }, db)).toBe(false);
    const operator = { identityId: manager.id, email: manager.email, firstName: manager.firstName, lastName: manager.lastName, isAdmin: false, roles: [] };
    expect((await resolveBookingOperationsAccess(operator, { projectId: f.project.id, unitId: f.unit.id }, db)).canManageReservations).toBe(true);
    expect((await resolveBookingOperationsAccess(operator, { projectId: f.project.id, unitId: f.outside.id }, db)).canManageReservations).toBe(false);
  });

  it('denies another workspace even inside the same organization and project', async () => {
    const f = await fixture();
    await expect(getScopedOperationalAccess(db, f.manager.id, f.otherSpace.id, 'manage_tasks', ['housekeeping'])).rejects.toThrow('capability required');
    await expect(manageWorkspaceAccount(db, f.manager.id, f.otherSpace.id, f.employee.id,
      { action: 'disable', expectedUpdatedAt: at(f.otherMember) })).rejects.toThrow('Workspace administration required');
    expect((await db.operatingSpaceMember.findUniqueOrThrow({ where: { id: f.otherMember.id } })).active).toBe(true);
  });

  it('omits shared physical units completely and denies direct booking/finance authority on them', async () => {
    const f = await fixture();
    await db.operatingSpaceUnit.create({ data: { operatingSpaceId: f.otherSpace.id, unitId: f.unit.id, startsOn: new Date(0) } });
    expect((await getScopedOperationalAccess(db, f.manager.id, f.space.id, 'manage_reservations', ['reservations'])).unitIds).toEqual([]);
    const manager = await db.identity.findUniqueOrThrow({ where: { id: f.manager.id } });
    for (const action of ['stays:view_booking', 'stays:approve_decline_booking_requests', 'money:record_costs_on_units']) {
      expect(await can({ identity: manager, action, resource: { projectId: f.project.id, unitId: f.unit.id } }, db)).toBe(false);
    }
    const access = await resolveBookingOperationsAccess({ identityId: manager.id, isAdmin: false, roles: [] } as never,
      { projectId: f.project.id, unitId: f.unit.id }, db);
    expect(access.canRecordMoney).toBe(false); expect(access.canManageReservations).toBe(false);
  });

  it('blocks foreign reservation-group history independently of current attachments', async () => {
    const f = await fixture();
    const group = await db.reservationGroup.create({ data: { guestIdentityId: f.employee.id, operatingSpaceId: f.otherSpace.id } });
    const booking = await createBooking({ projectId: f.project.id, unitId: f.unit.id, guestIdentityId: f.employee.id });
    await db.booking.update({ where: { id: booking.id }, data: { reservationGroupId: group.id } });
    expect((await getScopedOperationalAccess(db, f.manager.id, f.space.id, 'view_calendar', ['reservations'])).unitIds).toEqual([]);
    const manager = await db.identity.findUniqueOrThrow({ where: { id: f.manager.id } });
    expect(await can({ identity: manager, action: 'money:record_costs_on_units', resource: { projectId: f.project.id, unitId: f.unit.id } }, db)).toBe(false);
  });

  it('treats expired and future foreign attachments consistently while blocking current overlap', async () => {
    const f = await fixture();
    const attachment = await db.operatingSpaceUnit.create({ data: { operatingSpaceId: f.otherSpace.id, unitId: f.unit.id,
      startsOn: new Date(Date.now() + 86400000) } });
    const ids = async () => (await getScopedOperationalAccess(db, f.manager.id, f.space.id, 'manage_tasks', ['housekeeping'])).unitIds;
    expect(await ids()).toEqual([f.unit.id]);
    await db.operatingSpaceUnit.update({ where: { id: attachment.id }, data: { startsOn: new Date(0), endsOn: new Date(Date.now() - 1000) } });
    expect(await ids()).toEqual([f.unit.id]);
    await db.operatingSpaceUnit.update({ where: { id: attachment.id }, data: { endsOn: null } });
    expect(await ids()).toEqual([]);
  });

  it.each([['unblock'], ['block'], ['profile'], {}, null, 1].map(action => ({ action })))('rejects non-string global/local actions without changing records: %j', async ({ action }) => {
    const f = await fixture();
    await expect(managePlatformAccount(db, f.founder.id, f.employee.id, { action })).rejects.toMatchObject({ status: 400 });
    await expect(manageWorkspaceAccount(db, f.manager.id, f.space.id, f.employee.id, { action, expectedUpdatedAt: at(f.member) })).rejects.toMatchObject({ status: 400 });
    expect(await db.identity.findUniqueOrThrow({ where: { id: f.employee.id } })).toEqual(f.employee);
    expect(await db.operatingSpaceMember.findUniqueOrThrow({ where: { id: f.member.id } })).toEqual(f.member);
  });

  it('rejects pre-existing work roles rather than silently granting an allegedly isolated administrator', async () => {
    const f = await fixture();
    await db.roleAssignment.create({ data: { identityId: f.manager.id, role: 'staff_ops', scopeType: 'project', projectId: f.project.id } });
    await expect(setWorkspaceAdministrator(db, f.founder.id, f.space.id, f.manager.id,
      { enabled: true, expectedUpdatedAt: f.managerGrant.updatedAt })).rejects.toThrow('Review existing work roles');
  });

  it('rechecks attached inventory and current verified mandate rather than granting the whole project', async () => {
    const f = await fixture();
    await db.projectOrganizationRole.updateMany({ where: { projectId: f.project.id }, data: { provenance: 'unverified' } });
    expect((await getScopedOperationalAccess(db, f.manager.id, f.space.id, 'manage_tasks', ['housekeeping'])).unitIds).toEqual([]);
  });

  it('edits local display names and disables only the selected membership with atomic audit', async () => {
    const f = await fixture();
    const local = await manageWorkspaceAccount(db, f.manager.id, f.space.id, f.employee.id,
      { action: 'profile', displayName: 'Reception colleague', expectedUpdatedAt: at(f.member) });
    expect(local.displayName).toBe('Reception colleague');
    const disabled = await manageWorkspaceAccount(db, f.manager.id, f.space.id, f.employee.id,
      { action: 'disable', expectedUpdatedAt: local.updatedAt });
    expect(disabled.active).toBe(false);
    expect((await db.identity.findUniqueOrThrow({ where: { id: f.employee.id } })).status).toBe('active');
    expect((await db.identity.findUniqueOrThrow({ where: { id: f.employee.id } })).firstName).toBe(f.employee.firstName);
    expect((await db.operatingSpaceMember.findUniqueOrThrow({ where: { id: f.otherMember.id } })).active).toBe(true);
    expect(await db.auditLog.count({ where: { actorIdentityId: f.manager.id, entityId: f.employee.id } })).toBe(2);
  });

  it('cannot target nonmembers, globally edit anyone, or globally block the founder', async () => {
    const f = await fixture();
    await expect(manageWorkspaceAccount(db, f.manager.id, f.space.id, f.founder.id,
      { action: 'disable', expectedUpdatedAt: null })).rejects.toThrow();
    await expect(managePlatformAccount(db, f.manager.id, f.employee.id, { action: 'block' })).rejects.toThrow('Platform administration required');
    await expect(managePlatformAccount(db, f.legacy.id, f.founder.id, { action: 'block' })).rejects.toThrow('Protected superadministrator');
    await db.operatingSpaceMember.create({ data: { operatingSpaceId: f.space.id, identityId: f.founder.id } });
    await expect(manageWorkspaceAccount(db, f.manager.id, f.space.id, f.founder.id,
      { action: 'disable', expectedUpdatedAt: null })).rejects.toThrow('Protected administrative account');
  });

  it('rejects injected privileges and administrative appointments by scoped and legacy admins', async () => {
    const f = await fixture();
    await expect(manageWorkspaceAccount(db, f.manager.id, f.space.id, f.employee.id,
      { action: 'profile', displayName: 'X', isAdmin: true, expectedUpdatedAt: at(f.member) })).rejects.toThrow('Unexpected');
    await expect(setWorkspaceAdministrator(db, f.manager.id, f.space.id, f.employee.id,
      { enabled: true, expectedUpdatedAt: at(f.member) })).rejects.toThrow('Only a protected');
    await expect(setSuperAdministrator(db, f.manager.id, f.manager.id,
      { enabled: true, expectedUpdatedAt: at(f.manager) })).rejects.toThrow('Protected superadministrator required');
    await expect(setSuperAdministrator(db, f.legacy.id, f.legacy.id,
      { enabled: true, expectedUpdatedAt: at(f.legacy) })).rejects.toThrow('Protected superadministrator required');
  });

  it('protects self-lockout and sole superadmin even when legacy global admins remain', async () => {
    const f = await fixture();
    await expect(managePlatformAccount(db, f.founder.id, f.founder.id, { action: 'block' })).rejects.toThrow('own administrative');
    await expect(setSuperAdministrator(db, f.founder.id, f.founder.id,
      { enabled: false, expectedUpdatedAt: at(f.founder) })).rejects.toThrow('own sole superadministrator');
    await expect(requestIdentityDeletion(db, f.founder.id)).rejects.toThrow('self-deletion');
    await expect(db.identity.update({ where: { id: f.founder.id }, data: { status: 'blocked' } })).rejects.toThrow();
    await expect(db.identity.update({ where: { id: f.founder.id }, data: { isSuperAdmin: false } })).rejects.toThrow('last active superadministrator');
    await expect(db.identity.delete({ where: { id: f.founder.id } })).rejects.toThrow();
  });

  it('never automatically promotes a legacy administrator during the deliberate pre-bootstrap interval', async () => {
    const legacy = await createIdentity({ isAdmin: true });
    await expect(setSuperAdministrator(db, legacy.id, legacy.id,
      { enabled: true, expectedUpdatedAt: at(legacy) })).rejects.toThrow('Protected superadministrator required');
    expect((await db.identity.findUniqueOrThrow({ where: { id: legacy.id } })).isSuperAdmin).toBe(false);
  });

  it('refuses creating a second superadministrator through the API or database', async () => {
    const f = await fixture();
    await expect(setSuperAdministrator(db, f.founder.id, f.legacy.id,
      { enabled: true, expectedUpdatedAt: at(f.legacy) })).rejects.toThrow('sole superadministrator');
    await expect(db.identity.update({ where: { id: f.legacy.id }, data: { isSuperAdmin: true } })).rejects.toThrow();
    expect(await db.identity.count({ where: { isSuperAdmin: true } })).toBe(1);
    await setSuperAdministrator(db, f.founder.id, f.founder.id, { enabled: true, expectedUpdatedAt: at(f.founder) });
    expect(await db.identity.findUniqueOrThrow({ where: { id: f.founder.id } })).toEqual(f.founder);
  });

  it('atomically permits only one of two concurrent bootstrap candidates in an isolated test database', async () => {
    const one = await createIdentity({ isAdmin: true }); const two = await createIdentity({ isAdmin: true });
    const results = await Promise.allSettled([
      db.identity.update({ where: { id: one.id }, data: { isSuperAdmin: true } }),
      db.identity.update({ where: { id: two.id }, data: { isSuperAdmin: true } }),
    ]);
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
    expect(await db.identity.count({ where: { status: 'active', isSuperAdmin: true } })).toBe(1);
  });

  it('supports a reviewed offline recovery transaction while rejecting a transaction that leaves no owner', async () => {
    const f = await fixture();
    await expect(db.$transaction(async tx => {
      await tx.identity.update({ where: { id: f.founder.id }, data: { isSuperAdmin: false } });
      await tx.$executeRaw`SET CONSTRAINTS protect_last_platform_administrator IMMEDIATE`;
    })).rejects.toThrow('last active superadministrator');
    await db.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(724682190001::bigint)`;
      await tx.identity.update({ where: { id: f.founder.id }, data: { isSuperAdmin: false } });
      await tx.identity.update({ where: { id: f.legacy.id }, data: { isSuperAdmin: true } });
      await tx.auditLog.create({ data: { actorIdentityId: f.founder.id, entityType: 'Identity', entityId: f.legacy.id,
        action: 'administration.test_offline_recovery', data: { previousIdentityId: f.founder.id } } });
    });
    expect(await db.identity.count({ where: { isSuperAdmin: true } })).toBe(1);
    expect((await db.identity.findUniqueOrThrow({ where: { id: f.legacy.id } })).isSuperAdmin).toBe(true);
  });

  it('cannot spoof the last-owner invariant with a session-local shadow identity table', async () => {
    const f = await fixture();
    await expect(db.$transaction(async tx => {
      await tx.$executeRaw`CREATE TEMP TABLE identity (id text, status text, is_super_admin boolean) ON COMMIT DROP`;
      await tx.$executeRaw`INSERT INTO pg_temp.identity VALUES ('fake-surviving-owner', 'active', true)`;
      await tx.identity.update({ where: { id: f.founder.id }, data: { isSuperAdmin: false } });
      await tx.$executeRaw`SET CONSTRAINTS protect_last_platform_administrator IMMEDIATE`;
    })).rejects.toThrow('last active superadministrator');
    expect((await db.identity.findUniqueOrThrow({ where: { id: f.founder.id } })).isSuperAdmin).toBe(true);
  });

  it('does not acquire the administrative mutex for unrelated profile writes', async () => {
    const f = await fixture();
    await db.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(724682190001::bigint)`;
      await db.$transaction(async other => {
        await other.$executeRaw`SET LOCAL lock_timeout = '500ms'`;
        await other.$executeRaw`SET CONSTRAINTS protect_last_platform_administrator IMMEDIATE`;
        await other.identity.update({ where: { id: f.employee.id }, data: { firstName: 'Independent' } });
      });
    });
    expect((await db.identity.findUniqueOrThrow({ where: { id: f.employee.id } })).firstName).toBe('Independent');
  });

  it('lets the founder edit and disable other admins and leaves no reusable old session after unblock', async () => {
    const f = await fixture();
    cookie = createSessionToken(f.manager.id, null);
    expect((await getSessionUser())?.identityId).toBe(f.manager.id);
    const edited = await managePlatformAccount(db, f.founder.id, f.manager.id, { action: 'profile', firstName: 'Updated',
      lastName: 'Colleague', preferredLocale: 'en', expectedUpdatedAt: at(f.manager) });
    expect(edited.firstName).toBe('Updated');
    await managePlatformAccount(db, f.founder.id, f.manager.id, { action: 'block' });
    expect(await getSessionUser()).toBeNull();
    await expect(workspaceAdministrator(db, f.manager.id, f.space.id)).rejects.toThrow('Active account');
    await managePlatformAccount(db, f.founder.id, f.manager.id, { action: 'unblock' });
    expect(await getSessionUser()).toBeNull();
    const current = await db.identity.findUniqueOrThrow({ where: { id: f.manager.id } });
    cookie = createSessionToken(current.id, current.sessionsValidFrom!.getTime());
    expect((await getSessionUser())?.identityId).toBe(current.id);
  });

  it('revokes local administration immediately without elevating or disabling the global identity', async () => {
    const f = await fixture();
    await setWorkspaceAdministrator(db, f.founder.id, f.space.id, f.manager.id,
      { enabled: false, expectedUpdatedAt: f.managerGrant.updatedAt });
    await expect(workspaceAdministrator(db, f.manager.id, f.space.id)).rejects.toThrow();
    await expect(getScopedOperationalAccess(db, f.manager.id, f.space.id, 'manage_tasks', ['housekeeping'])).rejects.toThrow();
    expect((await db.identity.findUniqueOrThrow({ where: { id: f.manager.id } })).status).toBe('active');
  });

  it('can revoke a workspace administrator after global blocking without temporarily restoring login', async () => {
    const f = await fixture();
    await managePlatformAccount(db, f.founder.id, f.manager.id, { action: 'block' });
    const revoked = await setWorkspaceAdministrator(db, f.founder.id, f.space.id, f.manager.id,
      { enabled: false, expectedUpdatedAt: f.managerGrant.updatedAt });
    expect(revoked.isAdministrator).toBe(false);
    expect((await db.identity.findUniqueOrThrow({ where: { id: f.manager.id } })).status).toBe('blocked');
  });

  it('rejects stale edits and rolls changes back when the audit writer fails', async () => {
    const f = await fixture();
    await expect(manageWorkspaceAccount(db, f.manager.id, f.space.id, f.employee.id,
      { action: 'disable', expectedUpdatedAt: new Date(0).toISOString() })).rejects.toThrow('changed');
    const failing = db.$extends({ query: { auditLog: { async create() { throw new Error('TEST_AUDIT_FAILURE'); } } } }) as unknown as typeof db;
    await expect(managePlatformAccount(failing, f.founder.id, f.employee.id, { action: 'block' })).rejects.toThrow('TEST_AUDIT_FAILURE');
    const employee = await db.identity.findUniqueOrThrow({ where: { id: f.employee.id } });
    expect(employee.status).toBe('active'); expect(employee.sessionsValidFrom).toBeNull();
  });

  it('does not activate or appoint an invited account with missing, unknown or expired claim authority', async () => {
    const f = await fixture();
    const invited = await inviteIdentity(db, { email: 'unclaimed@example.test', firstName: 'Unclaimed', lastName: 'Recipient' });
    for (const tokenHash of ['', hash('not-an-issued-token')]) {
      await expect(claimIdentity(db, { tokenHash, password: 'ChosenPassword1' })).rejects.toThrow('Invalid or expired');
    }
    const token = await generateClaimLink(db, { identityId: invited.identity.id });
    await db.oneTimeToken.updateMany({ where: { identityId: invited.identity.id }, data: { expiresAt: new Date(0) } });
    await expect(claimIdentity(db, { tokenHash: hash(token), password: 'ChosenPassword1' })).rejects.toThrow('expired');
    await expect(setWorkspaceAdministrator(db, f.founder.id, f.space.id, invited.identity.id,
      { enabled: true, expectedUpdatedAt: null })).rejects.toThrow('active password account');
    const unchanged = await db.identity.findUniqueOrThrow({ where: { id: invited.identity.id } });
    expect(unchanged.status).toBe('invited'); expect(unchanged.hashedPassword).toBeNull();
    expect(unchanged.isAdmin).toBe(false); expect(unchanged.isSuperAdmin).toBe(false);
    expect(await db.operatingSpaceMember.count({ where: { identityId: invited.identity.id } })).toBe(0);
    expect(await db.auditLog.count({ where: { entityId: invited.identity.id, action: 'people.account_claimed' } })).toBe(0);
  });

  it('bounds local profile input and rolls back local disable if its audit cannot commit', async () => {
    const f = await fixture();
    for (const displayName of ['', 'x'.repeat(101)]) {
      await expect(manageWorkspaceAccount(db, f.manager.id, f.space.id, f.employee.id,
        { action: 'profile', displayName, expectedUpdatedAt: at(f.member) })).rejects.toThrow('between 1 and 100');
    }
    const failing = db.$extends({ query: { auditLog: { async create() { throw new Error('TEST_LOCAL_AUDIT_FAILURE'); } } } }) as unknown as typeof db;
    await expect(manageWorkspaceAccount(failing, f.manager.id, f.space.id, f.employee.id,
      { action: 'disable', expectedUpdatedAt: at(f.member) })).rejects.toThrow('TEST_LOCAL_AUDIT_FAILURE');
    const member = await db.operatingSpaceMember.findUniqueOrThrow({ where: { id: f.member.id } });
    expect(member.active).toBe(true); expect(member.displayName).toBeNull();
    expect(member.updatedAt.toISOString()).toBe(at(f.member));
    expect(await db.auditLog.count({ where: { entityId: f.employee.id } })).toBe(0);
  });

  it('supports recipient-chosen email/password login and invitation reuse without privilege or credential changes', async () => {
    const f = await fixture();
    const invitation = await inviteIdentity(db, { email: 'New.Colleague@Example.test ', firstName: 'New', lastName: 'Colleague' });
    expect(invitation.identity.hashedPassword).toBeNull();
    expect(invitation.identity.isAdmin).toBe(false); expect(invitation.identity.isSuperAdmin).toBe(false);
    const reused = await inviteIdentity(db, { email: 'new.colleague@example.test', firstName: 'Other', lastName: 'Name' });
    expect(reused.created).toBe(false); expect(reused.identity.id).toBe(invitation.identity.id);
    const oldToken = await generateClaimLink(db, { identityId: reused.identity.id });
    const token = await generateClaimLink(db, { identityId: reused.identity.id });
    await expect(claimIdentity(db, { tokenHash: hash(oldToken), password: 'ChosenPassword1' })).rejects.toThrow('already been used');
    const claimed = await claimIdentity(db, { tokenHash: hash(token), password: 'ChosenPassword1' });
    expect((await login({ email: claimed.email!, password: 'ChosenPassword1' })).id).toBe(claimed.id);
    await expect(claimIdentity(db, { tokenHash: hash(token), password: 'AttackerPassword1' })).rejects.toThrow('already been used');
    const again = await inviteIdentity(db, { email: claimed.email!, firstName: 'Overwrite', lastName: 'Denied' });
    expect(again.alreadyActive).toBe(true); expect(again.identity.firstName).toBe('New');
    expect(again.identity.hashedPassword).toBe(claimed.hashedPassword);
    const grant = await setWorkspaceAdministrator(db, f.founder.id, f.space.id, claimed.id, { enabled: true, expectedUpdatedAt: null });
    expect(grant.isAdministrator).toBe(true);
    await managePlatformAccount(db, f.founder.id, claimed.id, { action: 'block' });
    await expect(login({ email: claimed.email!, password: 'ChosenPassword1' })).rejects.toThrow('blocked');
  });

  it('checks route-level authentication, scope, forbidden elevation and safe response fields', async () => {
    const f = await fixture(); const params = Promise.resolve({ spaceId: f.space.id, identityId: f.employee.id });
    const body = { action: 'disable', expectedUpdatedAt: at(f.member) };
    expect((await PATCH(request(body), { params })).status).toBe(401);
    cookie = createSessionToken(f.manager.id, null);
    expect((await globalEdit(request({ action: 'block' }), { params: Promise.resolve({ identityId: f.founder.id }) })).status).toBe(403);
    expect((await appoint(request({ enabled: true, expectedUpdatedAt: at(f.member) }), { params })).status).toBe(403);
    expect((await PATCH(request(body), { params: Promise.resolve({ spaceId: f.otherSpace.id, identityId: f.employee.id }) })).status).toBe(403);
    const response = await PATCH(request(body), { params });
    expect(response.status).toBe(200);
    const result = await response.text();
    expect(result).not.toContain('hashedPassword'); expect(result).not.toContain('email'); expect(result).not.toContain('sessionsValidFrom');
  });
});
