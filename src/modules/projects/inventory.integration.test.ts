import { describe, it, expect, beforeEach } from 'vitest';
import { db, resetDb, createIdentity, createProject } from '@/test/util';
import {
  createInventoryCategory,
  updateInventoryCategory,
  listInventoryCategories,
  ensureBarRatePlans,
} from './inventory.service';
import { createUnit, updateUnit, confirmPermittedUse } from './units';
import { getConfig, clearConfigCache } from '@/modules/config';

/**
 * The deadlock this module exists to break (audit F-1).
 *
 * `updateUnit`, `computeCanonicalPriceBreakdown` and the
 * `unit_inventory_category_coherence` trigger all refuse a live unit without an
 * `InventoryCategory`, and until now nothing in the product could create one.
 * The first test here is the regression guard: it walks the whole operator
 * path — create a category, create a unit against it, confirm permitted use,
 * go live — and fails on the code as it stood before this module.
 */
describe('inventory categories', () => {
  let actorId: string;

  beforeEach(async () => {
    await resetDb();
    clearConfigCache();
    const actor = await createIdentity({ isAdmin: true });
    actorId = actor.id;
  });

  it('lets a newly created unit reach live — the F-1 deadlock', async () => {
    const project = await createProject({ status: 'live' });

    const category = await createInventoryCategory(db, {
      projectId: project.id,
      categoryKey: 'pool_villa_3br',
      name: '3-Bedroom Pool Villa',
      bedrooms: 3,
      bathrooms: 3,
      maxGuests: 6,
      baseNightlyThb: 1_500_000,
      minNights: 2,
      cancellationPolicyKey: 'moderate',
      actorIdentityId: actorId,
    });

    const unit = await createUnit({
      projectId: project.id,
      name: 'Villa 7',
      unitType: 'villa',
      categoryKey: 'pool_villa_3br',
      bedrooms: 3,
      bathrooms: 3,
      maxGuests: 6,
      addressSupplement: 'Plot 7',
      baseNightlyThb: 1,
      actorIdentityId: actorId,
    });

    // The unit links the canonical row, and inherits its commercial terms
    // rather than keeping the caller's placeholder price.
    expect(unit.inventoryCategoryId).toBe(category.id);
    expect(unit.baseNightlyThb).toBe(1_500_000);
    expect(unit.minNights).toBe(2);
    expect(unit.cancellationPolicyKey).toBe('moderate');

    await confirmPermittedUse(unit.id, actorId);
    const live = await updateUnit({ unitId: unit.id, status: 'live', actorIdentityId: actorId });

    expect(live.status).toBe('live');
  });

  it('creates the BAR rate plan with the category, in one transaction', async () => {
    const project = await createProject();
    const category = await createInventoryCategory(db, {
      projectId: project.id,
      categoryKey: 'superior_2br',
      name: 'Superior 2BR',
      bedrooms: 2,
      bathrooms: 2,
      maxGuests: 4,
      baseNightlyThb: 800_000,
      minNights: 3,
      cancellationPolicyKey: 'flexible',
      actorIdentityId: actorId,
    });

    const plans = await db.ratePlan.findMany({ where: { categoryId: category.id } });
    expect(plans).toHaveLength(1);
    expect(plans[0].code).toBe('BAR');
    expect(plans[0].isMaster).toBe(true);
    expect(plans[0].status).toBe('active');
    // The plan carries the category's stay rules, so the two cannot disagree.
    expect(plans[0].minNights).toBe(3);
    expect(plans[0].cancellationPolicyKey).toBe('flexible');
  });

  it('registers the key in the project catalog, so a unit may join it', async () => {
    const project = await createProject();
    await createInventoryCategory(db, {
      projectId: project.id,
      categoryKey: 'garden_suite',
      name: 'Garden Suite',
      bedrooms: 1,
      bathrooms: 1,
      maxGuests: 2,
      baseNightlyThb: 400_000,
      actorIdentityId: actorId,
    });

    clearConfigCache();
    const catalog = (await getConfig(db, 'catalog.unit_categories', {
      projectId: project.id,
    })) as Array<{ key: string; bedrooms?: number }>;

    expect(catalog.map((entry) => entry.key)).toContain('garden_suite');
    expect(catalog.find((entry) => entry.key === 'garden_suite')?.bedrooms).toBe(1);
  });

  it('registers a content key for the guest-facing label', async () => {
    const project = await createProject();
    await createInventoryCategory(db, {
      projectId: project.id,
      categoryKey: 'beach_front',
      name: 'Beachfront Villa',
      bedrooms: 4,
      bathrooms: 4,
      maxGuests: 8,
      baseNightlyThb: 2_500_000,
      actorIdentityId: actorId,
    });

    const key = await db.contentKey.findUnique({
      where: { key: 'catalog.unit_categories.beach_front.label' },
    });
    expect(key).not.toBeNull();
    expect(key?.namespace).toBe('catalog');
  });

  it('scopes the catalog to its own project', async () => {
    const one = await createProject();
    const two = await createProject();

    await createInventoryCategory(db, {
      projectId: one.id,
      categoryKey: 'only_here',
      name: 'Only Here',
      bedrooms: 1,
      bathrooms: 1,
      maxGuests: 2,
      baseNightlyThb: 300_000,
      actorIdentityId: actorId,
    });

    clearConfigCache();
    // Undefined rather than `[]` when the parameter has never been seeded and
    // this project has no override — which is itself the isolation being
    // asserted: the other project's key did not leak into a global default.
    const otherCatalog = ((await getConfig(db, 'catalog.unit_categories', {
      projectId: two.id,
    })) ?? []) as Array<{ key: string }>;

    expect(otherCatalog.map((entry) => entry.key)).not.toContain('only_here');
  });

  it('refuses a duplicate key in the same project', async () => {
    const project = await createProject();
    const input = {
      projectId: project.id,
      categoryKey: 'twice',
      name: 'Twice',
      bedrooms: 1,
      bathrooms: 1,
      maxGuests: 2,
      baseNightlyThb: 200_000,
      actorIdentityId: actorId,
    };
    await createInventoryCategory(db, input);
    await expect(createInventoryCategory(db, input)).rejects.toThrow(/already exists/);
  });

  it('refuses a key the catalog validator would reject', async () => {
    const project = await createProject();
    await expect(
      createInventoryCategory(db, {
        projectId: project.id,
        categoryKey: 'Not Snake Case',
        name: 'Bad',
        bedrooms: 1,
        bathrooms: 1,
        maxGuests: 2,
        baseNightlyThb: 200_000,
        actorIdentityId: actorId,
      })
    ).rejects.toThrow(/snake_case/);
  });

  it('refuses a zero price — that would quote a free stay', async () => {
    const project = await createProject();
    await expect(
      createInventoryCategory(db, {
        projectId: project.id,
        categoryKey: 'free_villa',
        name: 'Free',
        bedrooms: 1,
        bathrooms: 1,
        maxGuests: 2,
        baseNightlyThb: 0,
        actorIdentityId: actorId,
      })
    ).rejects.toThrow(/positive integer in satang/);
  });

  it('keeps the BAR plan in step when stay rules change', async () => {
    const project = await createProject();
    const category = await createInventoryCategory(db, {
      projectId: project.id,
      categoryKey: 'changing',
      name: 'Changing',
      bedrooms: 2,
      bathrooms: 1,
      maxGuests: 4,
      baseNightlyThb: 500_000,
      minNights: 1,
      cancellationPolicyKey: 'flexible',
      actorIdentityId: actorId,
    });

    await updateInventoryCategory(db, {
      categoryId: category.id,
      minNights: 5,
      cancellationPolicyKey: 'strict',
      actorIdentityId: actorId,
    });

    const plan = await db.ratePlan.findFirst({ where: { categoryId: category.id, code: 'BAR' } });
    expect(plan?.minNights).toBe(5);
    expect(plan?.cancellationPolicyKey).toBe('strict');
  });

  it('refuses to archive a category that live units still sell', async () => {
    const project = await createProject({ status: 'live' });
    const category = await createInventoryCategory(db, {
      projectId: project.id,
      categoryKey: 'in_use',
      name: 'In Use',
      bedrooms: 1,
      bathrooms: 1,
      maxGuests: 2,
      baseNightlyThb: 300_000,
      actorIdentityId: actorId,
    });

    const unit = await createUnit({
      projectId: project.id,
      name: 'Unit A',
      unitType: 'condo',
      categoryKey: 'in_use',
      bedrooms: 1,
      bathrooms: 1,
      maxGuests: 2,
      addressSupplement: 'A-1',
      baseNightlyThb: 300_000,
      actorIdentityId: actorId,
    });
    await confirmPermittedUse(unit.id, actorId);
    await updateUnit({ unitId: unit.id, status: 'live', actorIdentityId: actorId });

    await expect(
      updateInventoryCategory(db, {
        categoryId: category.id,
        status: 'archived',
        actorIdentityId: actorId,
      })
    ).rejects.toThrow(/live unit/);
  });

  it('lists categories with their unit counts and plans', async () => {
    const project = await createProject();
    await createInventoryCategory(db, {
      projectId: project.id,
      categoryKey: 'listed',
      name: 'Listed',
      bedrooms: 2,
      bathrooms: 2,
      maxGuests: 4,
      baseNightlyThb: 600_000,
      actorIdentityId: actorId,
    });

    const listed = await listInventoryCategories(db, project.id);
    expect(listed).toHaveLength(1);
    expect(listed[0].ratePlans).toHaveLength(1);
    expect(listed[0]._count.units).toBe(0);
  });

  it('repairs a category left without an active BAR plan, idempotently', async () => {
    const project = await createProject();
    const category = await createInventoryCategory(db, {
      projectId: project.id,
      categoryKey: 'orphaned',
      name: 'Orphaned',
      bedrooms: 1,
      bathrooms: 1,
      maxGuests: 2,
      baseNightlyThb: 300_000,
      actorIdentityId: actorId,
    });
    await db.ratePlan.updateMany({
      where: { categoryId: category.id, code: 'BAR' },
      data: { status: 'archived' },
    });

    expect(await ensureBarRatePlans(db, project.id, actorId)).toBe(1);
    expect(await ensureBarRatePlans(db, project.id, actorId)).toBe(0);

    const active = await db.ratePlan.findMany({
      where: { categoryId: category.id, code: 'BAR', status: 'active' },
    });
    expect(active).toHaveLength(1);
  });
});
