import { describe, it, expect, beforeEach } from 'vitest';
import {
  db,
  resetDb,
  createIdentity,
  createProject,
  createUnit,
  createBooking,
} from '@/test/util';
import {
  createManualBlock,
  removeBlockedDate,
  getUnitBlockedDates,
  createPricingRule,
  removePricingRule,
  getUnitPricingRules,
  checkAvailability,
} from './availability.service';
import { computeCanonicalPriceBreakdown as computePriceBreakdown } from './canonical-pricing.service';

// The legacy calculator these tests were written against is deleted (audit
// P2 #13: it was exported and tested but no caller used it). They now pin
// the CANONICAL engine every quote and booking goes through.
async function getApplicableNightlyPrice(client: typeof db, date: Date, unitId: string): Promise<number> {
  const unit = await client.unit.findUnique({
    where: { id: unitId },
    select: { minNights: true, inventoryCategory: { select: { minNights: true } } },
  });
  if (!unit) throw new Error(`Unit ${unitId} not found`);
  const nights = Math.max(1, unit.inventoryCategory?.minNights ?? unit.minNights ?? 1);
  const end = new Date(date.getTime() + nights * 86_400_000);
  const quote = await computePriceBreakdown(client, unitId, date, end, 1);
  return quote.lines[0].nightly_thb;
}


/**
 * F-OPS-4, Q53: staff can manually block a unit's calendar or set a one-off
 * price. These tests prove the override actually takes effect on the same
 * resolution path a real booking attempt uses — a manual block that only
 * shows up in an admin list, but never affects `checkAvailability`, would be
 * decoration, not a working feature.
 */
