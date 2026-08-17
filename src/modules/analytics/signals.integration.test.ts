import { describe, it, expect, beforeEach } from 'vitest';
import { BuyerSignalStatus } from '@prisma/client';
import {
  db,
  resetDb,
  createIdentity,
  createProject,
  createUnit,
  createBooking,
} from '@/test/util';
import { seedConfig } from '@/modules/config/seed';
import { detectBuyerSignals, transitionBuyerSignal } from './signals';

/**
 * T-038 DoD: detector unit tests, the dedupe rule, and audit-logged funnel
 * transitions.
 *
 * The signal funnel is how the loop's exit ramp is measured (doc 13 §4), so a
 * miscounted or duplicated signal is a miscounted business.
 */
describe('Buyer signals (T-038, doc 13 §4)', () => {
  beforeEach(async () => {
    await resetDb();
    await seedConfig(db);
  });

  async function completedStay(
    guestId: string,
    range: { start: string; end: string }
  ) {
    const project = await createProject();
    const unit = await createUnit(project.id);
    return createBooking({
      unitId: unit.id,
      projectId: project.id,
      guestIdentityId: guestId,
      startDate: new Date(range.start),
      endDate: new Date(range.end),
      status: 'completed',
    });
  }

  describe('repeat_stay detector', () => {
    it('fires at the configured threshold, not before', async () => {
      const guest = await createIdentity();
      await completedStay(guest.id, { start: '2026-03-01', end: '2026-03-04' });

      await detectBuyerSignals(db);
      expect(
        await db.buyerSignal.findFirst({
          where: { identityId: guest.id, signalKey: 'repeat_stay' },
        })
      ).toBeNull();

      // Second completed stay reaches the default threshold of 2.
      await completedStay(guest.id, { start: '2026-04-01', end: '2026-04-04' });
      await detectBuyerSignals(db);

      const signal = await db.buyerSignal.findFirst({
        where: { identityId: guest.id, signalKey: 'repeat_stay' },
      });
      expect(signal?.strength).toBe(2);
      expect(signal?.status).toBe('open');
    });

    it('strengthens to 3 at three or more stays', async () => {
      const guest = await createIdentity();
      await completedStay(guest.id, { start: '2026-03-01', end: '2026-03-04' });
      await completedStay(guest.id, { start: '2026-04-01', end: '2026-04-04' });
      await completedStay(guest.id, { start: '2026-05-01', end: '2026-05-04' });

      await detectBuyerSignals(db);

      const signal = await db.buyerSignal.findFirst({
        where: { identityId: guest.id, signalKey: 'repeat_stay' },
      });
      expect(signal?.strength).toBe(3);
    });

    it('reads the threshold from configuration, not from code', async () => {
      const guest = await createIdentity();
      await completedStay(guest.id, { start: '2026-03-01', end: '2026-03-04' });

      // One stay is below the default of 2 — until the founder lowers the bar.
      await db.configOverride.create({
        data: {
          parameterKey: 'analytics.buyer_signal.repeat_stay_threshold',
          scopeType: 'global',
          scopeId: 'global',
          value: 1,
          updatedByIdentityId: 'test',
        },
      });

      await detectBuyerSignals(db);

      expect(
        await db.buyerSignal.findFirst({
          where: { identityId: guest.id, signalKey: 'repeat_stay' },
        })
      ).not.toBeNull();
    });
  });

  describe('long_stay detector', () => {
    it('ignores a stay shorter than the configured nights', async () => {
      const guest = await createIdentity();
      await completedStay(guest.id, { start: '2026-03-01', end: '2026-03-20' }); // 19 nights

      await detectBuyerSignals(db);

      expect(
        await db.buyerSignal.findFirst({
          where: { identityId: guest.id, signalKey: 'long_stay' },
        })
      ).toBeNull();
    });

    it('fires on a stay at or past the configured nights', async () => {
      const guest = await createIdentity();
      await completedStay(guest.id, { start: '2026-03-01', end: '2026-03-30' }); // 29 nights

      await detectBuyerSignals(db);

      const signal = await db.buyerSignal.findFirst({
        where: { identityId: guest.id, signalKey: 'long_stay' },
      });
      expect(signal?.strength).toBe(2);
    });

    it('reads the night count from configuration', async () => {
      const guest = await createIdentity();
      await completedStay(guest.id, { start: '2026-03-01', end: '2026-03-08' }); // 7 nights

      await db.configOverride.create({
        data: {
          parameterKey: 'analytics.buyer_signal.long_stay_nights',
          scopeType: 'global',
          scopeId: 'global',
          value: 7,
          updatedByIdentityId: 'test',
        },
      });

      await detectBuyerSignals(db);

      expect(
        await db.buyerSignal.findFirst({
          where: { identityId: guest.id, signalKey: 'long_stay' },
        })
      ).not.toBeNull();
    });
  });

  describe('dedupe rule', () => {
    it('keeps one row per identity and key however often detection runs', async () => {
      const guest = await createIdentity();
      await completedStay(guest.id, { start: '2026-03-01', end: '2026-03-04' });
      await completedStay(guest.id, { start: '2026-04-01', end: '2026-04-04' });

      await detectBuyerSignals(db);
      await detectBuyerSignals(db);
      await detectBuyerSignals(db);

      const signals = await db.buyerSignal.findMany({
        where: { identityId: guest.id, signalKey: 'repeat_stay' },
      });

      // Detection is a sweep, not an append — running it hourly must not
      // inflate the funnel.
      expect(signals).toHaveLength(1);
    });

    it('re-opens a closed signal rather than creating a second one', async () => {
      const guest = await createIdentity();
      const staff = await createIdentity();
      await completedStay(guest.id, { start: '2026-03-01', end: '2026-03-04' });
      await completedStay(guest.id, { start: '2026-04-01', end: '2026-04-04' });

      await detectBuyerSignals(db);
      const first = await db.buyerSignal.findFirstOrThrow({
        where: { identityId: guest.id, signalKey: 'repeat_stay' },
      });

      await transitionBuyerSignal(db, first.id, BuyerSignalStatus.dismissed, staff.id);
      await detectBuyerSignals(db);

      const signals = await db.buyerSignal.findMany({
        where: { identityId: guest.id, signalKey: 'repeat_stay' },
      });

      expect(signals).toHaveLength(1);
      expect(signals[0].id).toBe(first.id);
      expect(signals[0].closedAt).toBeNull();
    });

    it('keeps different signal keys apart for the same identity', async () => {
      const guest = await createIdentity();
      await completedStay(guest.id, { start: '2026-03-01', end: '2026-03-04' });
      await completedStay(guest.id, { start: '2026-04-01', end: '2026-05-10' }); // long

      await detectBuyerSignals(db);

      const keys = (
        await db.buyerSignal.findMany({ where: { identityId: guest.id } })
      ).map((s) => s.signalKey);

      expect(keys.sort()).toEqual(['long_stay', 'repeat_stay']);
    });
  });

  describe('funnel transitions are audit-logged', () => {
    async function openSignal() {
      const guest = await createIdentity();
      await completedStay(guest.id, { start: '2026-03-01', end: '2026-03-04' });
      await completedStay(guest.id, { start: '2026-04-01', end: '2026-04-04' });
      await detectBuyerSignals(db);
      return db.buyerSignal.findFirstOrThrow({ where: { identityId: guest.id } });
    }

    it('records who moved the signal, and from which status to which', async () => {
      const staff = await createIdentity();
      const signal = await openSignal();

      await transitionBuyerSignal(
        db,
        signal.id,
        BuyerSignalStatus.reviewed,
        staff.id,
        'Called, wants a two-bed.'
      );

      const entry = await db.auditLog.findFirstOrThrow({
        where: { entityType: 'buyer_signal', entityId: signal.id, action: 'signal_transitioned' },
      });

      expect(entry.actorIdentityId).toBe(staff.id);
      const data = entry.data as { fromStatus: string; toStatus: string; notes: string };
      // The row before the write, not after it — a from == to entry is no
      // history at all.
      expect(data.fromStatus).toBe('open');
      expect(data.toStatus).toBe('reviewed');
      expect(data.notes).toBe('Called, wants a two-bed.');
    });

    it('leaves a trail across the whole funnel, in order', async () => {
      const staff = await createIdentity();
      const signal = await openSignal();

      await transitionBuyerSignal(db, signal.id, BuyerSignalStatus.reviewed, staff.id);
      await transitionBuyerSignal(
        db,
        signal.id,
        BuyerSignalStatus.handed_to_capital,
        staff.id
      );

      const entries = await db.auditLog.findMany({
        where: { entityId: signal.id, action: 'signal_transitioned' },
        orderBy: { createdAt: 'asc' },
      });

      expect(
        entries.map((e) => (e.data as { fromStatus: string; toStatus: string }))
      ).toEqual([
        { fromStatus: 'open', toStatus: 'reviewed' },
        { fromStatus: 'reviewed', toStatus: 'handed_to_capital' },
      ]);
    });

    it('closes the signal when it leaves the open state', async () => {
      const staff = await createIdentity();
      const signal = await openSignal();

      const dismissed = await transitionBuyerSignal(
        db,
        signal.id,
        BuyerSignalStatus.dismissed,
        staff.id
      );

      expect(dismissed.status).toBe('dismissed');
      expect(dismissed.closedAt).toBeInstanceOf(Date);
      expect(dismissed.reviewedByIdentityId).toBe(staff.id);
    });
  });
});
