import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db, resetDb, createIdentity, createProject, createRoleAssignment } from '@/test/util';
vi.mock('@/lib/prisma', async () => ({ prisma: (await import('@/test/util')).db }));
import { canAccessThread } from './statement-thread-access';
import { getThreadsForIdentity, getUnreadCounts } from './thread.service';

beforeEach(resetDb);
describe('stored inquiry participation cannot override inactive identity status', () => {
  it.each(['invited', 'blocked', 'merged', 'deletion_requested'] as const)('denies %s inquirer, staff and admin rows', async status => {
    const project = await createProject();
    const guest = await createIdentity();
    const manager = await createIdentity();
    const admin = await createIdentity({ isAdmin: true });
    await createRoleAssignment({ identityId: manager.id, role: 'staff_ops', scopeType: 'project', projectId: project.id });
    const opportunity = await db.crmOpportunity.create({ data: { identityId: guest.id, projectId: project.id, type: 'rental', title: 'Isolated inquiry fixture', source: 'test' } });
    const id = crypto.randomUUID();
    await db.thread.create({ data: { id, contextType: 'general', contextId: `lead-${opportunity.id}:${id}`, projectId: project.id, participants: { create: [
      { identityId: guest.id, participantRole: 'inquirer' }, { identityId: manager.id, participantRole: 'staff_ops' }, { identityId: admin.id, participantRole: 'admin' },
    ] }, messages: { create: { body: 'Synthetic local inquiry', messageKind: 'system' } } } });
    for (const actor of [guest, manager, admin]) expect(await canAccessThread(db, id, actor.id)).toBe(true);
    await db.identity.updateMany({ where: { id: { in: [guest.id, manager.id, admin.id] } }, data: { status } });
    for (const actor of [guest, manager, admin]) {
      expect(await canAccessThread(db, id, actor.id)).toBe(false);
      expect(await getThreadsForIdentity(db, actor.id)).toEqual([]);
      expect(await getUnreadCounts(db, actor.id)).toEqual({});
    }
    expect(await db.threadParticipant.count({ where: { threadId: id } })).toBe(3);
  });
});
