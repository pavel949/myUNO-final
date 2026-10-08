import { beforeEach, describe, expect, it } from 'vitest';
import { MobilizationChecklistItemStep } from '@prisma/client';
import { db, resetDb, createIdentity, createProject, createUnit, makeCategoryPublicMediaReady, makeUnitPublicMediaReady } from '@/test/util';
import { assertCommercialOfferingReadyForActivation, deriveUnitOnboardingState } from './canonical-onboarding';
import { getPropertyReadiness } from '@/modules/projects/property-readiness';

describe('commercial activation uses truthful accommodation media', () => {
  beforeEach(resetDb);

  async function fixture(accommodationType = 'hotel_room', projectType = 'hotel') {
    const owner = await createIdentity();
    const project = await createProject({ status: 'live' });
    await db.project.update({ where: { id: project.id }, data: { projectType } });
    const unit = await createUnit({ projectId: project.id, ownerIdentityId: owner.id,
      status: 'live', publicMediaReady: false, withoutStayOffering: true });
    await db.unit.update({ where: { id: unit.id }, data: { accommodationType, permittedUseConfirmedAt: new Date() } });
    await makeCategoryPublicMediaReady(unit.inventoryCategoryId!);
    await db.unitEngagement.create({ data: { unitId: unit.id, ownerIdentityId: owner.id, engagementType: 'owner_direct', status: 'active' } });
    await db.complianceRecord.create({ data: { unitId: unit.id, recordType: 'permitted_use', status: 'confirmed' } });
    await db.sleepingSpace.create({ data: { unitId: unit.id, beds: { create: { bedType: 'king', count: 1 } } } });
    await db.mobilizationChecklistItem.createMany({ data: Object.values(MobilizationChecklistItemStep).map(step => ({ unitId: unit.id, step, status: 'done' as const })) });
    await db.ratePlan.create({ data: { unitId: unit.id, code: 'MEDIA-TEST', name: 'Synthetic test rate', status: 'active' } });
    await db.commercialOffering.create({ data: { unitId: unit.id, projectId: project.id, offeringType: 'short_term_stay', status: 'draft' } });
    return { project, unit };
  }

  it('accepts a real room-type gallery consistently in readiness, onboarding and activation', async () => {
    const { project, unit } = await fixture();
    const report = await getPropertyReadiness(db, project.id);
    expect(report!.blockers.filter(item => item.unitId === unit.id).map(item => item.key)).not.toContain('unit.media');
    expect((await deriveUnitOnboardingState(db, unit.id)).blockers).not.toContain('PUBLIC_MEDIA_MISSING');
    await expect(assertCommercialOfferingReadyForActivation(db, unit.id, 'short_term_stay')).resolves.toBeUndefined();
    expect(await db.unitMedia.count({ where: { unitId: unit.id } })).toBe(0);
  });

  it.each(['villa', 'condo', 'townhouse'])('does not grant %s representative-room privileges from the hotel project label', async (accommodationType) => {
    const { project, unit } = await fixture(accommodationType);
    const report = await getPropertyReadiness(db, project.id);
    expect(report!.blockers.filter(item => item.unitId === unit.id).map(item => item.key)).toContain('unit.media');
    await expect(assertCommercialOfferingReadyForActivation(db, unit.id, 'short_term_stay')).rejects.toThrow('exact_unit_media_required');
    await makeUnitPublicMediaReady(unit.id);
    await expect(assertCommercialOfferingReadyForActivation(db, unit.id, 'short_term_stay')).resolves.toBeUndefined();
  });

  it('rejects an encrypted photo in the representative gallery', async () => {
    const { unit } = await fixture();
    const category = await db.inventoryCategory.findUniqueOrThrow({ where: { id: unit.inventoryCategoryId! } });
    await db.mediaAsset.update({ where: { id: category.coverMediaId! }, data: { encrypted: true } });
    await expect(assertCommercialOfferingReadyForActivation(db, unit.id, 'short_term_stay')).rejects.toThrow('room_type_media_required');
  });

  it('requires valid exact photos for a private resort villa, not merely three links', async () => {
    const { unit } = await fixture('villa', 'resort');
    await makeUnitPublicMediaReady(unit.id);
    const current = await db.unit.findUniqueOrThrow({ where: { id: unit.id } });
    await db.mediaAsset.update({ where: { id: current.coverMediaId! }, data: { sizeBytes: 0 } });
    await expect(assertCommercialOfferingReadyForActivation(db, unit.id, 'short_term_stay')).rejects.toThrow('exact_unit_media_required');
  });
});
