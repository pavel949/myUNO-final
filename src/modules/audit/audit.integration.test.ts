import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { db, resetDb, createIdentity } from '@/test/util';

vi.mock('@/lib/prisma', async () => {
  const util = await import('@/test/util');
  return { prisma: util.db };
});

import {
  logAudit,
  getAuditLogForEntity,
  getRecentAuditLog,
  getAuditLogByActor,
} from './audit';

/**
 * The audit module had no tests at all — on the code that answers "who did this,
 * and when". CLAUDE.md promises an entry for every role grant, every config
 * change, every lifecycle transition and every access to a guest's passport.
 * That promise is only as good as this file.
 */
describe('audit trail', () => {
  let actorId: string;

  beforeEach(async () => {
    await resetDb();
    const actor = await createIdentity({ firstName: 'Ops' });
    actorId = actor.id;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('writing an entry', () => {
    it('records who did what, to which entity', async () => {
      await logAudit({
        actorIdentityId: actorId,
        action: 'roles:grant',
        entityType: 'Identity',
        entityId: actorId,
        data: { role: 'staff_ops', scope: 'project' },
      });

      const entries = await getAuditLogForEntity('Identity', actorId);

      expect(entries).toHaveLength(1);
      expect(entries[0].action).toBe('roles:grant');
      expect(entries[0].actorIdentityId).toBe(actorId);
      expect(entries[0].data).toEqual({ role: 'staff_ops', scope: 'project' });
    });

    it('accepts a system action with no actor', async () => {
      // Retention jobs and cron sweeps have no human behind them, and an entry
      // with no actor is more honest than attributing it to whoever ran a deploy.
      await logAudit({
        action: 'retention:purge',
        entityType: 'BookingGuest',
        entityId: 'batch-2026-08',
      });

      const [entry] = await getAuditLogForEntity('BookingGuest', 'batch-2026-08');
      expect(entry.actorIdentityId).toBeNull();
    });

    it('keeps before-and-after context, which is the point of the entry', async () => {
      await logAudit({
        actorIdentityId: actorId,
        action: 'units:update',
        entityType: 'Unit',
        entityId: 'unit-1',
        data: { before: { status: 'draft' }, after: { status: 'live' } },
      });

      const [entry] = await getAuditLogForEntity('Unit', 'unit-1');
      expect(entry.data).toEqual({ before: { status: 'draft' }, after: { status: 'live' } });
    });
  });

  describe('reading the trail', () => {
    beforeEach(async () => {
      await logAudit({
        actorIdentityId: actorId,
        action: 'config:change',
        entityType: 'ConfigParameter',
        entityId: 'booking.hold_minutes',
      });
      await logAudit({
        actorIdentityId: actorId,
        action: 'roles:revoke',
        entityType: 'Identity',
        entityId: 'someone-else',
      });
    });

    it('finds everything done to one entity', async () => {
      const entries = await getAuditLogForEntity('ConfigParameter', 'booking.hold_minutes');

      expect(entries).toHaveLength(1);
      expect(entries[0].action).toBe('config:change');
    });

    it('finds everything done by one actor', async () => {
      // The question asked after someone leaves, or during an investigation.
      const entries = await getAuditLogByActor(actorId);

      expect(entries).toHaveLength(2);
      expect(entries.map((e) => e.action).sort()).toEqual(['config:change', 'roles:revoke']);
    });

    it('returns nothing for an entity with no history, rather than everything', async () => {
      expect(await getAuditLogForEntity('Unit', 'never-touched')).toHaveLength(0);
    });

    it('shows the newest first, and respects the limit', async () => {
      const recent = await getRecentAuditLog(1);

      expect(recent).toHaveLength(1);
      // Both entries above were written in order, so the newest is the revoke.
      expect(recent[0].action).toBe('roles:revoke');
    });

    it('joins the actor so a reader sees a person, not a UUID', async () => {
      const [entry] = await getAuditLogByActor(actorId);

      expect(entry.actor?.firstName).toBe('Ops');
    });
  });

  describe('the trail cannot be rewritten', () => {
    it('refuses an update or a delete, so the module cannot undo its own record', async () => {
      // Enforced by trigger rather than by this module, but it is this module's
      // guarantee, so it is asserted here too.
      await logAudit({
        actorIdentityId: actorId,
        action: 'roles:grant',
        entityType: 'Identity',
        entityId: actorId,
      });
      const [entry] = await getAuditLogByActor(actorId);

      await expect(
        db.auditLog.update({ where: { id: entry.id }, data: { action: 'nothing:happened' } })
      ).rejects.toThrow(/append-only/i);

      await expect(db.auditLog.delete({ where: { id: entry.id } })).rejects.toThrow(/append-only/i);
    });
  });
});
