import { describe, it, expect, beforeEach } from 'vitest';
import { db, resetDb, createIdentity } from '@/test/util';
import {
  grantConsent,
  withdrawConsent,
  denyConsent,
  getConsentStatus,
  hasConsent,
  getConsentHistory,
  getConsentSummary,
} from './consent.service';

/**
 * `crm_consent` had one write path and no withdrawal, update or revocation
 * route anywhere. Doc 17 describes a consent audit trail WITH withdrawal
 * history. Under the PDPA withdrawal is a right, and a right nobody can
 * exercise is not implemented.
 */
describe('consent withdrawal (T-065)', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('records a withdrawal without destroying the consent it withdraws', async () => {
    // The point of the ledger. The question asked later is not "does this
    // person consent today" but "what were you relying on when you sent that,
    // and when did that change".
    const identity = await createIdentity();
    await grantConsent(db, { identityId: identity.id, purpose: 'marketing', channel: 'website' });
    await withdrawConsent(db, {
      identityId: identity.id,
      purpose: 'marketing',
      channel: 'account',
    });

    expect(await getConsentStatus(db, identity.id, 'marketing')).toBe('withdrawn');

    const history = await getConsentHistory(db, identity.id);
    expect(history).toHaveLength(2);
    expect(history.map((h) => h.status)).toEqual(['withdrawn', 'granted']);
  });

  it('lets consent be given again after withdrawal, and keeps all three rows', async () => {
    const identity = await createIdentity();
    await grantConsent(db, { identityId: identity.id, purpose: 'marketing', channel: 'website' });
    await withdrawConsent(db, { identityId: identity.id, purpose: 'marketing', channel: 'account' });
    await grantConsent(db, { identityId: identity.id, purpose: 'marketing', channel: 'account' });

    expect(await hasConsent(db, identity.id, 'marketing')).toBe(true);
    expect(await getConsentHistory(db, identity.id)).toHaveLength(3);
  });

  it('keeps purposes independent — withdrawing marketing does not stop service', async () => {
    const identity = await createIdentity();
    await grantConsent(db, { identityId: identity.id, purpose: 'service', channel: 'website' });
    await grantConsent(db, { identityId: identity.id, purpose: 'marketing', channel: 'website' });
    await withdrawConsent(db, { identityId: identity.id, purpose: 'marketing', channel: 'account' });

    expect(await hasConsent(db, identity.id, 'service')).toBe(true);
    expect(await hasConsent(db, identity.id, 'marketing')).toBe(false);
  });

  it('treats lapsed consent as withdrawn, so a caller asking "may I" gets the safe answer', async () => {
    const identity = await createIdentity();
    await grantConsent(db, {
      identityId: identity.id,
      purpose: 'analytics',
      channel: 'website',
      expiresAt: new Date('2026-01-01'),
    });
    expect(await getConsentStatus(db, identity.id, 'analytics', new Date('2026-06-01'))).toBe(
      'withdrawn'
    );
    expect(await hasConsent(db, identity.id, 'analytics', new Date('2026-06-01'))).toBe(false);
  });

  it('allows withdrawing something never granted, and keeps the record of the asking', async () => {
    // Someone saying "stop using my data for this" should not be told their
    // request was unnecessary.
    const identity = await createIdentity();
    await withdrawConsent(db, {
      identityId: identity.id,
      purpose: 'property_matching',
      channel: 'email_link',
    });
    expect(await getConsentStatus(db, identity.id, 'property_matching')).toBe('withdrawn');
    expect(await getConsentHistory(db, identity.id)).toHaveLength(1);
  });

  it('distinguishes a refusal at the point of asking from a later withdrawal', async () => {
    const identity = await createIdentity();
    await denyConsent(db, { identityId: identity.id, purpose: 'marketing', channel: 'website' });
    expect(await getConsentStatus(db, identity.id, 'marketing')).toBe('denied');
    expect(await hasConsent(db, identity.id, 'marketing')).toBe(false);
  });

  it('records who acted when staff withdraw on someone behalf, without storing the person', async () => {
    const identity = await createIdentity();
    const staff = await createIdentity();
    const row = await withdrawConsent(db, {
      identityId: identity.id,
      purpose: 'marketing',
      channel: 'staff',
      recordedByIdentityId: staff.id,
      evidence: { request: 'phone call, ticket 412' },
    });
    expect((row.evidence as { recordedByIdentityId?: string }).recordedByIdentityId).toBe(staff.id);
  });

  it('summarises every purpose for an account screen, unset included', async () => {
    const identity = await createIdentity();
    await grantConsent(db, { identityId: identity.id, purpose: 'service', channel: 'website' });

    const summary = await getConsentSummary(db, identity.id);
    expect(summary).toHaveLength(4);
    expect(summary.find((s) => s.purpose === 'service')?.status).toBe('granted');
    // Never asked is null, which is not the same as refused.
    expect(summary.find((s) => s.purpose === 'analytics')?.status).toBeNull();
  });
});
