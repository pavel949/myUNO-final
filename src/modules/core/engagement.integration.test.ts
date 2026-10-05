import { describe, it, expect, beforeEach } from 'vitest';
import {
  db,
  resetDb,
  createIdentity,
  createProject,
  createUnit,
} from '@/test/util';
import { createDraftUnitEngagementTx, createUnitEngagement, updateUnitEngagement } from './engagement.service';

async function makeDraftEngagement(unitId: string, ownerIdentityId: string) {
  const { id } = await createUnitEngagement(db, {
    unitId,
    engagementType: 'owner_direct',
    ownerIdentityId,
  });
  return id;
}

describe('One active engagement per unit (doc 02 §2.6)', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('activates the first engagement and rejects a competing activation', async () => {
    const owner = await createIdentity();
    const project = await createProject({ status: 'live' });
    const unit = await createUnit({ projectId: project.id, ownerIdentityId: owner.id });

    const first = await makeDraftEngagement(unit.id, owner.id);
    const second = await makeDraftEngagement(unit.id, owner.id);

    await updateUnitEngagement(db, first, { status: 'active' });

    await expect(
      updateUnitEngagement(db, second, { status: 'active' })
    ).rejects.toThrow(/already has an active engagement/);
  });

  it('allows activating a new engagement after the previous one ends', async () => {
    const owner = await createIdentity();
    const project = await createProject({ status: 'live' });
    const unit = await createUnit({ projectId: project.id, ownerIdentityId: owner.id });

    const first = await makeDraftEngagement(unit.id, owner.id);
    const second = await makeDraftEngagement(unit.id, owner.id);

    await updateUnitEngagement(db, first, { status: 'active' });
    await updateUnitEngagement(db, first, { status: 'ended' });
    await updateUnitEngagement(db, second, { status: 'active' });

    const active = await db.unitEngagement.findMany({
      where: { unitId: unit.id, status: 'active' },
    });
    expect(active).toHaveLength(1);
    expect(active[0].id).toBe(second);
  });

  it('re-saving an already-active engagement does not trip the check', async () => {
    const owner = await createIdentity();
    const project = await createProject({ status: 'live' });
    const unit = await createUnit({ projectId: project.id, ownerIdentityId: owner.id });

    const only = await makeDraftEngagement(unit.id, owner.id);
    await updateUnitEngagement(db, only, { status: 'active' });
    await updateUnitEngagement(db, only, { status: 'active', setupFeeThb: 1000 });

    const row = await db.unitEngagement.findUnique({ where: { id: only } });
    expect(row!.status).toBe('active');
    expect(row!.setupFeeThb).toBe(1000);
  });
});


describe('draft onboarding engagement gates', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('allows a direct-managed draft before mandate and economics are complete', async () => {
    const owner = await createIdentity();
    const project = await createProject({ status: 'live' });
    const unit = await createUnit({ projectId: project.id, ownerIdentityId: owner.id });

    const created = await db.$transaction((tx) =>
      createDraftUnitEngagementTx(tx, {
        unitId: unit.id,
        engagementType: 'direct_managed',
        ownerIdentityId: owner.id,
      })
    );

    const row = await db.unitEngagement.findUniqueOrThrow({ where: { id: created.id } });
    expect(row.status).toBe('draft');
    expect(row.noiCapAnnualThb).toBeNull();
    expect(row.mandateMediaId).toBeNull();

    await expect(updateUnitEngagement(db, row.id, { status: 'active' })).rejects.toThrow(/mandate/i);
  });

  it('requires both mandate and NOI cap before activating direct-managed', async () => {
    const owner = await createIdentity();
    const project = await createProject({ status: 'live' });
    const unit = await createUnit({ projectId: project.id, ownerIdentityId: owner.id });
    const mandate = await db.mediaAsset.create({
      data: {
        kind: 'document',
        storageKey: 'data:application/pdf;base64,engagement-activation-test',
        mimeType: 'application/pdf',
        sizeBytes: 10,
        uploadedByIdentityId: owner.id,
      },
    });

    const created = await db.$transaction((tx) =>
      createDraftUnitEngagementTx(tx, {
        unitId: unit.id,
        engagementType: 'direct_managed',
        ownerIdentityId: owner.id,
        mandateMediaId: mandate.id,
      })
    );

    await expect(updateUnitEngagement(db, created.id, { status: 'active' })).rejects.toThrow(/NOI cap/i);
    await updateUnitEngagement(db, created.id, { status: 'active', noiCapAnnualThb: 20000000 });

    expect((await db.unitEngagement.findUniqueOrThrow({ where: { id: created.id } })).status).toBe('active');
  });
});
