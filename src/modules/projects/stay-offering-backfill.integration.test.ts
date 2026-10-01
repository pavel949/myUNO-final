import { describe, it, expect, beforeEach } from 'vitest';
import { db, resetDb, createProject, createUnit } from '@/test/util';
import { ensureStayOfferingsForLiveUnits } from './stay-offering-backfill';

const stayOffers = (unitId: string) =>
  db.commercialOffering.findMany({ where: { unitId, offeringType: { in: ['short_stay', 'short_term_stay'] } } });

/**
 * Audit P1 #6: the backfill that keeps legacy live units bookable once the
 * offering gate applies to every unit. It must never open inventory that was
 * deliberately closed or that an external source system still owns.
 */
describe('ensureStayOfferingsForLiveUnits', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('activates a stay offering for a live unit that has none', async () => {
    const project = await createProject({ status: 'live' });
    const unit = await createUnit({ projectId: project.id, status: 'live', withoutStayOffering: true });
    expect(await ensureStayOfferingsForLiveUnits(db)).toBe(1);
    expect((await stayOffers(unit.id)).map(o => o.status)).toEqual(['active']);
    expect(await ensureStayOfferingsForLiveUnits(db)).toBe(0);
  });

  it('leaves a paused offering, a draft unit and a source-linked unit untouched', async () => {
    const project = await createProject({ status: 'live' });
    const paused = await createUnit({ projectId: project.id, status: 'live', withoutStayOffering: true });
    await db.commercialOffering.create({ data: { unitId: paused.id, offeringType: 'short_term_stay', status: 'paused' } });
    const draft = await createUnit({ projectId: project.id, status: 'draft', withoutStayOffering: true });
    const linked = await createUnit({ projectId: project.id, status: 'live', withoutStayOffering: true });
    const source = await db.externalSystem.create({
      data: { system_key: 'layantara_os', environment: 'test', display_name: 'Source', config: {} },
    });
    await db.externalMapping.create({
      data: { external_system_id: source.id, entity_type: 'unit', internal_id: linked.id, external_id: 'villa-1' },
    });

    expect(await ensureStayOfferingsForLiveUnits(db)).toBe(0);
    expect((await stayOffers(paused.id)).map(o => o.status)).toEqual(['paused']);
    expect(await stayOffers(draft.id)).toHaveLength(0);
    expect(await stayOffers(linked.id)).toHaveLength(0);
  });
});
