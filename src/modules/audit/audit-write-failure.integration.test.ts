import { describe, it, expect, beforeEach, vi } from 'vitest';
import { db, resetDb, createIdentity } from '@/test/util';

vi.mock('@/lib/prisma', async () => {
  const util = await import('@/test/util');
  return { prisma: util.db };
});

import { logAudit } from './audit';

/**
 * The audit write failing is its own file on purpose.
 *
 * Forcing the failure means spying on a Prisma model delegate, and that spy does
 * not come off cleanly — `mockRestore` and `restoreAllMocks` both leave the
 * delegate replaced, so every later write in the same file silently rejects and
 * the read tests fail for a reason that has nothing to do with them. Vitest
 * isolates by file, so the blast radius stops here.
 */
describe('when the audit trail itself cannot be written', () => {
  let actorId: string;

  beforeEach(async () => {
    await resetDb();
    const actor = await createIdentity({ firstName: 'Ops' });
    actorId = actor.id;
  });

  it('does not fail the action it was recording', async () => {
    // Best-effort by design: a role grant must not fail because the audit
    // insert did. The alternative — refusing the grant — is a worse outcome
    // than an unaudited one, and is a policy call rather than a code one.
    // Restored explicitly: a spy on a Prisma model proxy survives
    // vi.restoreAllMocks(), and a leaked create-rejection silently empties
    // every write in the tests that follow.
    const create = vi.spyOn(db.auditLog, 'create').mockRejectedValueOnce(new Error('disk full'));
    vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(
      logAudit({
        actorIdentityId: actorId,
        action: 'roles:grant',
        entityType: 'Identity',
        entityId: actorId,
      })
    ).resolves.toBeUndefined();

    create.mockRestore();
  });

  it('reports the failure with enough to reconstruct the entry by hand', async () => {
    // A swallowed audit failure is a broken promise nobody can see. It goes
    // through the structured logger, not a bare console.error.
    const create = vi.spyOn(db.auditLog, 'create').mockRejectedValueOnce(new Error('disk full'));
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await logAudit({
      actorIdentityId: actorId,
      action: 'pii:passport_read',
      entityType: 'BookingGuest',
      entityId: 'guest-9',
    });

    create.mockRestore();

    expect(spy).toHaveBeenCalled();
    const record = JSON.parse(spy.mock.calls[0][0] as string);
    expect(record.auditWriteFailed).toBe(true);
    expect(record.action).toBe('pii:passport_read');
    expect(record.entityType).toBe('BookingGuest');
    expect(record.entityId).toBe('guest-9');
  });
});
