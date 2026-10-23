import { beforeEach, describe, expect, it } from 'vitest';
import { db, resetDb, createIdentity, createProject, createUnit } from '@/test/util';
import { datedPricingRevision, saveDatedPricing } from './dated-pricing';
import {
  computeCanonicalCalendarRates,
  computeCanonicalPriceBreakdown,
} from './canonical-pricing.service';
import { readTariffRevision, saveTariffDraft, type TariffDraft } from './tariff-editor';

const draft: TariffDraft = {
  includesTaxes: true,
  includesServiceCharge: true,
  includesBreakfast: false,
  daily: [
    {
      seasonCode: 'BASE',
      windows: [{ start: '01-01', end: '12-31' }],
      amountSatang: 800000,
      minimumNights: 3,
    },
  ],
  monthly: [
    {
      seasonCode: 'BASE',
      windows: [{ start: '01-01', end: '12-31' }],
      amountSatang: 18000000,
      minimumNights: 30,
    },
  ],
  yearly: null,
};
async function setup() {
  const actor = await createIdentity({ isAdmin: true });
  const project = await createProject({ status: 'live' });
  const a = await createUnit({ projectId: project.id, status: 'live', baseNightlyThb: 800000 });
  const b = await createUnit({ projectId: project.id, status: 'live', baseNightlyThb: 800000 });
  await saveTariffDraft(db, {
    unitIds: [a.id, b.id],
    draft,
    actorIdentityId: actor.id,
    expectedRevision: await readTariffRevision(db, [a.id, b.id]),
  });
  return { actor, a, b };
}
const from = new Date('2026-10-23T00:00:00Z'),
  to = new Date('2026-10-26T00:00:00Z');
