import { beforeEach, describe, expect, it } from 'vitest';
import { db, resetDb, createIdentity } from '@/test/util';
import { capturePublicLead } from './crm.service';
import { denyConsent, getConsentStatus, withdrawConsent } from './consent.service';

describe('anonymous contact claims never identify or consent for an existing person', () => {
  beforeEach(resetDb);

  async function victim() {
    const identity = await createIdentity({ email: 'existing-person@example.test' });
    await db.identity.update({ where: { id: identity.id }, data: { phone: '+66812345678' } });
    const profile = await db.crmProfile.create({ data: {
      identityId: identity.id, lifecycleStage: 'managed', firstSource: 'verified_original',
      lastSource: 'verified_original', preferredChannel: 'email', nextActionAt: new Date('2027-01-10'),
    } });
    const opportunity = await db.crmOpportunity.create({ data: {
      identityId: identity.id, type: 'management', title: 'Real owner onboarding',
      source: 'myuno_property_submission_v1', requirements: { original: true },
    } });
    await withdrawConsent(db, { identityId: identity.id, purpose: 'service', channel: 'account' });
    return { identity, profile, opportunity };
  }

  it.each(['email', 'phone'] as const)('retains a victim withdrawal and leaves all existing CRM facts untouched for a claimed %s', async kind => {
    const before = await victim();
    const contact = kind === 'email' ? before.identity.email! : '+66 81 234 5678';
    const result = await capturePublicLead(db, {
      audience: 'owners', name: 'Unverified Sender', contact, message: 'Please respond to this inquiry',
    });
    expect(result.identityId).not.toBe(before.identity.id);
    expect(result.opportunityId).not.toBe(before.opportunity.id);
    expect(await getConsentStatus(db, before.identity.id, 'service')).toBe('withdrawn');
    expect(await db.crmConsent.count({ where: { identityId: before.identity.id } })).toBe(1);
    expect(await db.crmProfile.findUniqueOrThrow({ where: { identityId: before.identity.id } })).toEqual(before.profile);
    expect(await db.crmOpportunity.findUniqueOrThrow({ where: { id: before.opportunity.id } })).toEqual(before.opportunity);
    expect(await db.crmOpportunity.count({ where: { identityId: before.identity.id } })).toBe(1);
    expect(await db.crmActivity.count({ where: { identityId: before.identity.id } })).toBe(0);
    expect(await db.crmAttributionTouch.count({ where: { identityId: before.identity.id } })).toBe(0);
    const provisional = await db.identity.findUniqueOrThrow({ where: { id: result.identityId } });
    expect(provisional.status).toBe('invited');
    expect(provisional.email).toBeNull();
    expect(provisional.phone).toBeNull();
    expect(provisional.notesInternal).toContain(contact);
    expect(await db.crmConsent.count({ where: { identityId: result.identityId } })).toBe(0);
    const lead = await db.crmOpportunity.findUniqueOrThrow({ where: { id: result.opportunityId } });
    expect(lead.requirements).toMatchObject({
      identityMatchState: 'unverified_contact', inquiryContact: { value: contact, verified: false },
      message: 'Please respond to this inquiry',
    });
  });

  it('keeps a new anonymous contact available to operations without creating a verified sign-in contact or global consent', async () => {
    const result = await capturePublicLead(db, {
      audience: 'renters', name: 'New Inquiry', contact: 'new-contact@example.test',
    });
    const identity = await db.identity.findUniqueOrThrow({ where: { id: result.identityId } });
    expect(identity.email).toBeNull();
    expect(identity.phone).toBeNull();
    expect(identity.notesInternal).toBe('Unverified inquiry contact: new-contact@example.test');
    expect(await db.crmConsent.count()).toBe(0);
    expect(await db.crmOpportunity.count()).toBe(1);
  });

  it('authenticated self can consent and links to that identity, never to the submitted contact owner', async () => {
    const before = await victim();
    const self = await createIdentity({ email: 'authenticated-self@example.test' });
    await denyConsent(db, { identityId: self.id, purpose: 'service', channel: 'account' });
    const result = await capturePublicLead(db, {
      audience: 'renters', name: 'Signed-in Sender', contact: before.identity.email!,
      authenticatedIdentityId: self.id,
    });
    expect(result.identityId).toBe(self.id);
    expect(await getConsentStatus(db, self.id, 'service')).toBe('granted');
    expect(await getConsentStatus(db, before.identity.id, 'service')).toBe('withdrawn');
    expect((await db.identity.findUniqueOrThrow({ where: { id: self.id } })).email).toBe(self.email);
    const consent = await db.crmConsent.findFirstOrThrow({ where: { identityId: self.id, status: 'granted' } });
    expect(consent.evidence).toMatchObject({ identityBasis: 'authenticated_session', recordedByIdentityId: self.id });
    expect(JSON.stringify(consent.evidence)).not.toContain(before.identity.email);
  });

  it('does not fall back to claimed contact when the supplied session identity is inactive', async () => {
    const before = await victim();
    const blocked = await createIdentity({ status: 'blocked' });
    const identityCount = await db.identity.count();
    await expect(capturePublicLead(db, {
      audience: 'owners', name: 'Blocked Sender', contact: before.identity.email!, authenticatedIdentityId: blocked.id,
    })).rejects.toThrow('invalid_session_identity');
    expect(await db.identity.count()).toBe(identityCount);
    expect(await db.crmOpportunity.count()).toBe(1);
    expect(await getConsentStatus(db, before.identity.id, 'service')).toBe('withdrawn');
  });
});
