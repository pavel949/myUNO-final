import { describe, it, expect, beforeEach } from 'vitest';
import { db, resetDb, createIdentity, createProject, createUnit } from '@/test/util';
import { registerPurchaseInterest } from './buyer-interest.service';

/**
 * The buyer journey's "request due diligence" step. Doc 07 defers the buyer
 * surfaces to phase two; the founder overrode that, so what is built is the
 * part the platform can honestly serve — a signal into the funnel an admin
 * already watches, and a thread so a person answers.
 */
describe('someone saying they are thinking about buying', () => {
  let buyerId: string;
  let adminId: string;
  let unitId: string;

  beforeEach(async () => {
    await resetDb();
    const buyer = await createIdentity({ firstName: 'Anna', lastName: 'Petrova' });
    buyerId = buyer.id;
    const admin = await createIdentity({ isAdmin: true });
    adminId = admin.id;
    const project = await createProject();
    const unit = await createUnit({ projectId: project.id, name: 'B-707' });
    unitId = unit.id;
  });

  it('raises a signal so the interest lands in the funnel, not just an inbox', async () => {
    await registerPurchaseInterest(db, {
      identityId: buyerId,
      message: 'What would a two-bedroom cost?',
    });

    const signals = await db.buyerSignal.findMany({ where: { identityId: buyerId } });
    expect(signals).toHaveLength(1);
    expect(signals[0].signalKey).toBe('direct_inquiry');
    expect(signals[0].status).toBe('open');
  });

  it('opens a thread the buyer and the admins are both in', async () => {
    const { threadId } = await registerPurchaseInterest(db, {
      identityId: buyerId,
      message: 'Interested in buying.',
    });

    const participants = await db.threadParticipant.findMany({ where: { threadId } });
    expect(participants.map((p) => p.identityId).sort()).toEqual([buyerId, adminId].sort());
  });

  it('carries the message and the home they asked about', async () => {
    const { threadId } = await registerPurchaseInterest(db, {
      identityId: buyerId,
      unitId,
      message: 'Is this one available to buy?',
    });

    const messages = await db.message.findMany({ where: { threadId } });
    expect(messages).toHaveLength(1);
    expect(messages[0].body).toContain('B-707');
    expect(messages[0].body).toContain('Is this one available to buy?');
  });

  it('starts a fresh thread each time rather than reopening a closed one', async () => {
    const first = await registerPurchaseInterest(db, { identityId: buyerId, message: 'One.' });
    const second = await registerPurchaseInterest(db, { identityId: buyerId, message: 'Two.' });

    expect(second.threadId).not.toBe(first.threadId);
  });

  it('keeps one signal per person rather than piling them up', async () => {
    // The funnel is a list of people to talk to, not a list of messages. Doc 13
    // dedupes on identity + key for exactly this reason.
    await registerPurchaseInterest(db, { identityId: buyerId, message: 'One.' });
    await registerPurchaseInterest(db, { identityId: buyerId, message: 'Two.' });

    expect(await db.buyerSignal.count({ where: { identityId: buyerId } })).toBe(1);
  });

  it('still records the enquiry when the home no longer exists', async () => {
    // A stale link should not lose somebody who wants to buy. It becomes a
    // general enquiry instead of an error.
    const { threadId } = await registerPurchaseInterest(db, {
      identityId: buyerId,
      unitId: '00000000-0000-0000-0000-000000000000',
      message: 'Still interested.',
    });

    expect(threadId).toBeTruthy();
    const messages = await db.message.findMany({ where: { threadId } });
    expect(messages[0].body).toContain('Still interested.');
  });

  it('refuses an empty message', async () => {
    await expect(
      registerPurchaseInterest(db, { identityId: buyerId, message: '   ' })
    ).rejects.toThrow(/message is required/i);
  });

  it('refuses a message long enough to be an attack rather than a question', async () => {
    await expect(
      registerPurchaseInterest(db, { identityId: buyerId, message: 'x'.repeat(5000) })
    ).rejects.toThrow(/too long/i);
  });

  it('fails loudly when there is no admin to receive it', async () => {
    // Silently accepting an enquiry nobody will ever see is worse than an error
    // the person can act on.
    await db.identity.update({ where: { id: adminId }, data: { isAdmin: false } });

    await expect(
      registerPurchaseInterest(db, { identityId: buyerId, message: 'Hello?' })
    ).rejects.toThrow(/no_admin_available/);
  });
});
