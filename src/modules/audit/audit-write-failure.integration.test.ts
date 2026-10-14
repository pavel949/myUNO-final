import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import { resetDb, createIdentity } from '@/test/util';

// This file gets its own Prisma client. The shared test client is cached on
// globalThis and lives for the whole single-fork run, so a spy left on its model
// delegate would break every later file that writes through it (the key register
// service did, in CI). A private client keeps the damage inside this file.
const own = vi.hoisted(() => ({ client: undefined as import('@prisma/client').PrismaClient | undefined }));
vi.mock('@/lib/prisma', async () => {
  const { PrismaClient } = await import('@prisma/client');
  own.client = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } });
  return { prisma: own.client };
});

import { logAudit } from './audit';

const db = new Proxy({} as import('@prisma/client').PrismaClient, {
  get: (_target, key) => (own.client as never)[key as never],
});

afterAll(async () => {
  await own.client?.$disconnect();
});

/**
 * The audit write failing is its own file on purpose.
 *
 * Forcing the failure means spying on a Prisma model delegate, and that spy does
 * not come off cleanly — `mockRestore` and `restoreAllMocks` both leave the
 * delegate replaced, so every later write in the same file silently rejects and
 * the read tests fail for a reason that has nothing to do with them. The
 * file runs on a private client (see above), so the blast radius stops here.
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