describe('manual availability & pricing overrides', () => {
  let unitId: string;
  let projectId: string;
  let staffId: string;

  beforeEach(async () => {
    await resetDb();
    const project = await createProject();
    const owner = await createIdentity();
    const unit = await createUnit({ projectId: project.id, ownerIdentityId: owner.id, baseNightlyThb: 250000 });
    unitId = unit.id;
    projectId = project.id;
    staffId = (await createIdentity()).id;
  });

  describe('blocking dates', () => {
    it('blocks a range, and checkAvailability refuses a booking across it', async () => {
      const start = new Date('2026-09-10');
      const end = new Date('2026-09-15');

      const before = await checkAvailability(db, unitId, start, end);
      expect(before).toBe(true);

      await createManualBlock(db, {
        unitId,
        startDate: start,
        endDate: end,
        reason: 'maintenance',
        createdByIdentityId: staffId,
      });

      const after = await checkAvailability(db, unitId, start, end);
      expect(after).toBe(false);
    });

    it('refuses to block dates that overlap a confirmed booking', async () => {
      const guest = await createIdentity();
      // The booking must name the unit's own project. This used to create a
      // second, unrelated project and file the booking under it — a state the
      // database now refuses (migration 20260907001000).
      await createBooking({
        unitId,
        projectId,
        guestIdentityId: guest.id,
        startDate: new Date('2026-09-10'),
        endDate: new Date('2026-09-15'),
        status: 'confirmed',
      });

      await expect(
        createManualBlock(db, {
          unitId,
          startDate: new Date('2026-09-12'),
          endDate: new Date('2026-09-18'),
          reason: 'maintenance',
          createdByIdentityId: staffId,
        })
      ).rejects.toThrow(/active booking overlaps/);
    });

    it('frees the dates again once removed', async () => {
      const start = new Date('2026-10-01');
      const end = new Date('2026-10-05');
      const block = await createManualBlock(db, {
        unitId,
        startDate: start,
        endDate: end,
        reason: 'owner_hold',
        createdByIdentityId: staffId,
      });

      expect(await checkAvailability(db, unitId, start, end)).toBe(false);

      await removeBlockedDate(db, block.id);

      expect(await checkAvailability(db, unitId, start, end)).toBe(true);
    });

    it('lists blocks most recent first', async () => {
      await createManualBlock(db, {
        unitId,
        startDate: new Date('2026-11-01'),
        endDate: new Date('2026-11-05'),
        reason: 'other',
        createdByIdentityId: staffId,
      });
      await createManualBlock(db, {
        unitId,
        startDate: new Date('2026-12-01'),
        endDate: new Date('2026-12-05'),
        reason: 'other',
        createdByIdentityId: staffId,
      });

      const blocks = await getUnitBlockedDates(db, unitId);
      expect(blocks).toHaveLength(2);
      expect(blocks[0].startDate.getTime()).toBeGreaterThan(blocks[1].startDate.getTime());
    });
  });

  describe('pricing overrides', () => {
    it('sets a one-off nightly rate, and getApplicableNightlyPrice reads it', async () => {
      const night = new Date('2026-09-12');

      await createPricingRule(db, {
        unitId,
        startDate: new Date('2026-09-10'),
        endDate: new Date('2026-09-15'),
        nightlyThb: 350000, // satang — CLAUDE.md money rules
      });

      const price = await getApplicableNightlyPrice(db, night, unitId);
      expect(price).toBe(350000);
    });

    it('refuses an overlapping rule for the same unit', async () => {
      await createPricingRule(db, {
        unitId,
        startDate: new Date('2026-09-10'),
        endDate: new Date('2026-09-15'),
        nightlyThb: 350000,
      });

      await expect(
        createPricingRule(db, {
          unitId,
          startDate: new Date('2026-09-12'),
          endDate: new Date('2026-09-20'),
          nightlyThb: 400000,
        })
      ).rejects.toThrow(/already covers part of this date range/);
    });

    it('refuses a non-positive or non-integer rate', async () => {
      await expect(
        createPricingRule(db, {
          unitId,
          startDate: new Date('2026-09-10'),
          endDate: new Date('2026-09-15'),
          nightlyThb: 0,
        })
      ).rejects.toThrow(/positive integer/);
    });

    it('reverts to the unit base rate once the rule is removed', async () => {
      const unit = await db.unit.findUnique({ where: { id: unitId } });
      const night = new Date('2026-09-12');

      const rule = await createPricingRule(db, {
        unitId,
        startDate: new Date('2026-09-10'),
        endDate: new Date('2026-09-15'),
        nightlyThb: 350000,
      });
      expect(await getApplicableNightlyPrice(db, night, unitId)).toBe(350000);

      await removePricingRule(db, rule.id);

      expect(await getApplicableNightlyPrice(db, night, unitId)).toBe(unit!.baseNightlyThb);
    });

    it('lists a unit’s pricing rules most recent first', async () => {
      await createPricingRule(db, {
        unitId,
        startDate: new Date('2026-11-01'),
        endDate: new Date('2026-11-05'),
        nightlyThb: 300000,
      });
      await createPricingRule(db, {
        unitId,
        startDate: new Date('2026-12-01'),
        endDate: new Date('2026-12-05'),
        nightlyThb: 320000,
      });

      const rules = await getUnitPricingRules(db, unitId);
      expect(rules).toHaveLength(2);
      expect(rules[0].startDate.getTime()).toBeGreaterThan(rules[1].startDate.getTime());
    });
  });
});

describe('pricing override units-error guard (audit P1 #8)', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('refuses an override a hundred times off the base rate — baht typed as satang', async () => {
    const project = await createProject({ status: 'live' });
    const unit = await createUnit({ projectId: project.id, status: 'live', baseNightlyThb: 1300600 });
    // ฿130.06 entered for a ฿13,006 villa: the exact case the audit reproduced.
    await expect(
      createPricingRule(db, {
        unitId: unit.id,
        startDate: new Date('2026-12-01'),
        endDate: new Date('2026-12-04'),
        nightlyThb: 13006,
      })
    ).rejects.toThrow(/outside 1\/10\.\.10x of the base rate/);
  });

  it('accepts a genuine seasonal override within the band', async () => {
    const project = await createProject({ status: 'live' });
    const unit = await createUnit({ projectId: project.id, status: 'live', baseNightlyThb: 1300600 });
    const rule = await createPricingRule(db, {
      unitId: unit.id,
      startDate: new Date('2026-12-20'),
      endDate: new Date('2027-01-05'),
      nightlyThb: 2500000,
    });
    expect(rule.nightlyThb).toBe(2500000);
  });
});
