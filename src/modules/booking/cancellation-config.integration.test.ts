import { describe, it, expect, beforeEach } from 'vitest';
import { db, resetDb, createIdentity, createProject } from '@/test/util';
import { seedConfig, setConfigOverride, clearConfigCache } from '@/modules/config';
import { resolveCancellationPolicy, resolveStayCancellationPolicy } from './cancellation';

describe('resolveCancellationPolicy — configuration is the source of truth (doc 04 §5)', () => {
  beforeEach(async () => {
    await resetDb();
    clearConfigCache();
    await seedConfig(db);
  });

  it('resolves a named policy from config', async () => {
    const policy = await resolveCancellationPolicy(db, 'strict');
    expect(policy.name).toBe('strict');
    expect(policy.steps).toEqual([
      { days_before_checkin: 14, refund_pct: 50 },
      { days_before_checkin: 0, refund_pct: 0 },
    ]);
  });

  it('falls back to [cfg] cancellation.default_policy (moderate) when the unit has no key', async () => {
    const policy = await resolveCancellationPolicy(db, null);
    expect(policy.name).toBe('moderate');
    expect(policy.steps[0]).toEqual({ days_before_checkin: 5, refund_pct: 100 });
  });

  it('fails closed on an unknown policy key instead of degrading to flexible', async () => {
    await expect(resolveCancellationPolicy(db, 'typo_policy')).rejects.toThrow(
      /Unknown cancellation policy/
    );
  });

  it('a project-level config override changes the snapshot without any code change', async () => {
    const admin = await createIdentity({ isAdmin: true });
    const project = await createProject({ status: 'live' });

    await setConfigOverride(db, 'cancellation.policy.moderate', [{ days: 10, pct: 80 }], {
      scopeType: 'project',
      scopeId: project.id,
      changedByIdentityId: admin.id,
    });
    clearConfigCache();

    const policy = await resolveCancellationPolicy(db, 'moderate', {
      projectId: project.id,
    });
    expect(policy.steps).toEqual([{ days_before_checkin: 10, refund_pct: 80 }]);
  });
});

describe('resolveStayCancellationPolicy — one policy for the page and the snapshot (audit P1 #7)', () => {
  beforeEach(async () => {
    await resetDb();
    clearConfigCache();
    await seedConfig(db);
  });

  async function unitWithCategoryPolicy(categoryPolicy: string | null, unitPolicy: string | null) {
    const project = await createProject({ status: 'live' });
    const category = await db.inventoryCategory.create({
      data: {
        projectId: project.id, categoryKey: 'villa_2br', name: 'Villa 2BR', bedrooms: 2, bathrooms: 2,
        maxGuests: 4, baseNightlyThb: 500000, cancellationPolicyKey: categoryPolicy,
      },
    });
    const unit = await db.unit.create({
      data: {
        projectId: project.id, inventoryCategoryId: category.id, name: 'V-1', unitType: 'villa',
        bedrooms: 2, bathrooms: 2, maxGuests: 4, addressSupplement: '1', baseNightlyThb: 500000,
        minNights: 1, cancellationPolicyKey: unitPolicy, status: 'live',
      },
    });
    return { project, category, unit };
  }

  it('prefers the active BAR rate plan over the category and the stale unit copy', async () => {
    const { project, category, unit } = await unitWithCategoryPolicy('moderate', 'flexible');
    await db.ratePlan.create({
      data: { projectId: project.id, categoryId: category.id, code: 'BAR', name: 'BAR', cancellationPolicyKey: 'strict' },
    });
    expect((await resolveStayCancellationPolicy(db, { unitId: unit.id })).name).toBe('strict');
    expect((await resolveStayCancellationPolicy(db, { inventoryCategoryId: category.id })).name).toBe('strict');
  });

  it('uses the category policy over the unit copy when no plan sets one', async () => {
    const { unit } = await unitWithCategoryPolicy('strict', 'flexible');
    expect((await resolveStayCancellationPolicy(db, { unitId: unit.id })).name).toBe('strict');
  });

  it('falls back to the configured default, never to a "flexible" placeholder', async () => {
    const { unit } = await unitWithCategoryPolicy(null, null);
    expect((await resolveStayCancellationPolicy(db, { unitId: unit.id })).name).toBe('moderate');
  });
});
