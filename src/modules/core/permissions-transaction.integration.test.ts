import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db, resetDb, createIdentity, createProject, createRoleAssignment } from '@/test/util';
vi.mock('@/lib/prisma', async () => ({ prisma: (await import('@/test/util')).db }));
import { can } from './permissions';

beforeEach(resetDb);
describe('reconciled permissions use the supplied transaction view', () => {
  it('sees an uncommitted role revocation and denies a transaction-local non-active admin', async () => {
    const project = await createProject();
    const manager = await createIdentity();
    const role = await createRoleAssignment({ identityId: manager.id, role: 'staff_ops', scopeType: 'project', projectId: project.id });
    const context = { identity: manager, action: 'units:create', requiredAccess: 'allow' as const, resource: { projectId: project.id } };
    expect(await can(context)).toBe(true);
    await db.$transaction(async tx => {
      await tx.roleAssignment.update({ where: { id: role.id }, data: { status: 'revoked' } });
      expect(await can(context, tx)).toBe(false);
      expect(await can(context)).toBe(true);
    });
    expect(await can(context)).toBe(false);
    const admin = await createIdentity({ isAdmin: true });
    await db.$transaction(async tx => {
      const inactive = await tx.identity.update({ where: { id: admin.id }, data: { status: 'invited' } });
      expect(await can({ identity: inactive, action: 'admin:view_audit_log' }, tx)).toBe(false);
    });
  });
});
