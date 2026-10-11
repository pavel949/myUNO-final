/* eslint-disable no-restricted-imports */
import { beforeEach, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import {
  createIdentity,
  createOrganization,
  createProject,
  createRoleAssignment,
  createUnit,
  db,
  resetDb,
} from '@/test/util';
import { LedgerCorrectionError, reverseManualCost } from './ledger.service';
import { ManualCostInputError, parseManualCostRequest, type ManualCostRequest } from './manual-cost-input';
import { ManualCostError, recordManualCost } from './manual-cost.service';

/**
 * Service-level acceptance for the manual-cost writer: one authoritative row,
 * idempotent under retry, lost responses and simultaneous submits; authority
 * decided per unit against live data; the row immutable once written; one
 * reversal per cost no matter how many are attempted at once.
 */

const NOW = new Date('2026-10-10T05:00:00.000Z');

function request(world: World, patch: Partial<ManualCostRequest> = {}): ManualCostRequest {
  return {
    unitId: world.unit.id,
    entryType: 'cleaning_cost',
    amountSatang: 250_000,
    occurredOn: '2026-10-09',
    description: 'Deep clean after checkout',
    idempotencyKey: randomUUID(),
    ...patch,
  };
}

type World = Awaited<ReturnType<typeof buildWorld>>;

async function buildWorld() {
  const project = await createProject({ status: 'live' });
  const otherProject = await createProject({ status: 'live' });
  const owner = await createIdentity();
  const staff = await createIdentity();
  const colleague = await createIdentity();
  const admin = await createIdentity({ isAdmin: true });
  const stranger = await createIdentity();

  const unit = await createUnit({ projectId: project.id, ownerIdentityId: owner.id });
  const secondUnit = await createUnit({ projectId: project.id, ownerIdentityId: owner.id });
  const foreignUnit = await createUnit({ projectId: otherProject.id, ownerIdentityId: owner.id });

  const staffRole = await createRoleAssignment({
    identityId: staff.id,
    role: 'staff_ops',
    scopeType: 'project',
    projectId: project.id,
  });
  await createRoleAssignment({
    identityId: colleague.id,
    role: 'staff_ops',
    scopeType: 'project',
    projectId: project.id,
  });

  return { project, otherProject, owner, staff, colleague, admin, stranger, unit, secondUnit, foreignUnit, staffRole };
}

async function ledgerRows(unitId: string) {
  return db.ledgerEntry.findMany({ where: { unitId } });
}

describe('recordManualCost — one authoritative record', () => {
  let world: World;

  beforeEach(async () => {
    await resetDb();
    world = await buildWorld();
  });

  describe('what is stored', () => {
    it('writes the cost negative, on a UTC-midnight business date, attributed to the actor and the unit’s project', async () => {
      const result = await recordManualCost(db, world.staff, request(world), NOW);
      expect(result.replayed).toBe(false);
      expect(result.entry).toMatchObject({ amountSatang: 250_000, occurredOn: '2026-10-09', unitId: world.unit.id });

      const [row] = await ledgerRows(world.unit.id);
      expect(row).toMatchObject({
        entryType: 'cleaning_cost',
        amountThb: -250_000,
        projectId: world.project.id,
        createdByIdentityId: world.staff.id,
      });
      expect(row.occurredOn.toISOString()).toBe('2026-10-09T00:00:00.000Z');
      expect(row.manualCostKey).toBeTruthy();
      expect(row.manualCostFingerprint).toMatch(/^[0-9a-f]{64}$/);
    });

    it('records the business date as given, independent of the server clock', async () => {
      await recordManualCost(db, world.staff, request(world, { occurredOn: '2026-09-30' }), NOW);
      await recordManualCost(db, world.staff, request(world, { occurredOn: '2026-10-01' }), NOW);
      const days = (await ledgerRows(world.unit.id)).map((r) => r.occurredOn.toISOString().slice(0, 10)).sort();
      expect(days).toEqual(['2026-09-30', '2026-10-01']);
    });

    it('writes one audit event, not one per retry', async () => {
      const req = request(world);
      await recordManualCost(db, world.staff, req, NOW);
      await recordManualCost(db, world.staff, req, NOW);
      expect(await db.auditLog.count({ where: { action: 'manual_cost_recorded' } })).toBe(1);
    });
  });

  describe('idempotency', () => {
    it('answers an identical retry with the same row and writes nothing', async () => {
      const req = request(world);
      const first = await recordManualCost(db, world.staff, req, NOW);
      const second = await recordManualCost(db, world.staff, req, NOW);
      expect(second.replayed).toBe(true);
      expect(second.entry.id).toBe(first.entry.id);
      expect(await ledgerRows(world.unit.id)).toHaveLength(1);
    });

    it('treats whitespace-only differences in the description as the same request', async () => {
      const req = request(world, { description: 'Deep clean after checkout' });
      const first = await recordManualCost(db, world.staff, req, NOW);
      const second = await recordManualCost(
        db,
        world.staff,
        { ...req, description: '  Deep   clean after checkout ' },
        NOW
      );
      expect(second.entry.id).toBe(first.entry.id);
    });

    it.each([
      ['amount', { amountSatang: 250_001 }],
      ['description', { description: 'Something else entirely' }],
      ['date', { occurredOn: '2026-10-08' }],
      ['type', { entryType: 'maintenance_cost' as const }],
    ])('refuses the same key with a different %s and adds no row', async (_what, patch) => {
      const req = request(world);
      await recordManualCost(db, world.staff, req, NOW);
      await expect(recordManualCost(db, world.staff, { ...req, ...patch }, NOW)).rejects.toMatchObject({
        kind: 'idempotency_conflict',
      });
      const rows = await ledgerRows(world.unit.id);
      expect(rows).toHaveLength(1);
      expect(rows[0].amountThb).toBe(-250_000);
    });

    it('refuses the same key pointed at another unit the actor may write, without revealing the first', async () => {
      const req = request(world);
      await recordManualCost(db, world.staff, req, NOW);
      const err = await recordManualCost(db, world.staff, { ...req, unitId: world.secondUnit.id }, NOW).catch((e) => e);
      expect(err).toBeInstanceOf(ManualCostError);
      expect(err.kind).toBe('idempotency_conflict');
      expect(err.message).not.toContain(world.unit.id);
      expect(await ledgerRows(world.secondUnit.id)).toHaveLength(0);
    });

    it('collapses ten simultaneous submits of one attempt into a single row', async () => {
      const req = request(world);
      const results = await Promise.all(
        Array.from({ length: 10 }, () => recordManualCost(db, world.staff, req, NOW))
      );
      expect(new Set(results.map((r) => r.entry.id)).size).toBe(1);
      expect(results.filter((r) => !r.replayed)).toHaveLength(1);
      expect(await ledgerRows(world.unit.id)).toHaveLength(1);
      expect(await db.auditLog.count({ where: { action: 'manual_cost_recorded' } })).toBe(1);
    });

    it('lets simultaneous submits with different content race to exactly one winner and conflicts for the rest', async () => {
      const key = randomUUID();
      const outcomes = await Promise.allSettled(
        [1, 2, 3, 4].map((n) =>
          recordManualCost(db, world.staff, request(world, { idempotencyKey: key, amountSatang: n * 1000 }), NOW)
        )
      );
      expect(outcomes.filter((o) => o.status === 'fulfilled')).toHaveLength(1);
      for (const o of outcomes.filter((o) => o.status === 'rejected') as PromiseRejectedResult[]) {
        expect(o.reason).toMatchObject({ kind: 'idempotency_conflict' });
      }
      expect(await ledgerRows(world.unit.id)).toHaveLength(1);
    });

    it('recovers a lost response: the client that never saw the answer retries and gets the committed row', async () => {
      const req = request(world);
      const committed = await recordManualCost(db, world.staff, req, NOW); // response dropped on the way back
      const retry = await recordManualCost(db, world.staff, req, NOW);
      expect(retry).toMatchObject({ replayed: true, entry: { id: committed.entry.id } });
    });

    it('scopes a key to its recorder: a colleague with the same key neither sees nor collides with the row', async () => {
      const req = request(world);
      const mine = await recordManualCost(db, world.staff, req, NOW);
      const theirs = await recordManualCost(db, world.colleague, req, NOW);
      expect(theirs.replayed).toBe(false);
      expect(theirs.entry.id).not.toBe(mine.entry.id);
      expect(await ledgerRows(world.unit.id)).toHaveLength(2);
    });
  });

  describe('authority is per unit and live', () => {
    it('refuses a retry once the role is revoked — a replay is not a back door', async () => {
      const req = request(world);
      await recordManualCost(db, world.staff, req, NOW);
      await db.roleAssignment.update({ where: { id: world.staffRole.id }, data: { status: 'revoked' } });
      await expect(recordManualCost(db, world.staff, req, NOW)).rejects.toMatchObject({ kind: 'forbidden' });
    });

    it('refuses a blocked identity, even with a valid role', async () => {
      const blocked = await db.identity.update({ where: { id: world.staff.id }, data: { status: 'blocked' } });
      await expect(recordManualCost(db, blocked, request(world), NOW)).rejects.toMatchObject({ kind: 'forbidden' });
    });

    it('refuses strangers, staff of another project, and a guessed foreign unit — with the same answer', async () => {
      for (const actor of [world.stranger, world.staff]) {
        const target = actor === world.staff ? world.foreignUnit : world.unit;
        await expect(
          recordManualCost(db, actor, request(world, { unitId: target.id }), NOW)
        ).rejects.toMatchObject({ kind: 'forbidden' });
      }
      await expect(
        recordManualCost(db, world.staff, request(world, { unitId: 'does-not-exist' }), NOW)
      ).rejects.toMatchObject({ kind: 'forbidden' });
      expect(await db.ledgerEntry.count()).toBe(0);
    });

    it('lets an admin through and tells an admin when the unit does not exist', async () => {
      const ok = await recordManualCost(db, world.admin, request(world), NOW);
      expect(ok.replayed).toBe(false);
      await expect(
        recordManualCost(db, world.admin, request(world, { unitId: 'does-not-exist' }), NOW)
      ).rejects.toMatchObject({ kind: 'unit_not_found' });
    });

    it('limits unit-scoped staff to their own unit', async () => {
      const unitStaff = await createIdentity();
      await createRoleAssignment({ identityId: unitStaff.id, role: 'staff_ops', scopeType: 'unit', unitId: world.unit.id });
      await expect(recordManualCost(db, unitStaff, request(world), NOW)).resolves.toMatchObject({ replayed: false });
      await expect(
        recordManualCost(db, unitStaff, request(world, { unitId: world.secondUnit.id }), NOW)
      ).rejects.toMatchObject({ kind: 'forbidden' });
    });

    describe('an MC member', () => {
      async function mcMember(orgId: string) {
        const member = await createIdentity();
        await db.roleAssignment.create({
          data: {
            identityId: member.id,
            role: 'mc_member',
            scopeType: 'project',
            projectId: world.project.id,
            organizationId: orgId,
            status: 'active',
          },
        });
        return member;
      }

      it('may record only on units their own company currently manages', async () => {
        const ours = await createOrganization('Our MC', world.project.id);
        const theirs = await createOrganization('Their MC', world.project.id);
        await db.unitEngagement.create({
          data: {
            unitId: world.unit.id,
            ownerIdentityId: world.owner.id,
            engagementType: 'via_management_company',
            managementOrgId: ours.id,
            status: 'active',
          },
        });
        await db.unitEngagement.create({
          data: {
            unitId: world.secondUnit.id,
            ownerIdentityId: world.owner.id,
            engagementType: 'via_management_company',
            managementOrgId: theirs.id,
            status: 'active',
          },
        });
        const member = await mcMember(ours.id);

        await expect(recordManualCost(db, member, request(world), NOW)).resolves.toMatchObject({ replayed: false });
        // A neighbouring villa in the SAME project, managed by someone else.
        await expect(
          recordManualCost(db, member, request(world, { unitId: world.secondUnit.id }), NOW)
        ).rejects.toMatchObject({ kind: 'forbidden' });
      });

      it('loses the right when the mandate ends', async () => {
        const ours = await createOrganization('Our MC', world.project.id);
        const engagement = await db.unitEngagement.create({
          data: {
            unitId: world.unit.id,
            ownerIdentityId: world.owner.id,
            engagementType: 'via_management_company',
            managementOrgId: ours.id,
            status: 'active',
          },
        });
        const member = await mcMember(ours.id);
        await recordManualCost(db, member, request(world), NOW);
        await db.unitEngagement.update({ where: { id: engagement.id }, data: { endsOn: new Date('2026-10-01') } });
        await expect(recordManualCost(db, member, request(world), NOW)).rejects.toMatchObject({ kind: 'forbidden' });
      });
    });
  });

  describe('validation happens before anything is written', () => {
    it('refuses a future business date in the unit’s own time zone', async () => {
      // 05:00 UTC on 10 Oct is 22:00 on 9 Oct in Los Angeles.
      await db.project.update({ where: { id: world.project.id }, data: { timezone: 'America/Los_Angeles' } });
      await expect(
        recordManualCost(db, world.staff, request(world, { occurredOn: '2026-10-10' }), NOW)
      ).rejects.toBeInstanceOf(ManualCostInputError);
      await expect(
        recordManualCost(db, world.staff, request(world, { occurredOn: '2026-10-09' }), NOW)
      ).resolves.toMatchObject({ replayed: false });
    });

    it('rejects a body that never reaches the service as a non-cost type', () => {
      expect(() =>
        parseManualCostRequest(
          { unitId: world.unit.id, entryType: 'adjustment', amountThb: 5, occurredOn: '2026-10-09', description: 'trick' },
          randomUUID(),
          NOW
        )
      ).toThrow(ManualCostInputError);
    });
  });

  describe('the database holds the line too', () => {
    it('refuses a manual cost stored as income, with an instant for a date, or with half a replay pair', async () => {
      const base = {
        entryType: 'cleaning_cost' as const,
        unitId: world.unit.id,
        projectId: world.project.id,
        description: 'raw insert',
        createdByIdentityId: world.staff.id,
        manualCostKey: randomUUID(),
        manualCostFingerprint: 'f'.repeat(64),
      };
      await expect(
        db.ledgerEntry.create({ data: { ...base, amountThb: 100, occurredOn: new Date('2026-10-09') } })
      ).rejects.toThrow(/manual_cost_is_outflow|violates check/);
      await expect(
        db.ledgerEntry.create({ data: { ...base, amountThb: -100, occurredOn: new Date('2026-10-09T13:00:00Z') } })
      ).rejects.toThrow(/business_date|violates check/);
      await expect(
        db.ledgerEntry.create({
          data: { ...base, manualCostFingerprint: null, amountThb: -100, occurredOn: new Date('2026-10-09') },
        })
      ).rejects.toThrow(/manual_cost_pair|violates check/);
    });

    it('makes a recorded cost immutable: no edit of the fact, no delete — only the statement link may move', async () => {
      const { entry } = await recordManualCost(db, world.staff, request(world), NOW);
      await expect(
        db.ledgerEntry.update({ where: { id: entry.id }, data: { amountThb: -1 } })
      ).rejects.toThrow(/immutable/i);
      await expect(
        db.ledgerEntry.update({ where: { id: entry.id }, data: { description: 'rewritten' } })
      ).rejects.toThrow(/immutable/i);
      await expect(
        db.ledgerEntry.update({ where: { id: entry.id }, data: { occurredOn: new Date('2026-09-01') } })
      ).rejects.toThrow(/immutable/i);
      await expect(db.ledgerEntry.delete({ where: { id: entry.id } })).rejects.toThrow(/immutable/i);
      await expect(
        db.$executeRaw`DELETE FROM ledger_entry WHERE id = ${entry.id}`
      ).rejects.toThrow(/immutable/i);

      const statement = await db.ownerStatement.create({
        data: {
          unitId: world.unit.id,
          ownerIdentityId: world.owner.id,
          engagementId: (
            await db.unitEngagement.create({
              data: { unitId: world.unit.id, ownerIdentityId: world.owner.id, engagementType: 'direct_managed', status: 'active', noiCapAnnualThb: 1 },
            })
          ).id,
          periodStart: new Date('2026-10-01'),
          periodEnd: new Date('2026-10-31'),
          grossRevenueTh: 0, totalCostsTh: 0, noiTh: 0, ownerShareTh: 0, estateShareTh: 0,
        },
      });
      await expect(
        db.ledgerEntry.update({ where: { id: entry.id }, data: { statementId: statement.id } })
      ).resolves.toMatchObject({ statementId: statement.id });
      const row = await db.ledgerEntry.findUniqueOrThrow({ where: { id: entry.id } });
      expect(row.amountThb).toBe(-250_000);
    });

    it('leaves legacy rows (no replay key) as editable as they always were', async () => {
      const legacy = await db.ledgerEntry.create({
        data: {
          entryType: 'cleaning_cost', amountThb: 5000, unitId: world.unit.id, projectId: world.project.id,
          occurredOn: new Date('2026-07-01'), description: 'legacy',
        },
      });
      await expect(db.ledgerEntry.update({ where: { id: legacy.id }, data: { description: 'fixed typo' } })).resolves.toBeTruthy();
    });
  });
});

describe('reverseManualCost — one reversal per cost', () => {
  let world: World;
  let costId: string;

  beforeEach(async () => {
    await resetDb();
    world = await buildWorld();
    costId = (await recordManualCost(db, world.staff, request(world), NOW)).entry.id;
  });

  it('adds a linked, opposite-signed row and leaves the original untouched', async () => {
    const { reversal, dating } = await reverseManualCost(db, {
      entryId: costId,
      reason: 'Entered twice by mistake',
      actorIdentityId: world.admin.id,
      now: NOW,
    });
    expect(reversal).toMatchObject({ entryType: 'adjustment', amountThb: 250_000, reversesEntryId: costId });
    expect(reversal.occurredOn.toISOString()).toBe('2026-10-09T00:00:00.000Z');
    expect(dating).toBe('same_period');
    const original = await db.ledgerEntry.findUniqueOrThrow({ where: { id: costId } });
    expect(original.amountThb).toBe(-250_000);
    expect(await db.auditLog.count({ where: { action: 'ledger_entry_reversed', entityId: costId } })).toBe(1);
  });

  it('lets exactly one of eight simultaneous reversals land', async () => {
    const outcomes = await Promise.allSettled(
      Array.from({ length: 8 }, (_, i) =>
        reverseManualCost(db, { entryId: costId, reason: `Duplicate #${i}`, actorIdentityId: world.admin.id, now: NOW })
      )
    );
    expect(outcomes.filter((o) => o.status === 'fulfilled')).toHaveLength(1);
    for (const o of outcomes.filter((o) => o.status === 'rejected') as PromiseRejectedResult[]) {
      expect(o.reason).toBeInstanceOf(LedgerCorrectionError);
      expect(o.reason.code).toBe('already_reversed');
    }
    expect(await db.ledgerEntry.count({ where: { reversesEntryId: costId } })).toBe(1);
    expect(await db.auditLog.count({ where: { action: 'ledger_entry_reversed' } })).toBe(1);
  });

  it('refuses a second reversal later, too', async () => {
    await reverseManualCost(db, { entryId: costId, reason: 'First', actorIdentityId: world.admin.id, now: NOW });
    await expect(
      reverseManualCost(db, { entryId: costId, reason: 'Second', actorIdentityId: world.admin.id, now: NOW })
    ).rejects.toMatchObject({ code: 'already_reversed' });
  });

  it('refuses to reverse a reversal, a revenue row, a payout, or an unknown id', async () => {
    const { reversal } = await reverseManualCost(db, { entryId: costId, reason: 'Oops', actorIdentityId: world.admin.id, now: NOW });
    const revenue = await db.ledgerEntry.create({
      data: { entryType: 'rental_revenue', amountThb: 90_000, unitId: world.unit.id, occurredOn: new Date('2026-10-01'), description: 'stay' },
    });
    for (const id of [reversal.id, revenue.id]) {
      await expect(
        reverseManualCost(db, { entryId: id, reason: 'Should not work', actorIdentityId: world.admin.id, now: NOW })
      ).rejects.toMatchObject({ code: 'not_reversible' });
    }
    await expect(
      reverseManualCost(db, { entryId: 'nope', reason: 'Should not work', actorIdentityId: world.admin.id, now: NOW })
    ).rejects.toMatchObject({ code: 'not_found' });
    expect(await db.ledgerEntry.count({ where: { reversesEntryId: { not: null } } })).toBe(1);
  });

  it('requires a real reason', async () => {
    for (const reason of ['', '  ', 'no']) {
      await expect(
        reverseManualCost(db, { entryId: costId, reason, actorIdentityId: world.admin.id, now: NOW })
      ).rejects.toMatchObject({ code: 'invalid_reason' });
    }
  });

  it('dates the correction today when the original’s statement was already issued, so the issued statement is not rewritten', async () => {
    const engagement = await db.unitEngagement.create({
      data: { unitId: world.unit.id, ownerIdentityId: world.owner.id, engagementType: 'direct_managed', status: 'active', noiCapAnnualThb: 1 },
    });
    await db.ownerStatement.create({
      data: {
        unitId: world.unit.id, ownerIdentityId: world.owner.id, engagementId: engagement.id,
        periodStart: new Date('2026-10-01'), periodEnd: new Date('2026-10-31'),
        grossRevenueTh: 0, totalCostsTh: 0, noiTh: 0, ownerShareTh: 0, estateShareTh: 0, status: 'published',
      },
    });
    const { reversal, dating } = await reverseManualCost(db, {
      entryId: costId, reason: 'Found after issue', actorIdentityId: world.admin.id, now: new Date('2026-11-03T05:00:00Z'),
    });
    expect(dating).toBe('current_period');
    expect(reversal.occurredOn.toISOString()).toBe('2026-11-03T00:00:00.000Z');
  });
});

describe('the receipt table is closed to the Data API', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it.each(['anon', 'authenticated'])('denies %s any access (RLS on, grants revoked)', async (role) => {
    const asRole = (sql: string) =>
      db.$transaction([db.$executeRawUnsafe(`SET LOCAL ROLE ${role}`), db.$queryRawUnsafe(sql)]);
    await expect(asRole('SELECT * FROM expense_receipt')).rejects.toThrow(/permission denied/i);
    await expect(asRole('SELECT ciphertext FROM expense_receipt')).rejects.toThrow(/permission denied/i);
    await expect(
      db.$transaction([
        db.$executeRawUnsafe(`SET LOCAL ROLE ${role}`),
        db.$executeRawUnsafe(`INSERT INTO expense_receipt (id) VALUES ('x')`),
      ])
    ).rejects.toThrow(/permission denied/i);
  });

  it('has row-level security enabled', async () => {
    const [row] = await db.$queryRaw<Array<{ relrowsecurity: boolean }>>`
      SELECT relrowsecurity FROM pg_class WHERE relname = 'expense_receipt'
    `;
    expect(row.relrowsecurity).toBe(true);
  });
});
