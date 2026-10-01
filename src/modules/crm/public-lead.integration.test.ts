import { beforeEach, describe, expect, it } from 'vitest';
import { db, resetDb, createIdentity } from '@/test/util';
import { capturePublicLead } from './crm.service';

describe('public owner lead deduplication', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('links an owner advisor inquiry to an existing property-submission opportunity', async () => {
    const identity = await createIdentity({ email: 'owner@example.com' });
    const existing = await db.crmOpportunity.create({
      data: {
        identityId: identity.id,
        type: 'rental',
        stage: 'new',
        title: 'F705',
        source: 'myuno_property_submission_v1',
        requirements: { status: 'draft' },
      },
    });

    const result = await capturePublicLead(db, {
      audience: 'owners',
      name: 'Owner Example',
      contact: 'owner@example.com',
      message: 'Please call me about management.',
    });

    expect(result.opportunityId).toBe(existing.id);
    expect(await db.crmOpportunity.count({ where: { identityId: identity.id } })).toBe(1);
    const activity = await db.crmActivity.findFirstOrThrow({
      where: { opportunityId: existing.id },
      orderBy: { createdAt: 'desc' },
    });
    expect(activity.subject).toBe('Advisor inquiry linked to property onboarding');
  });

  it('still creates a new opportunity when there is no property-submission journey', async () => {
    const result = await capturePublicLead(db, {
      audience: 'owners',
      name: 'New Owner',
      contact: 'new-owner@example.com',
      message: 'I want to rent out my villa.',
    });

    expect(await db.crmOpportunity.count({ where: { id: result.opportunityId } })).toBe(1);
  });
});