describe('dated pricing canonical write/read flow', () => {
  beforeEach(resetDb);
  it('changes only one unit and dates, and calendar and booking agree to the satang', async () => {
    const { actor, a, b } = await setup();
    await saveDatedPricing(db, {
      actorIdentityId: actor.id,
      unitId: a.id,
      scope: 'unit',
      start: '2026-10-23',
      end: '2026-10-26',
      amountSatang: 850001,
      expectedRevision: await datedPricingRevision(db, [a.id]),
    });
    const quote = await computeCanonicalPriceBreakdown(db, a.id, from, to, 1);
    const calendar = await computeCanonicalCalendarRates(db, a.id, from, to, 1);
    expect(quote.subtotal_thb).toBe(2550003);
    expect(quote.lines.every((line) => line.applied_from === 'rule')).toBe(true);
    expect(calendar.lines.map((line) => line.nightlyThb)).toEqual(
      quote.lines.map((line) => line.nightly_thb)
    );
    expect((await computeCanonicalPriceBreakdown(db, b.id, from, to, 1)).subtotal_thb).toBe(
      2400000
    );
    expect(
      (
        await computeCanonicalPriceBreakdown(
          db,
          a.id,
          new Date('2026-10-26'),
          new Date('2026-10-29'),
          1
        )
      ).subtotal_thb
    ).toBe(2400000);
    expect(
      (
        await computeCanonicalPriceBreakdown(
          db,
          a.id,
          new Date('2027-10-23'),
          new Date('2027-10-26'),
          1
        )
      ).subtotal_thb
    ).toBe(2400000);
    expect(await db.auditLog.count({ where: { action: 'units:set_pricing_rule' } })).toBe(1);
  });
  it('bulk writes every current category unit atomically', async () => {
    const { actor, a, b } = await setup();
    const result = await saveDatedPricing(db, {
      actorIdentityId: actor.id,
      unitId: a.id,
      scope: 'category',
      start: '2026-10-23',
      end: '2026-10-26',
      amountSatang: 900000,
      expectedRevision: await datedPricingRevision(db, [a.id, b.id]),
    });
    expect(result.saved).toBe(2);
    expect(await db.pricingRule.count()).toBe(2);
    expect((await computeCanonicalPriceBreakdown(db, b.id, from, to, 1)).subtotal_thb).toBe(
      2700000
    );
  });
  it('protects an existing individual rule and writes none of a conflicting category edit', async () => {
    const { actor, a, b } = await setup();
    await db.pricingRule.create({
      data: { unitId: b.id, startDate: from, endDate: to, nightlyThb: 990000 },
    });
    await expect(
      saveDatedPricing(db, {
        actorIdentityId: actor.id,
        unitId: a.id,
        scope: 'category',
        start: '2026-10-23',
        end: '2026-10-26',
        amountSatang: 900000,
        expectedRevision: await datedPricingRevision(db, [a.id, b.id]),
      })
    ).rejects.toThrow('overlap');
    expect(await db.pricingRule.count()).toBe(1);
  });
  it('rejects stale tariffs, changed category membership and blocked actors', async () => {
    const { actor, a, b } = await setup();
    const input = {
      actorIdentityId: actor.id,
      unitId: a.id,
      scope: 'category' as const,
      start: '2026-10-23',
      end: '2026-10-26',
      amountSatang: 900000,
      expectedRevision: await datedPricingRevision(db, [a.id, b.id]),
    };
    await createUnit({ projectId: a.projectId, status: 'live', baseNightlyThb: 800000 });
    await expect(saveDatedPricing(db, input)).rejects.toThrow('conflict');
    await db.identity.update({ where: { id: actor.id }, data: { status: 'blocked' } });
    await expect(saveDatedPricing(db, input)).rejects.toThrow('Active account');
    expect(await db.pricingRule.count()).toBe(0);
  });
  it('retains seasonal minimums and monthly prices while allowing a short calendar viewport', async () => {
    const { actor, a } = await setup();
    await saveDatedPricing(db, {
      actorIdentityId: actor.id,
      unitId: a.id,
      scope: 'unit',
      start: '2026-10-23',
      end: '2026-11-26',
      amountSatang: 850000,
      minimumNights: 1,
      expectedRevision: await datedPricingRevision(db, [a.id]),
    });
    expect(
      (await computeCanonicalCalendarRates(db, a.id, from, new Date('2026-10-24'), 1)).lines[0]
        .nightlyThb
    ).toBe(850000);
    await expect(
      computeCanonicalPriceBreakdown(db, a.id, from, new Date('2026-10-24'), 1)
    ).rejects.toThrow(/minimum/);
    await db.commercialOffering.updateMany({
      where: { unitId: a.id, offeringType: 'long_term_rental' },
      data: { status: 'active' },
    });
    expect(
      (await computeCanonicalPriceBreakdown(db, a.id, from, new Date('2026-11-22'), 1)).subtotal_thb
    ).toBe(18000000);
  });
  it('serializes competing category saves and never creates overlapping rules', async () => {
    const { actor, a, b } = await setup();
    const input = {
      actorIdentityId: actor.id,
      unitId: a.id,
      scope: 'category' as const,
      start: '2026-10-23',
      end: '2026-10-26',
      amountSatang: 900000,
      expectedRevision: await datedPricingRevision(db, [a.id, b.id]),
    };
    const results = await Promise.allSettled([
      saveDatedPricing(db, input),
      saveDatedPricing(db, input),
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(await db.pricingRule.count()).toBe(2);
  });
  it.each([
    ['2026-02-30', '2026-03-02', 900000],
    ['2026-10-25', '2026-10-23', 900000],
    ['2026-10-23', '2026-10-26', 1.1],
  ])('rejects invalid date or money input', async (start, end, amountSatang) => {
    await expect(
      saveDatedPricing(db, {
        actorIdentityId: 'unused',
        unitId: 'unused',
        scope: 'unit',
        start: start as string,
        end: end as string,
        amountSatang: amountSatang as number,
        expectedRevision: 'a'.repeat(64),
      })
    ).rejects.toThrow('invalid_range');
  });
});

import { readTariffDraft, saveTariffSeasonAmount } from './tariff-editor';
it('a category matrix price patch preserves each unit’s other rates and inclusions', async () => {
  await resetDb();
  const { actor, a, b } = await setup();
  const bDraft = {
    ...draft,
    includesBreakfast: true,
    monthly: draft.monthly.map((season) => ({ ...season, amountSatang: 22000000 })),
  };
  await saveTariffDraft(db, {
    unitIds: [b.id],
    actorIdentityId: actor.id,
    draft: bDraft,
    expectedRevision: await readTariffRevision(db, [b.id]),
  });
  await saveTariffSeasonAmount(db, {
    actorIdentityId: actor.id,
    unitIds: [a.id, b.id],
    categoryId: a.inventoryCategoryId!,
    expectedRevision: await readTariffRevision(db, [a.id, b.id]),
    mode: 'daily',
    seasonCode: 'BASE',
    amountSatang: 900001,
  });
  const actual = await readTariffDraft(db, b.id);
  expect(actual.daily[0].amountSatang).toBe(900001);
  expect(actual.monthly[0].amountSatang).toBe(22000000);
  expect(actual.includesBreakfast).toBe(true);
});

it('rolls back a category cell patch when a target has no matching season', async () => {
  await resetDb();
  const { actor, a, b } = await setup();
  const bDraft = {
    ...draft,
    daily: draft.daily.map((season) => ({ ...season, seasonCode: 'OTHER' })),
  };
  await saveTariffDraft(db, {
    unitIds: [b.id],
    actorIdentityId: actor.id,
    draft: bDraft,
    expectedRevision: await readTariffRevision(db, [b.id]),
  });
  await expect(
    saveTariffSeasonAmount(db, {
      actorIdentityId: actor.id,
      unitIds: [a.id, b.id],
      categoryId: a.inventoryCategoryId!,
      expectedRevision: await readTariffRevision(db, [a.id, b.id]),
      mode: 'daily',
      seasonCode: 'BASE',
      amountSatang: 900001,
    })
  ).rejects.toThrow('season_missing');
  expect((await readTariffDraft(db, a.id)).daily[0].amountSatang).toBe(800000);
});

it('does not activate dormant legacy overrides on validated seasonal grids', async () => {
  await resetDb();
  const { a } = await setup();
  await db.pricingRule.create({
    data: { unitId: a.id, startDate: from, endDate: to, nightlyThb: 990000 },
  });
  const quote = await computeCanonicalPriceBreakdown(db, a.id, from, to, 1);
  expect(quote.subtotal_thb).toBe(2400000);
  expect(quote.lines.every((line) => line.applied_from === 'category_season')).toBe(true);
});

it('fails closed when active tariff-grid rules overlap', async () => {
  await resetDb();
  const { a } = await setup();
  await db.pricingRule.createMany({
    data: [
      { unitId: a.id, startDate: from, endDate: new Date('2026-10-25T00:00:00Z'), nightlyThb: 850000, appliesToTariffGrid: true },
      { unitId: a.id, startDate: new Date('2026-10-24T00:00:00Z'), endDate: to, nightlyThb: 900000, appliesToTariffGrid: true },
    ],
  });
  await expect(computeCanonicalPriceBreakdown(db, a.id, from, to, 1)).rejects.toThrow(/Conflicting dated pricing rules/);
});

it('refuses dated writes by a non-admin even with an exact current revision', async () => {
  await resetDb();
  const { a } = await setup();
  const employee = await createIdentity();
  await expect(
    saveDatedPricing(db, {
      actorIdentityId: employee.id,
      unitId: a.id,
      scope: 'unit',
      start: '2026-10-23',
      end: '2026-10-26',
      amountSatang: 900000,
      expectedRevision: await datedPricingRevision(db, [a.id]),
    })
  ).rejects.toThrow();
  expect(await db.pricingRule.count()).toBe(0);
});
