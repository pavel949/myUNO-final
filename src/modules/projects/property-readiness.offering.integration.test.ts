import { beforeEach, describe, expect, it } from 'vitest';
import { db, resetDb, createProject, createUnit } from '@/test/util';
import { getPropertyReadiness } from './property-readiness';

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
    const unit = await createUnit({ withoutStayOffering: true, projectId: project.id, status: 'live' });
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
});
