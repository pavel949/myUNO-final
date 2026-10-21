/* eslint-disable no-restricted-imports */
import { beforeEach, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import {
  createBooking,
  createIdentity,
  createProject,
  createRoleAssignment,
  createUnit,
  db,
  resetDb,
} from '@/test/util';
import { setUnitOwner, setUnitOwnerTx } from '@/modules/projects/ownership.service';
import { lockUnitLedgerExclusive, lockUnitLedgerShared } from './ledger.service';
import { recordManualCost } from './manual-cost.service';
import { StatementSignOffError, recordStatementSignOff } from './statement-signoff.service';
import { collectSnapshotSources, snapshotHash, sourceFingerprint, verifyStatementSnapshot } from './statement-snapshot';

/**
 * The unit ledger lock: what it serialises, and — stated as tests — what it
 * cannot serialise until `ownership.service` joins it.
 */

const NOW = new Date('2026-10-10T05:00:00.000Z');
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Hold a transaction open (with whatever it locked) until `release()`. */
function holdOpen(work: (tx: Parameters<Parameters<typeof db.$transaction>[0]>[0]) => Promise<void>) {
  let release!: () => void;
  let acquired!: () => void;
  const gate = new Promise<void>((resolve) => (release = resolve));
  const ready = new Promise<void>((resolve) => (acquired = resolve));
  const done = db.$transaction(
    async (tx) => {
      await work(tx);
      acquired();
      await gate;
    },
    { timeout: 30_000, maxWait: 30_000 }
  );
  return { release, ready, done };
}

/** Whether `promise` settles within `ms`. */
async function settlesWithin(promise: Promise<unknown>, ms: number): Promise<boolean> {
  let settled = false;
  void promise.then(
    () => (settled = true),
    () => (settled = true)
  );
  await sleep(ms);
  return settled;
}

let world: Awaited<ReturnType<typeof build>>;

async function build() {
  const project = await createProject({ status: 'live' });
  const [owner, newOwner, staff, admin] = await Promise.all([
    createIdentity(),
    createIdentity(),
    createIdentity(),
    createIdentity({ isAdmin: true }),
  ]);
  await createRoleAssignment({ identityId: staff.id, role: 'staff_ops', scopeType: 'project', projectId: project.id });
  const unit = await createUnit({ projectId: project.id, ownerIdentityId: owner.id });
  const engagement = await db.unitEngagement.create({
    data: { unitId: unit.id, ownerIdentityId: owner.id, engagementType: 'direct_managed', status: 'active', noiCapAnnualThb: 50_000_000 },
  });
  await createBooking({
    unitId: unit.id, projectId: project.id, guestIdentityId: newOwner.id,
    startDate: new Date('2026-07-05'), endDate: new Date('2026-07-10'), totalThb: 900_000,
  });
  const period = { unitId: unit.id, periodStart: new Date('2026-07-01'), periodEnd: new Date('2026-07-31') };
  const sources = await collectSnapshotSources(db, period);
  const figures = {
    grossRevenueTh: 900_000, totalCostsTh: 0, noiTh: 900_000, ownerShareTh: 900_000, estateShareTh: 0, capApplied: false,
    grossBookingsAmountTh: 900_000, guestPaymentsReceivedTh: 0, serviceFeesAmountTh: 0, operatingExpensesAmountTh: 0,
    taxesAmountTh: 0, adjustedNoiTh: 900_000, distributableCashTh: 900_000, performanceFeeAmountTh: 0, performanceFeeBasisText: null,
  };
  const statement = await db.ownerStatement.create({
    data: {
      unitId: unit.id, ownerIdentityId: owner.id, engagementId: engagement.id,
      periodStart: period.periodStart, periodEnd: period.periodEnd,
      ...figures,
      sourceFingerprint: sourceFingerprint(period, { ownerIdentityId: owner.id, engagementId: engagement.id }, sources),
      snapshotHash: snapshotHash(figures, []),
      status: 'published',
    },
  });
  return { project, owner, newOwner, staff, admin, unit, engagement, statement, period };
}

const cost = (patch: { occurredOn?: string } = {}) => ({
  unitId: world.unit.id, entryType: 'cleaning_cost' as const, amountSatang: 100_000,
  occurredOn: patch.occurredOn ?? '2026-07-20', description: 'Cleaning', idempotencyKey: randomUUID(),
});

beforeEach(async () => {
  await resetDb();
  world = await build();
});

describe('unit ledger lock', () => {
  it('holds a cost back while a statement is being frozen, and lets it through right after', async () => {
    const freeze = holdOpen((tx) => lockUnitLedgerExclusive(tx, world.unit.id));
    await freeze.ready;

    const write = recordManualCost(db, world.staff, cost(), NOW);
    expect(await settlesWithin(write, 600)).toBe(false);
    expect(await db.ledgerEntry.count({ where: { unitId: world.unit.id } })).toBe(0);

    freeze.release();
    await freeze.done;
    await expect(write).resolves.toMatchObject({ replayed: false });
    expect(await db.ledgerEntry.count({ where: { unitId: world.unit.id } })).toBe(1);
  });

  it('does not make independent cost writers wait for each other', async () => {
    const writer = holdOpen((tx) => lockUnitLedgerShared(tx, world.unit.id));
    await writer.ready;
    const second = recordManualCost(db, world.staff, cost(), NOW);
    expect(await settlesWithin(second, 1500)).toBe(true);
    writer.release();
    await writer.done;
  });

  it('is per unit: freezing one unit never stalls another', async () => {
    const other = await createUnit({ projectId: world.project.id, ownerIdentityId: world.owner.id });
    const freeze = holdOpen((tx) => lockUnitLedgerExclusive(tx, other.id));
    await freeze.ready;
    expect(await settlesWithin(recordManualCost(db, world.staff, cost(), NOW), 1500)).toBe(true);
    freeze.release();
    await freeze.done;
  });

  it('makes sign-off wait for an in-flight cost, then judge the statement against it', async () => {
    // A cost is mid-write: row inserted, lock held, not yet committed.
    const inFlight = holdOpen(async (tx) => {
      await lockUnitLedgerShared(tx, world.unit.id);
      await tx.ledgerEntry.create({
        data: {
          entryType: 'cleaning_cost', amountThb: -100_000, unitId: world.unit.id, projectId: world.project.id,
          occurredOn: new Date('2026-07-20'), description: 'In flight', createdByIdentityId: world.staff.id,
          manualCostKey: randomUUID(), manualCostFingerprint: 'e'.repeat(64),
        },
      });
    });
    await inFlight.ready;

    const signing = recordStatementSignOff(db, world.statement.id, 'operator', NOW, world.admin.id);
    const outcome = signing.then(() => 'signed', (e) => e);
    expect(await settlesWithin(signing.catch(() => null), 600)).toBe(false); // it waits; it does not sign blind

    inFlight.release();
    await inFlight.done;
    const result = await outcome;
    expect(result).toBeInstanceOf(StatementSignOffError);
    expect((result as StatementSignOffError).reason).toBe('stale');
    expect((await db.ownerStatement.findUniqueOrThrow({ where: { id: world.statement.id } })).signedOffByOperatorAt).toBeNull();
  });

  it('signs a statement that nothing has touched, and records which check it passed', async () => {
    await recordStatementSignOff(db, world.statement.id, 'operator', NOW, world.admin.id);
    const audit = await db.auditLog.findFirstOrThrow({ where: { action: 'statement_signed', entityId: world.statement.id } });
    expect(audit.data).toMatchObject({ signer: 'operator', verified: 'full' });
  });

  it('treats a statement generated before the snapshot columns existed as unverifiable, not stale', async () => {
    await db.ownerStatement.update({ where: { id: world.statement.id }, data: { sourceFingerprint: null, snapshotHash: null } });
    await db.ledgerEntry.create({
      data: {
        entryType: 'cleaning_cost', amountThb: 500, unitId: world.unit.id, occurredOn: new Date('2026-07-02'), description: 'legacy',
      },
    });
    await expect(recordStatementSignOff(db, world.statement.id, 'operator', NOW, world.admin.id)).resolves.toMatchObject({
      status: 'pending_owner_review',
    });
    const audit = await db.auditLog.findFirstOrThrow({ where: { action: 'statement_signed' } });
    expect(audit.data).toMatchObject({ verified: 'legacy_unverifiable' });
  });

  it('rejects an unsigned statement after a same-total date move within its period', async () => {
    const stay = await db.booking.findFirstOrThrow({ where: { unitId: world.unit.id } });
    await db.booking.update({ where: { id: stay.id }, data: { startDate: new Date('2026-07-06'), endDate: new Date('2026-07-11') } });
    await expect(recordStatementSignOff(db, world.statement.id, 'operator', NOW, world.admin.id)).rejects.toMatchObject({ reason: 'stale' });
    expect((await db.ownerStatement.findUniqueOrThrow({ where: { id: world.statement.id } })).signedOffByOperatorAt).toBeNull();
    expect((await db.booking.findUniqueOrThrow({ where: { id: stay.id } })).totalThb).toBe(stay.totalThb);
  });

  it('preserves issued signed snapshot integrity after a same-total date move', async () => {
    await recordStatementSignOff(db, world.statement.id, 'operator', NOW, world.admin.id);
    const signed = await db.ownerStatement.findUniqueOrThrow({ where: { id: world.statement.id } });
    const stay = await db.booking.findFirstOrThrow({ where: { unitId: world.unit.id } });
    await db.booking.update({ where: { id: stay.id }, data: { startDate: new Date('2026-07-06'), endDate: new Date('2026-07-11') } });
    await expect(verifyStatementSnapshot(db, signed)).resolves.toEqual({ ok: true, verified: 'integrity_only' });
    expect(await db.ownerStatement.findUniqueOrThrow({ where: { id: world.statement.id } })).toMatchObject({ sourceFingerprint: signed.sourceFingerprint, snapshotHash: signed.snapshotHash });
  });

  it('verifies integrity only once the operator has signed', async () => {
    await recordStatementSignOff(db, world.statement.id, 'operator', NOW, world.admin.id);
    await db.ledgerEntry.create({
      data: { entryType: 'cleaning_cost', amountThb: 500, unitId: world.unit.id, occurredOn: new Date('2026-07-02'), description: 'late' },
    });
    const fresh = await db.ownerStatement.findUniqueOrThrow({ where: { id: world.statement.id } });
    await expect(verifyStatementSnapshot(db, fresh)).resolves.toEqual({ ok: true, verified: 'integrity_only' });
  });

  it('rejects a signature when a new paid crossing cancellation was absent from the contained-source hash', async () => {
    const crossing = await createBooking({
      unitId: world.unit.id, projectId: world.project.id, guestIdentityId: world.newOwner.id,
      startDate: new Date('2026-06-29'), endDate: new Date('2026-07-03'), status: 'cancelled', totalThb: 12_000,
    });
    await db.payment.create({ data: {
      bookingId: crossing.id, payerIdentityId: world.newOwner.id, purpose: 'stay_balance',
      method: 'cash', provider: 'cash', amountThb: 5_000, status: 'succeeded', succeededAt: NOW,
    } });
    await expect(collectSnapshotSources(db, world.period)).rejects.toMatchObject({ code: 'STATEMENT_ALLOCATION_REQUIRED', bookingId: crossing.id });
    await expect(recordStatementSignOff(db, world.statement.id, 'operator', NOW, world.admin.id)).rejects.toMatchObject({ reason: 'stale' });
    expect((await db.ownerStatement.findUniqueOrThrow({ where: { id: world.statement.id } })).signedOffByOperatorAt).toBeNull();
  });

  it('preserves an operator-signed snapshot when a paid crossing cancellation is added later', async () => {
    await recordStatementSignOff(db, world.statement.id, 'operator', NOW, world.admin.id);
    const signed = await db.ownerStatement.findUniqueOrThrow({ where: { id: world.statement.id } });
    const crossing = await createBooking({
      unitId: world.unit.id, projectId: world.project.id, guestIdentityId: world.newOwner.id,
      startDate: new Date('2026-07-29'), endDate: new Date('2026-08-03'), status: 'cancelled', totalThb: 12_000,
    });
    await db.payment.create({ data: {
      bookingId: crossing.id, payerIdentityId: world.newOwner.id, purpose: 'stay',
      method: 'cash', provider: 'cash', amountThb: 5_000, status: 'succeeded', succeededAt: NOW,
    } });
    await expect(verifyStatementSnapshot(db, signed)).resolves.toEqual({ ok: true, verified: 'integrity_only' });
    expect((await db.ownerStatement.findUniqueOrThrow({ where: { id: signed.id } })).snapshotHash).toBe(signed.snapshotHash);
  });
});

describe('owner change vs statement approval', () => {
  /**
   * The statement approval holds the unit ledger lock exclusively. An ownership
   * transfer is a source fact of that statement (the ownership chain is in its
   * fingerprint), so `setUnitOwnerTx` takes the same lock: a transfer and an
   * approval of the same unit are ordered, never interleaved.
   *
   * Every held transaction is released in a `finally`, and nothing awaits a
   * writer that is legitimately waiting.
   */
  const transfer = () =>
    setUnitOwner(db, { unitId: world.unit.id, ownerIdentityId: world.newOwner.id, effectiveFrom: new Date('2026-07-15') });

  /** An approval that has verified the statement and is about to sign it. */
  const approvalAboutToSign = () =>
    holdOpen(async (tx) => {
      await lockUnitLedgerExclusive(tx, world.unit.id);
      const row = await tx.ownerStatement.findUniqueOrThrow({ where: { id: world.statement.id } });
      expect((await verifyStatementSnapshot(tx, row)).ok).toBe(true);
      await tx.ownerStatement.update({
        where: { id: world.statement.id },
        data: { signedOffByOperatorAt: NOW, status: 'pending_owner_review' },
      });
    });

  async function transferDuringApproval() {
    const approval = approvalAboutToSign();
    await approval.ready;
    const moved = transfer();
    const overtook = await settlesWithin(moved, 1200);
    approval.release();
    await Promise.all([approval.done, moved]);
    return overtook;
  }

  it('a transfer waits for an approval in flight, because ownership.service takes the unit ledger lock', async () => {
    expect(await transferDuringApproval()).toBe(false);
  });

  it('with the lock taken first (the proposed hunk, applied here as a wrapper) the transfer lands after the approval', async () => {
    const approval = approvalAboutToSign();
    await approval.ready;
    // `setUnitOwnerTx` whose first line is `await lockUnitLedgerExclusive(tx, unitId)`:
    const moved = db.$transaction(async (tx) => {
      await lockUnitLedgerExclusive(tx, world.unit.id);
      return setUnitOwnerTx(tx, {
        unitId: world.unit.id, ownerIdentityId: world.newOwner.id, effectiveFrom: new Date('2026-07-15'),
      });
    });
    let waited: boolean;
    try {
      waited = !(await settlesWithin(moved, 800));
    } finally {
      approval.release();
    }
    await Promise.all([approval.done, moved]);
    expect(waited).toBe(true);

    // The approval committed against the facts it verified; the transfer is a
    // LATER fact, which the next check sees.
    const row = await db.ownerStatement.findUniqueOrThrow({ where: { id: world.statement.id } });
    expect(row.signedOffByOperatorAt).not.toBeNull();
    expect(await verifyStatementSnapshot(db, { ...row, signedOffByOperatorAt: null })).toEqual({ ok: false, reason: 'stale' });
  });
});


describe('source receivable review blocks financial close', () => {
  async function requireReview() {
    await db.booking.updateMany({ where: { unitId: world.unit.id }, data: { receivableStatus: 'pending_reconciliation' } });
  }
  it('refuses generation sources instead of recognizing source claims as distributable cash', async () => {
    await requireReview();
    await expect(collectSnapshotSources(db, world.period)).rejects.toMatchObject({ code: 'STATEMENT_RECEIVABLE_RECONCILIATION_REQUIRED' });
  });
  it('checks review before legacy and operator-signed snapshot exemptions', async () => {
    await requireReview();
    await expect(verifyStatementSnapshot(db, { ...world.statement, sourceFingerprint: null, snapshotHash: null }))
      .resolves.toEqual({ ok: false, reason: 'receivable_review' });
    await expect(verifyStatementSnapshot(db, { ...world.statement, signedOffByOperatorAt: NOW }))
      .resolves.toEqual({ ok: false, reason: 'receivable_review' });
    await expect(recordStatementSignOff(db, world.statement.id, 'operator', NOW, world.admin.id))
      .rejects.toMatchObject({ reason: 'receivable_review' });
  });
  it('DB guard blocks bypass generation, distribution and owner payout without altering issued history', async () => {
    await requireReview();
    await expect(db.ownerStatement.create({ data: { ...world.statement, id: randomUUID(), status: 'draft' } }))
      .rejects.toThrow('STATEMENT_RECEIVABLE_RECONCILIATION_REQUIRED');
    await expect(db.ownerStatement.update({ where: { id: world.statement.id }, data: { status: 'distributed' } }))
      .rejects.toThrow('STATEMENT_RECEIVABLE_RECONCILIATION_REQUIRED');
    await expect(db.payout.create({ data: {
      payeeType: 'owner', ownerStatementId: world.statement.id, amountThb: world.statement.ownerShareTh,
      periodStart: world.period.periodStart, periodEnd: world.period.periodEnd,
      method: 'bank_transfer_thb', reference: 'SYNTHETIC-REVIEW', executedOn: NOW,
      recordedByIdentityId: world.admin.id, status: 'recorded',
    } })).rejects.toThrow('STATEMENT_RECEIVABLE_RECONCILIATION_REQUIRED');
    expect(await db.ownerStatement.findUniqueOrThrow({ where: { id: world.statement.id } }))
      .toMatchObject({ status: world.statement.status, sourceFingerprint: world.statement.sourceFingerprint,
        snapshotHash: world.statement.snapshotHash, ownerShareTh: world.statement.ownerShareTh });
    expect(await db.payout.count({ where: { ownerStatementId: world.statement.id } })).toBe(0);
  });
});
