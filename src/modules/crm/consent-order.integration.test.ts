import { beforeEach, describe, expect, it } from 'vitest';
import { db, resetDb, createIdentity } from '@/test/util';
import {
  denyConsent,
  getConsentHistory,
  getConsentStatus,
  grantConsent,
  hasConsent,
  withdrawConsent,
} from './consent.service';
import { capturePublicLead } from './crm.service';

// Explicit timestamps force the collision/clock-regression case instead of
// relying on a fast machine to happen to issue two writes in one millisecond.
describe('consent append ordering', () => {
  beforeEach(resetDb);

  it('orders grant, withdrawal and regrant within the same transaction', async () => {
    const identity = await createIdentity();
    const input = { identityId: identity.id, purpose: 'marketing' as const, channel: 'account' };
    const rows = await db.$transaction(async (tx) => [
      await grantConsent(tx, input),
      await withdrawConsent(tx, input),
      await grantConsent(tx, input),
    ]);
    expect(rows[1].capturedAt.getTime()).toBeGreaterThan(rows[0].capturedAt.getTime());
    expect(rows[2].capturedAt.getTime()).toBeGreaterThan(rows[1].capturedAt.getTime());
    expect(await hasConsent(db, identity.id, 'marketing')).toBe(true);
    expect((await getConsentHistory(db, identity.id)).map((row) => row.id)).toEqual(
      rows.map((row) => row.id).reverse()
    );
  });

  it('preserves decision order even when an earlier timestamp is ahead of the clock', async () => {
    const identity = await createIdentity();
    const input = { identityId: identity.id, purpose: 'marketing' as const, channel: 'account' };
    const future = new Date('2100-01-01T00:00:00.000Z');
    await db.crmConsent.create({ data: { ...input, status: 'granted', capturedAt: future } });
    const withdrawn = await withdrawConsent(db, input);
    expect(withdrawn.capturedAt.getTime()).toBe(future.getTime() + 1);
    expect(await hasConsent(db, identity.id, 'marketing')).toBe(false);
    const granted = await grantConsent(db, input);
    expect(granted.capturedAt.getTime()).toBe(future.getTime() + 2);
    expect(await hasConsent(db, identity.id, 'marketing')).toBe(true);
  });

  it('serializes competing first decisions without losing audit rows', async () => {
    const identity = await createIdentity();
    const input = { identityId: identity.id, purpose: 'analytics' as const, channel: 'account' };
    const rows = await Promise.all([
      grantConsent(db, input),
      withdrawConsent(db, input),
      denyConsent(db, input),
    ]);
    expect(new Set(rows.map((row) => row.capturedAt.getTime())).size).toBe(3);
    const newest = [...rows].sort((a, b) => b.capturedAt.getTime() - a.capturedAt.getTime())[0];
    expect(await getConsentStatus(db, identity.id, 'analytics')).toBe(newest.status);
    expect(await getConsentHistory(db, identity.id)).toHaveLength(3);
  });

  it.each(['withdrawn', 'denied'] as const)(
    'fails closed for a legacy grant tied with %s regardless of UUID',
    async (status) => {
      const identity = await createIdentity();
      const input = {
        identityId: identity.id,
        purpose: 'marketing' as const,
        channel: 'account',
        capturedAt: new Date('2026-01-01'),
      };
      await db.crmConsent.create({
        data: { ...input, id: 'ffffffff-ffff-4fff-afff-ffffffffffff', status: 'granted' },
      });
      await db.crmConsent.create({
        data: { ...input, id: '00000000-0000-4000-a000-000000000001', status },
      });
      expect(await getConsentStatus(db, identity.id, 'marketing')).toBe(status);
      expect(await hasConsent(db, identity.id, 'marketing')).toBe(false);
    }
  );

  it('does not select an unexpired grant over an expired grant with the same timestamp', async () => {
    const identity = await createIdentity();
    const input = {
      identityId: identity.id,
      purpose: 'marketing' as const,
      status: 'granted' as const,
      channel: 'account',
      capturedAt: new Date('2026-01-01'),
    };
    await db.crmConsent.create({ data: { ...input, expiresAt: null } });
    await db.crmConsent.create({ data: { ...input, expiresAt: new Date('2026-02-01') } });
    expect(await hasConsent(db, identity.id, 'marketing', new Date('2026-03-01'))).toBe(false);
  });

  it('routes the public-lead service decision through the same ordered append', async () => {
    const identity = await createIdentity();
    const future = new Date('2100-01-01');
    await db.crmConsent.create({
      data: {
        identityId: identity.id,
        purpose: 'service',
        status: 'withdrawn',
        channel: 'account',
        capturedAt: future,
      },
    });
    await capturePublicLead(db, {
      audience: 'renters',
      name: 'Consent Test',
      contact: identity.email!,
      authenticatedIdentityId: identity.id,
    });
    const history = await getConsentHistory(db, identity.id);
    expect(history).toHaveLength(2);
    expect(history[0].capturedAt.getTime()).toBe(future.getTime() + 1);
    expect(history[0].purpose).toBe('service');
    expect(await hasConsent(db, identity.id, 'marketing')).toBe(false);
    expect(await hasConsent(db, identity.id, 'analytics')).toBe(false);
  });
});
