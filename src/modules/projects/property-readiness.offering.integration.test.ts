import { beforeEach, describe, expect, it } from 'vitest';
import { db, resetDb, createProject, createUnit, makeProjectPublicMediaReady } from '@/test/util';
import { createArea } from './area.service';
import { assertProjectReadyForActivation, getPropertyReadiness } from './property-readiness';

describe('property readiness respects commercial offering type', () => {
  beforeEach(async () => {
    await resetDb();
  });

  async function setup(offeringType?: string, status = 'active') {
    const project = await createProject();
    await db.project.update({
      where: { id: project.id },
      data: { projectType: 'condominium' },
    });
    const unit = await createUnit({ projectId: project.id, status: 'live' });
    if (offeringType) {
      await db.commercialOffering.create({
        data: { unitId: unit.id, offeringType, status },
      });
    }
    const report = await getPropertyReadiness(db, project.id);
    expect(report).not.toBeNull();
    return report!.blockers.filter(item => item.unitId === unit.id).map(item => item.key);
  }

  it('does not require a short-stay rate or sleeping layout for a sale-only unit', async () => {
    const keys = await setup('sale');
    expect(keys).not.toContain('unit.offering');
    expect(keys).not.toContain('unit.stay_offering');
    expect(keys).not.toContain('unit.pricing');
    expect(keys).not.toContain('unit.sleeping');
    expect(keys).not.toContain('unit.mobilization');
    expect(keys).not.toContain('unit.permitted_use');
    expect(keys).toContain('unit.sale_title');
    expect(keys).toContain('unit.sale_authority');
  });

  it('does not require short-stay facilities for a yearly rental-only unit', async () => {
    const keys = await setup('long_term_rental');
    expect(keys).not.toContain('unit.offering');
    expect(keys).not.toContain('unit.pricing');
    expect(keys).not.toContain('unit.sleeping');
    expect(keys).not.toContain('unit.mobilization');
    expect(keys).toContain('unit.permitted_use');
  });

  it('still blocks publishing when no offering is active', async () => {
    const keys = await setup('sale', 'draft');
    expect(keys).toContain('unit.offering');
  });

  it('requires an actual sleeping layout for an active short-stay offering', async () => {
    const keys = await setup('short_term_stay');
    expect(keys).toContain('unit.sleeping');
    expect(keys).toContain('unit.mobilization');
    expect(keys).toContain('unit.permitted_use');
  });

  it('allows a truthful project portal to activate while incomplete units remain private', async () => {
    const area = await createArea(db, {
      slug: 'layan-readiness',
      nameKey: 'area.layan_readiness.name',
      status: 'live',
    });
    const project = await createProject({ areaId: area.id });
    await db.project.update({
      where: { id: project.id },
      data: { projectType: 'resort' },
    });
    await makeProjectPublicMediaReady(project.id);
    await db.inventoryCategory.create({
      data: {
        projectId: project.id,
        categoryKey: 'draft-villas',
        name: 'Draft villas',
        bedrooms: 2,
        bathrooms: 2,
        maxGuests: 4,
        baseNightlyThb: 650000,
        minNights: 1,
        status: 'draft',
      },
    });
    const unit = await createUnit({ projectId: project.id, status: 'draft' });

    const readiness = await getPropertyReadiness(db, project.id);
    expect(readiness?.blockers.some(item => item.unitId === unit.id)).toBe(true);
    expect(readiness?.blockers.filter(item => item.scope === 'project')).toHaveLength(0);
    await expect(assertProjectReadyForActivation(db, project.id)).resolves.toBeUndefined();
  });
});
