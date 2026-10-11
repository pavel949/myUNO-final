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

  it('verifies integrity only once the operator has signed', async () => {
    await recordStatementSignOff(db, world.statement.id, 'operator', NOW, world.admin.id);
    await db.ledgerEntry.create({
      data: { entryType: 'cleaning_cost', amountThb: 500, unitId: world.unit.id, occurredOn: new Date('2026-07-02'), description: 'late' },
    });
    const fresh = await db.ownerStatement.findUniqueOrThrow({ where: { id: world.statement.id } });
    await expect(verifyStatementSnapshot(db, fresh)).resolves.toEqual({ ok: true, verified: 'integrity_only' });
  });
});

describe('owner change vs statement approval', () => {
  /**
   * The statement approval holds the unit ledger lock exclusively. An ownership
   * transfer is a source fact of that statement (the ownership chain is in its
   * fingerprint) — but `setUnitOwnerTx` does not take the lock, so nothing
   * orders it against an approval. These tests make that precise.
   *
   * They are written to behave in BOTH worlds — `ownership.service` as it is in
   * main, and with the one-line hunk applied — and never to hang in either:
   * every held transaction is released in a `finally`, and nothing awaits a
   * writer that may legitimately be waiting.
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

  it('GAP in main: the transfer is not ordered against an approval, so it can overtake it', async () => {
    const overtook = await transferDuringApproval();
    // Passes only while ownership.service ignores the lock. Once the hunk lands
    // this fails — delete this test then; the two below carry the acceptance.
    expect(overtook).toBe(true);

    // The consequence: a signature sits on a statement whose sources moved
    // under it. A fresh look at the facts no longer matches what was verified.
    const row = await db.ownerStatement.findUniqueOrThrow({ where: { id: world.statement.id } });
    expect(row.signedOffByOperatorAt).not.toBeNull();
    const sources = await collectSnapshotSources(db, world.period);
    expect(
      sourceFingerprint(world.period, { ownerIdentityId: row.ownerIdentityId, engagementId: row.engagementId }, sources)
    ).not.toBe(row.sourceFingerprint);
  });

  it.fails('ACCEPTANCE: a transfer waits for an approval in flight (fails in main; passes with the hunk)', async () => {
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
