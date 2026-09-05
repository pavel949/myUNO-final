import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { db as prisma, resetDb, createIdentity } from '@/test/util';
import { getAccountProfile, requestAccountDeletion, cancelAccountDeletion } from './account.service';

/**
 * PDPA deletion (doc 12 §2): a person can start and reverse their own
 * grace period. Actual anonymization happens later, in
 * retention.service's anonymizeDeletedIdentities, once the grace period
 * has passed — that job is untouched here.
 */
describe('requestAccountDeletion / cancelAccountDeletion', () => {
  beforeEach(async () => {
    await resetDb();
  });

  afterEach(async () => {
    await resetDb();
  });

  it('moves an active identity to deletion_requested and logs it', async () => {
    const identity = await createIdentity({ firstName: 'Anna' });

    await requestAccountDeletion(prisma, identity.id);

    const updated = await prisma.identity.findUnique({ where: { id: identity.id } });
    expect(updated?.status).toBe('deletion_requested');

    const entry = await prisma.auditLog.findFirst({
      where: { entityType: 'identity', entityId: identity.id, action: 'identity_deletion_requested' },
    });
    expect(entry?.actorIdentityId).toBe(identity.id);
  });

  it('reflects the pending request in getAccountProfile', async () => {
    const identity = await createIdentity({ firstName: 'Anna' });
    await requestAccountDeletion(prisma, identity.id);

    const profile = await getAccountProfile(prisma, identity.id);
    expect(profile?.deletionRequested).toBe(true);
  });

  it('refuses to delete a merged identity — it is not this person\'s record to remove twice', async () => {
    const identity = await createIdentity({ firstName: 'Duplicate' });
    await prisma.identity.update({ where: { id: identity.id }, data: { status: 'merged' } });

    await expect(requestAccountDeletion(prisma, identity.id)).rejects.toThrow();
  });

  it('cancels a pending request back to active, within the grace period', async () => {
    const identity = await createIdentity({ firstName: 'Anna' });
    await requestAccountDeletion(prisma, identity.id);

    await cancelAccountDeletion(prisma, identity.id);

    const updated = await prisma.identity.findUnique({ where: { id: identity.id } });
    expect(updated?.status).toBe('active');

    const entry = await prisma.auditLog.findFirst({
      where: { entityType: 'identity', entityId: identity.id, action: 'identity_deletion_cancelled' },
    });
    expect(entry).toBeTruthy();
  });

  it('refuses to cancel when there is no pending request', async () => {
    const identity = await createIdentity({ firstName: 'Anna' });
    await expect(cancelAccountDeletion(prisma, identity.id)).rejects.toThrow();
  });
});
