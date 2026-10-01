import { describe, it, expect, beforeEach } from 'vitest';
import { db, resetDb, createProject, createUnit } from '@/test/util';
import { computeCanonicalPriceBreakdown } from './canonical-pricing.service';

const checkIn = new Date('2026-11-10T00:00:00.000Z');
const checkOut = new Date('2026-11-13T00:00:00.000Z');

/**
 * Audit P1 #6: CommercialOffering decides sellability (canonical contract,
 * invariant 3). The gate used to apply only to typed projects, so every live
 * unit of an untyped project was bookable with no offering at all.
 */
describe('canonical pricing — the CommercialOffering sellability gate', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('refuses to quote a live unit with no active stay offering, even in an untyped project', async () => {
    const project = await createProject({ status: 'live' });
    const unit = await createUnit({ projectId: project.id, status: 'live', withoutStayOffering: true });
    await expect(
      computeCanonicalPriceBreakdown(db, unit.id, checkIn, checkOut, 2)
    ).rejects.toThrow(/No active short-stay offering/);
  });

  it('refuses a live unit whose stay offering is paused', async () => {
    const project = await createProject({ status: 'live' });
    const unit = await createUnit({ projectId: project.id, status: 'live', withoutStayOffering: true });
    await db.commercialOffering.create({ data: { unitId: unit.id, offeringType: 'short_stay', status: 'paused' } });
    await expect(
      computeCanonicalPriceBreakdown(db, unit.id, checkIn, checkOut, 2)
    ).rejects.toThrow(/No active short-stay offering/);
  });

  it('quotes a live unit with an active stay offering', async () => {
    const project = await createProject({ status: 'live' });
    const unit = await createUnit({ projectId: project.id, status: 'live', baseNightlyThb: 500000 });
    const quote = await computeCanonicalPriceBreakdown(db, unit.id, checkIn, checkOut, 2);
    expect(quote.lines).toHaveLength(3);
    expect(quote.subtotal_thb).toBeGreaterThan(0);
  });

  it('still quotes a draft unit for admin previews', async () => {
    const project = await createProject({ status: 'draft' });
    const unit = await createUnit({ projectId: project.id, status: 'draft', baseNightlyThb: 500000 });
    const quote = await computeCanonicalPriceBreakdown(db, unit.id, checkIn, checkOut, 2);
    expect(quote.lines).toHaveLength(3);
  });
});
