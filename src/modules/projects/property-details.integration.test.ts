import { describe, it, expect, beforeEach } from 'vitest';
import { db, resetDb, createIdentity, createProject, createUnit } from '@/test/util';
import { updateUnit } from './units';

/**
 * The physical facts of a listing (audit F-2/F-5).
 *
 * Sixteen `unit` columns were added by the canonical property-data migration
 * and never written by anything. These tests are the guard that they stay
 * writable — and that the two policies the pricing engine actually consults,
 * pets and capacity, cannot be left in a contradictory state.
 */
describe('unit physical facts', () => {
  let actorId: string;
  let unitId: string;

  beforeEach(async () => {
    await resetDb();
    const actor = await createIdentity({ isAdmin: true });
    actorId = actor.id;
    const project = await createProject();
    const unit = await createUnit({ projectId: project.id });
    unitId = unit.id;
  });

  it('stores every physical fact the schema holds', async () => {
    const updated = await updateUnit({
      unitId,
      actorIdentityId: actorId,
      privacyType: 'entire_place',
      accommodationType: 'pool_villa',
      usableAreaSqm: 180.5,
      grossAreaSqm: 210,
      outdoorAreaSqm: 95,
      plotAreaSqm: 640,
      balconyAreaSqm: 12.25,
      unitFeatures: ['private_pool', 'sea_terrace'],
      accessibilityFacts: ['step_free_entry'],
      safetyFacts: ['smoke_alarm', 'fire_extinguisher'],
      furnishingStatus: 'fully_furnished',
      views: ['sea', 'garden'],
      floor: '2',
    });

    expect(updated.privacyType).toBe('entire_place');
    expect(updated.accommodationType).toBe('pool_villa');
    expect(Number(updated.usableAreaSqm)).toBeCloseTo(180.5);
    expect(Number(updated.plotAreaSqm)).toBeCloseTo(640);
    expect(updated.unitFeatures).toEqual(['private_pool', 'sea_terrace']);
    expect(updated.accessibilityFacts).toEqual(['step_free_entry']);
    expect(updated.safetyFacts).toEqual(['smoke_alarm', 'fire_extinguisher']);
    expect(updated.furnishingStatus).toBe('fully_furnished');
    expect(updated.views).toEqual(['sea', 'garden']);
    expect(updated.floor).toBe('2');
  });

  it('leaves untouched facts alone', async () => {
    await updateUnit({ unitId, actorIdentityId: actorId, views: ['sea'], privacyType: 'entire_place' });
    await updateUnit({ unitId, actorIdentityId: actorId, furnishingStatus: 'unfurnished' });

    const unit = await db.unit.findUnique({ where: { id: unitId } });
    expect(unit?.views).toEqual(['sea']);
    expect(unit?.privacyType).toBe('entire_place');
    expect(unit?.furnishingStatus).toBe('unfurnished');
  });

  it('clears a fact when explicitly set to null', async () => {
    await updateUnit({ unitId, actorIdentityId: actorId, furnishingStatus: 'fully_furnished' });
    await updateUnit({ unitId, actorIdentityId: actorId, furnishingStatus: null });

    const unit = await db.unit.findUnique({ where: { id: unitId } });
    expect(unit?.furnishingStatus).toBeNull();
  });

  it('keeps "unanswered" distinct from "no" for pets', async () => {
    const fresh = await db.unit.findUnique({ where: { id: unitId } });
    expect(fresh?.petsAllowed).toBeNull();

    const refused = await updateUnit({ unitId, actorIdentityId: actorId, petsAllowed: false });
    expect(refused.petsAllowed).toBe(false);
  });

  it('records a pet policy with its cap and fee', async () => {
    const updated = await updateUnit({
      unitId,
      actorIdentityId: actorId,
      petsAllowed: true,
      maxPets: 2,
      petFeeThb: 150_000,
      petRules: 'Dogs under 10kg, not on furniture.',
    });

    expect(updated.petsAllowed).toBe(true);
    expect(updated.maxPets).toBe(2);
    expect(updated.petFeeThb).toBe(150_000);
    expect(updated.petRules).toContain('Dogs under 10kg');
  });

  it('refuses a pet fee on a unit that does not accept pets', async () => {
    await expect(
      updateUnit({ unitId, actorIdentityId: actorId, petsAllowed: false, petFeeThb: 100_000 })
    ).rejects.toThrow(/does not accept pets/);
  });

  it('clears the cap and fee when pets are turned off', async () => {
    await updateUnit({
      unitId,
      actorIdentityId: actorId,
      petsAllowed: true,
      maxPets: 2,
      petFeeThb: 150_000,
    });
    await updateUnit({ unitId, actorIdentityId: actorId, petsAllowed: false });

    const unit = await db.unit.findUnique({ where: { id: unitId } });
    expect(unit?.petsAllowed).toBe(false);
    expect(unit?.maxPets).toBeNull();
    expect(unit?.petFeeThb).toBeNull();
  });

  it('refuses an impossible area', async () => {
    await expect(
      updateUnit({ unitId, actorIdentityId: actorId, usableAreaSqm: -5 })
    ).rejects.toThrow(/square metres/);
    await expect(
      updateUnit({ unitId, actorIdentityId: actorId, plotAreaSqm: 5_000_000 })
    ).rejects.toThrow(/square metres/);
  });

  it('refuses a negative pet cap', async () => {
    await expect(
      updateUnit({ unitId, actorIdentityId: actorId, petsAllowed: true, maxPets: -1 })
    ).rejects.toThrow(/non-negative integer/);
  });

  it('audits the change', async () => {
    await updateUnit({ unitId, actorIdentityId: actorId, views: ['sea'] });
    const audit = await db.auditLog.findFirst({
      where: { entityType: 'Unit', entityId: unitId, action: 'units:update' },
    });
    expect(audit).not.toBeNull();
    expect(audit?.actorIdentityId).toBe(actorId);
  });
});
