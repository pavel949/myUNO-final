import { describe, it, expect, beforeEach } from 'vitest';
import {
  db,
  resetDb,
  createIdentity,
  createProject,
  createUnit,
} from '@/test/util';
import { createUnitEngagement, updateUnitEngagement } from './engagement.service';

async function makeDraftEngagement(unitId: string, ownerIdentityId: string) {
  const mandate = await db.mediaAsset.create({
    data: {
      kind: 'document',
      storageKey: `data:application/pdf;base64,${Math.random().toString(36).slice(2)}`,
      mimeType: 'application/pdf',
      sizeBytes: 10,
      uploadedByIdentityId: ownerIdentityId,
    },
  });
  const { id } = await createUnitEngagement(db, {
    unitId,
    engagementType: 'via_management_company',
    ownerIdentityId,
    mandateMediaId: mandate.id,
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
