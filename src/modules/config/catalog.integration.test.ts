import { describe, it, expect, beforeEach } from 'vitest';
import { db, resetDb, createIdentity, createProject } from '@/test/util';
import { seedConfig, clearConfigCache } from '@/modules/config';
import { assertCatalogKeys, getCatalogKeys } from './catalog';
import { createUnit } from '@/modules/projects';

describe('Catalog key validation (doc 04 §8, DM-3)', () => {
  beforeEach(async () => {
    await resetDb();
    clearConfigCache();
    await seedConfig(db);
  });

  it('lists the seeded amenity keys', async () => {
    const keys = await getCatalogKeys(db, 'catalog.amenities');
    expect(keys).toContain('pool');
    expect(keys).toContain('security_24h');
    expect(keys).toHaveLength(12);
  });

  it('accepts known keys and empty lists', async () => {
    await expect(
      assertCatalogKeys(db, 'catalog.amenities', ['wifi', 'pool'])
    ).resolves.toBeUndefined();
    await expect(assertCatalogKeys(db, 'catalog.amenities', [])).resolves.toBeUndefined();
    await expect(assertCatalogKeys(db, 'catalog.amenities', null)).resolves.toBeUndefined();
  });

  it('rejects unknown keys, naming the offenders', async () => {
    await expect(
      assertCatalogKeys(db, 'catalog.amenities', ['pool', 'jacuzzi', 'helipad'])
    ).rejects.toThrow(/jacuzzi, helipad/);
  });

  it('rejects a unit write with a made-up amenity or policy key', async () => {
    const admin = await createIdentity({ isAdmin: true });
    const project = await createProject({ status: 'live' });

    await expect(
      createUnit({
        projectId: project.id,
        name: 'Bad Unit',
        unitType: 'villa',
        bedrooms: 1,
        bathrooms: 1,
        maxGuests: 2,
        addressSupplement: '1',
        baseNightlyThb: 1000,
        amenityKeys: ['concierge'],
        actorIdentityId: admin.id,
      })
    ).rejects.toThrow(/catalog.amenities/);

    await expect(
      createUnit({
        projectId: project.id,
        name: 'Bad Unit 2',
        unitType: 'villa',
        bedrooms: 1,
        bathrooms: 1,
        maxGuests: 2,
        addressSupplement: '2',
        baseNightlyThb: 1000,
        cancellationPolicyKey: 'super_flexible',
        actorIdentityId: admin.id,
      })
    ).rejects.toThrow(/catalog.cancellation_policies/);
  });

  it('accepts a unit write with legal keys', async () => {
    const admin = await createIdentity({ isAdmin: true });
    const project = await createProject({ status: 'live' });

    const unit = await createUnit({
      projectId: project.id,
      name: 'Good Unit',
      unitType: 'villa',
      bedrooms: 1,
      bathrooms: 1,
      maxGuests: 2,
      addressSupplement: '3',
      baseNightlyThb: 1000,
      amenityKeys: ['wifi', 'sea_view'],
      cancellationPolicyKey: 'moderate',
      actorIdentityId: admin.id,
    });
    expect(unit.amenityKeys).toEqual(['wifi', 'sea_view']);
  });
});
