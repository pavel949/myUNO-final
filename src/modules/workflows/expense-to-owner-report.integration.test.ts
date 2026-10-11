/* eslint-disable no-restricted-imports */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { randomUUID } from 'node:crypto';
import {
  createBooking,
  createIdentity,
  createProject,
  createRoleAssignment,
  createUnit,
  db,
  resetDb,
  setGlobalConfig,
} from '@/test/util';

const mockGetCurrentUser = vi.fn();
vi.mock('@/app/actions/getCurrentUser', () => ({
  getCurrentUser: () => mockGetCurrentUser(),
}));
vi.mock('@/lib/prisma', async () => {
  const util = await import('@/test/util');
  return { prisma: util.db };
});

import { POST as recordCostRoute } from '@/app/api/ledger/record-cost/route';
import { POST as uploadReceiptRoute } from '@/app/api/ledger/receipts/route';
import { GET as downloadReceiptRoute } from '@/app/api/ledger/receipts/[receiptId]/route';
import { POST as reverseRoute } from '@/app/api/admin/ledger/[entryId]/reverse/route';
import { POST as generateRoute } from '@/app/api/admin/statements/generate/route';
import { GET as lineItemsRoute } from '@/app/api/admin/statements/[statementId]/line-items/route';
import { PUT as adminSignOffRoute } from '@/app/api/admin/statements/[statementId]/sign-off/route';
import { PUT as ownerSignOffRoute } from '@/app/api/owner/statements/[statementId]/sign-off/route';
import { GET as ownerStatementsRoute } from '@/app/api/owner/statements/route';
import { setUnitOwner } from '@/modules/projects/ownership.service';

/**
 * expense → private receipt → owner report → approval, driven through the real
 * route handlers against PostgreSQL. Only the session is stubbed.
 */

const PNG = (seed: number) =>
  Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64, seed)]);

type Identity = Awaited<ReturnType<typeof createIdentity>>;

function as(identity: Identity | null) {
  mockGetCurrentUser.mockResolvedValue(
    identity
      ? {
          identityId: identity.id,
          email: identity.email,
          firstName: identity.firstName,
          lastName: identity.lastName,
          isAdmin: identity.isAdmin,
          roles: [],
        }
      : null
  );
}

const json = (url: string, method: string, body?: unknown, headers: Record<string, string> = {}) =>
  new NextRequest(`http://localhost${url}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });

interface World {
  project: Awaited<ReturnType<typeof createProject>>;
  admin: Identity;
  staff: Identity;
  colleague: Identity;
  ownerA: Identity;
  ownerB: Identity;
  unitA: { id: string };
  unitB: { id: string };
  engagementA: { id: string };
}

let w: World;

async function engage(unitId: string, ownerId: string) {
  return db.unitEngagement.create({
    data: { unitId, ownerIdentityId: ownerId, engagementType: 'direct_managed', status: 'active', noiCapAnnualThb: 50_000_000 },
  });
}

async function buildWorld(): Promise<World> {
  await setGlobalConfig('finance.statement.service_fee_pct', 10);
  const project = await createProject({ status: 'live' });
  const [admin, staff, colleague, ownerA, ownerB] = await Promise.all([
    createIdentity({ isAdmin: true }),
    createIdentity(),
    createIdentity(),
    createIdentity(),
    createIdentity(),
  ]);
  await createRoleAssignment({ identityId: staff.id, role: 'staff_ops', scopeType: 'project', projectId: project.id });
  await createRoleAssignment({ identityId: colleague.id, role: 'staff_ops', scopeType: 'project', projectId: project.id });
  const unitA = await createUnit({ projectId: project.id, ownerIdentityId: ownerA.id, name: 'Villa A' });
  const unitB = await createUnit({ projectId: project.id, ownerIdentityId: ownerB.id, name: 'Villa B' });
  const engagementA = await engage(unitA.id, ownerA.id);
  await engage(unitB.id, ownerB.id);
  await createBooking({
    unitId: unitA.id, projectId: project.id, guestIdentityId: ownerB.id,
    startDate: new Date('2026-07-05'), endDate: new Date('2026-07-10'), totalThb: 900_000,
  });
  return { project, admin, staff, colleague, ownerA, ownerB, unitA, unitB, engagementA };
}

// ----- API helpers ----------------------------------------------------------

async function recordCost(
  actor: Identity,
  patch: Record<string, unknown> = {},
  key: string = randomUUID(),
  unitId: string = w.unitA.id
) {
  as(actor);
  const res = await recordCostRoute(
    json('/api/ledger/record-cost', 'POST', {
      unitId, entryType: 'cleaning_cost', amountThb: 250_000, occurredOn: '2026-07-20',
      description: 'Deep clean after checkout', ...patch,
    }, { 'Idempotency-Key': key })
  );
  return { res, body: await res.json(), key };
}

async function upload(
  actor: Identity | null,
  entryId: string,
  file: { bytes: Buffer; type: string; name?: string } = { bytes: PNG(1), type: 'image/png' },
  key: string = randomUUID()
) {
  as(actor);
  const form = new FormData();
  form.append('ledgerEntryId', entryId);
  form.append('file', new File([new Uint8Array(file.bytes)], file.name ?? 'r.png', { type: file.type }));
  const res = await uploadReceiptRoute(
    new NextRequest('http://localhost/api/ledger/receipts', {
      method: 'POST', body: form, headers: key ? { 'Idempotency-Key': key } : {},
    })
  );
  return { res, body: await res.json(), key };
}

async function download(actor: Identity | null, receiptId: string) {
  as(actor);
  return downloadReceiptRoute(json(`/api/ledger/receipts/${receiptId}`, 'GET'), { params: { receiptId } });
}

async function generate(extra: Record<string, unknown> = {}, unitId = w.unitA.id, range: [string, string] = ['2026-07-01', '2026-07-31']) {
  as(w.admin);
  const res = await generateRoute(json('/api/admin/statements/generate', 'POST', { unitId, periodStart: range[0], periodEnd: range[1], ...extra }));
  return { res, body: await res.json() };
}

async function signOperator(statementId: string) {
  as(w.admin);
  const res = await adminSignOffRoute(json(`/x`, 'PUT', { actor: 'operator' }), { params: { statementId } });
  return { res, body: await res.json() };
}

async function signOwner(owner: Identity, statementId: string) {
  as(owner);
  const res = await ownerSignOffRoute(json(`/x`, 'PUT'), { params: { statementId } });
  return { res, body: await res.json() };
}

async function lines(statementId: string) {
  return db.statementLineItem.findMany({ where: { statementId }, orderBy: { createdAt: 'asc' } });
}

const expenseLines = async (statementId: string) =>
  (await lines(statementId)).filter((l) => l.category === 'operating_expense');

beforeEach(async () => {
  await resetDb();
  mockGetCurrentUser.mockReset();
  w = await buildWorld();
});

// ---------------------------------------------------------------------------

describe('expense → private receipt → owner report → approval', () => {
  it('carries one cost from the staff form to the owner’s signed report, with its receipt, exactly once', async () => {
    // 1. Staff records the cost.
    const cost = await recordCost(w.staff);
    expect(cost.res.status).toBe(201);
    expect(cost.body).toMatchObject({ amountThb: 250_000, occurredOn: '2026-07-20', replayed: false });
    expect(cost.body.reportImpact.state).toBe('no_statement_yet');

    // 2. …attaches the private receipt.
    const receipt = await upload(w.staff, cost.body.id);
    expect(receipt.res.status).toBe(201);
    const receiptId = receipt.body.receipt.id as string;
    // No public URL exists anywhere in the response.
    expect(JSON.stringify(receipt.body)).not.toMatch(/https?:|blob|storageKey|ciphertext/i);

    // 3. A lost response and a double click change nothing.
    expect((await recordCost(w.staff, {}, cost.key)).body.id).toBe(cost.body.id);
    expect((await upload(w.staff, cost.body.id, undefined, receipt.key)).body.receipt.id).toBe(receiptId);

    // 4. Admin prepares the July report: the cost is on it once, traced to its row and its receipt.
    const gen = await generate();
    expect(gen.res.status).toBe(200);
    const statementId = gen.body.statement.id as string;
    expect(gen.body.statement.operatingExpensesAmountThb).toBe(250_000);
    const expenses = await expenseLines(statementId);
    expect(expenses).toHaveLength(1);
    expect(expenses[0]).toMatchObject({ ledgerEntryId: cost.body.id, expenseReceiptId: receiptId, amountTh: 250_000 });
    expect((await db.ledgerEntry.findUniqueOrThrow({ where: { id: cost.body.id } })).statementId).toBe(statementId);

    // The admin line-items view exposes the same trace.
    as(w.admin);
    const view = await (await lineItemsRoute(json('/x', 'GET'), { params: { statementId } })).json();
    expect(view.lineItems.find((l: { ledgerEntryId: string }) => l.ledgerEntryId === cost.body.id).expenseReceiptId).toBe(receiptId);

    // 5. A draft is not the owner's yet — neither the report nor the receipt.
    as(w.ownerA);
    expect((await (await ownerStatementsRoute(json('/x', 'GET'))).json()).statements).toHaveLength(0);
    expect((await download(w.ownerA, receiptId)).status).toBe(404);

    // 6. Operator signs → the report is released to the owner; now they can read the receipt.
    const operator = await signOperator(statementId);
    expect(operator.body.statement.status).toBe('pending_owner_review');
    as(w.ownerA);
    expect((await (await ownerStatementsRoute(json('/x', 'GET'))).json()).statements).toHaveLength(1);
    const file = await download(w.ownerA, receiptId);
    expect(file.status).toBe(200);
    expect(Buffer.from(await file.arrayBuffer()).equals(PNG(1))).toBe(true);
    expect(file.headers.get('content-type')).toBe('image/png');
    expect(file.headers.get('content-disposition')).toMatch(/^attachment;/);
    expect(file.headers.get('cache-control')).toMatch(/no-store/);
    expect(file.headers.get('x-content-type-options')).toBe('nosniff');

    // 7. Owner approves; the verified snapshot is what was signed.
    const owner = await signOwner(w.ownerA, statementId);
    expect(owner.body.statement).toMatchObject({ status: 'signed_off' });
    expect(owner.body.statement.approvedAt).toBeTruthy();
    const stored = await db.ownerStatement.findUniqueOrThrow({ where: { id: statementId } });
    expect(stored.snapshotHash).toMatch(/^[0-9a-f]{64}$/);
    const signatures = await db.auditLog.findMany({ where: { action: 'statement_signed', entityId: statementId } });
    expect(signatures).toHaveLength(2);
    expect(signatures.every((s) => (s.data as { snapshotHash: string }).snapshotHash === stored.snapshotHash)).toBe(true);
  });

  it('puts a cost in the period of its business date, to the day', async () => {
    await recordCost(w.staff, { occurredOn: '2026-06-30', description: 'June cost' });
    const july31 = await recordCost(w.staff, { occurredOn: '2026-07-31', description: 'Last day of July' });
    const aug1 = await recordCost(w.staff, { occurredOn: '2026-08-01', description: 'First day of August' });

    const july = await generate();
    expect((await expenseLines(july.body.statement.id)).map((l) => l.ledgerEntryId)).toEqual([july31.body.id]);

    const august = await generate({}, w.unitA.id, ['2026-08-01', '2026-08-31']);
    expect((await expenseLines(august.body.statement.id)).map((l) => l.ledgerEntryId)).toEqual([aug1.body.id]);
  });

  it('keeps the money buckets apart and the totals reconciled', async () => {
    await recordCost(w.staff, { amountThb: 100_000 });
    await recordCost(w.staff, { entryType: 'utilities_cost', amountThb: 50_000, description: 'Electricity' });
    const { body } = await generate();
    const s = body.statement;
    expect(s.grossBookingsAmountThb).toBe(900_000); // booked revenue
    expect(s.guestPaymentsReceivedThb).toBe(0); // cash actually received is a separate figure
    expect(s.operatingExpensesAmountThb).toBe(150_000);
    expect(s.serviceFeesAmountThb).toBe(90_000); // configured rate, not a literal
    expect(s.adjustedNoiThb).toBe(900_000 - 90_000 - 150_000);
  });

  it('refuses a malformed or instant-shaped period instead of silently shifting it', async () => {
    for (const periodStart of ['2026-07-01T23:00:00+07:00', '2026-7-1', '2026-02-30', 'July']) {
      const { res } = await generate({ periodStart });
      expect(res.status).toBe(400);
    }
    expect(await db.ownerStatement.count()).toBe(0);
  });

  describe('a mistake is corrected by a visible reversal, never an edit', () => {
    it('nets the reversed cost to zero on the next report and shows both lines', async () => {
      const cost = await recordCost(w.staff);
      as(w.admin);
      const reversed = await reverseRoute(json('/x', 'POST', { reason: 'Recorded twice' }), { params: Promise.resolve({ entryId: cost.body.id }) });
      expect(reversed.status).toBe(201);

      const { body } = await generate();
      expect(body.statement.operatingExpensesAmountThb).toBe(0);
      const expenses = await expenseLines(body.statement.id);
      expect(expenses.map((l) => l.amountTh).sort((a, b) => a - b)).toEqual([-250_000, 250_000]);
    });

    it('answers a second reversal with 409, and only an admin may reverse', async () => {
      const cost = await recordCost(w.staff);
      const params = { params: Promise.resolve({ entryId: cost.body.id }) };
      as(w.staff);
      expect((await reverseRoute(json('/x', 'POST', { reason: 'nope' }), params)).status).toBe(403);
      as(w.admin);
      expect((await reverseRoute(json('/x', 'POST', { reason: 'Recorded twice' }), params)).status).toBe(201);
      const again = await reverseRoute(json('/x', 'POST', { reason: 'Recorded twice' }), params);
      expect(again.status).toBe(409);
      expect((await again.json()).code).toBe('already_reversed');
      expect(await db.ledgerEntry.count({ where: { reversesEntryId: cost.body.id } })).toBe(1);
    });
  });

  describe('a prepared snapshot cannot be signed once its facts moved', () => {
    async function prepared() {
      const cost = await recordCost(w.staff);
      const receipt = await upload(w.staff, cost.body.id);
      const gen = await generate();
      return { cost, receipt, statementId: gen.body.statement.id as string };
    }

    async function expectStaleThenRegenerated(statementId: string) {
      const refused = await signOperator(statementId);
      expect(refused.res.status).toBe(409);
      expect(refused.body.code).toBe('statement_stale');
      expect((await db.ownerStatement.findUniqueOrThrow({ where: { id: statementId } })).signedOffByOperatorAt).toBeNull();

      const rebuilt = await generate({ regenerate: true });
      expect(rebuilt.res.status).toBe(200);
      expect(rebuilt.body.regenerated).toBe(true);
      expect(rebuilt.body.statement.id).toBe(statementId); // same statement, rebuilt in place
      expect((await signOperator(statementId)).res.status).toBe(200);
    }

    it('after a new cost', async () => {
      const { statementId } = await prepared();
      await recordCost(w.staff, { description: 'Arrived late', occurredOn: '2026-07-25' });
      await expectStaleThenRegenerated(statementId);
      expect(await expenseLines(statementId)).toHaveLength(2);
    });

    it('after a reversal', async () => {
      const { cost, statementId } = await prepared();
      as(w.admin);
      await reverseRoute(json('/x', 'POST', { reason: 'Recorded twice' }), { params: Promise.resolve({ entryId: cost.body.id }) });
      await expectStaleThenRegenerated(statementId);
      expect((await db.ownerStatement.findUniqueOrThrow({ where: { id: statementId } })).operatingExpensesAmountTh).toBe(0);
    });

    it('after the receipt is replaced', async () => {
      const { cost, statementId } = await prepared();
      expect((await upload(w.staff, cost.body.id, { bytes: PNG(9), type: 'image/png' })).res.status).toBe(201);
      await expectStaleThenRegenerated(statementId);
    });

    it('after the ownership chain changes', async () => {
      const { statementId } = await prepared();
      await setUnitOwner(db, { unitId: w.unitA.id, ownerIdentityId: w.ownerB.id, effectiveFrom: new Date('2026-07-15') });
      await expectStaleThenRegenerated(statementId);
    });

    it('but not after something that is not an input (a transfer after the period, a config edit)', async () => {
      const { statementId } = await prepared();
      await setGlobalConfig('finance.statement.service_fee_pct', 25); // accepted snapshots do not move
      await setUnitOwner(db, { unitId: w.unitA.id, ownerIdentityId: w.ownerB.id, effectiveFrom: new Date('2026-09-01') });
      const signed = await signOperator(statementId);
      expect(signed.res.status).toBe(200);
      expect((await db.ownerStatement.findUniqueOrThrow({ where: { id: statementId } })).serviceFeesAmountTh).toBe(90_000);
    });

    it('and refuses a statement whose issued lines were altered after generation', async () => {
      const { statementId } = await prepared();
      const [line] = await expenseLines(statementId);
      await db.statementLineItem.update({ where: { id: line.id }, data: { amountTh: 1 } });
      const refused = await signOperator(statementId);
      expect(refused.res.status).toBe(409);
      expect(refused.body.code).toBe('statement_snapshot_mismatch');
    });
  });

  describe('after the operator has signed, the owner approves exactly what was issued', () => {
    it('is not pulled from under the owner by a cost that arrives later — and the screen is told the truth', async () => {
      await recordCost(w.staff);
      const { body: gen } = await generate();
      const statementId = gen.statement.id as string;
      await signOperator(statementId);

      const late = await recordCost(w.staff, { description: 'Invoice arrived after issue', occurredOn: '2026-07-28' });
      expect(late.res.status).toBe(201);
      expect(late.body.reportImpact).toMatchObject({ state: 'period_already_issued', statementId });

      expect((await signOwner(w.ownerA, statementId)).res.status).toBe(200);
      expect(await expenseLines(statementId)).toHaveLength(1); // the issued report is unchanged
      expect((await db.ledgerEntry.findUniqueOrThrow({ where: { id: late.body.id } })).statementId).toBeNull();
    });

    it('does not let a late receipt change evidence the issued report already cites', async () => {
      const cost = await recordCost(w.staff);
      await upload(w.staff, cost.body.id);
      const { body: gen } = await generate();
      await signOperator(gen.statement.id);
      const replaced = await upload(w.staff, cost.body.id, { bytes: PNG(7), type: 'image/png' });
      expect(replaced.res.status).toBe(409);
      expect(replaced.body.code).toBe('statement_locked');
    });

    it('dates a reversal of an issued cost into the current period', async () => {
      const cost = await recordCost(w.staff);
      const { body: gen } = await generate();
      await signOperator(gen.statement.id);
      as(w.admin);
      const res = await reverseRoute(json('/x', 'POST', { reason: 'Disputed after issue' }), { params: Promise.resolve({ entryId: cost.body.id }) });
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.dating).toBe('current_period');
      expect(String(body.occurredOn)).not.toContain('2026-07');
      expect(await expenseLines(gen.statement.id)).toHaveLength(1); // untouched
    });
  });

  describe('a late cost is carried into the next report, once', () => {
    async function issuedJuly() {
      await recordCost(w.staff);
      const { body: gen } = await generate();
      await signOperator(gen.statement.id);
      return gen.statement.id as string;
    }
    const august = (extra: Record<string, unknown> = {}) => generate(extra, w.unitA.id, ['2026-08-01', '2026-08-31']);

    it('keeps its true date, stays out of the issued report, and lands in the next one with its date shown', async () => {
      const july = await issuedJuly();
      const late = await recordCost(w.staff, { description: 'Invoice arrived after issue', occurredOn: '2026-07-28', amountThb: 70_000 });
      expect(late.body.reportImpact.state).toBe('period_already_issued');
      expect(late.body.occurredOn).toBe('2026-07-28');

      const aug = await august();
      expect(aug.res.status).toBe(200);
      expect(aug.body.statement.operatingExpensesAmountThb).toBe(70_000);
      const [line] = await expenseLines(aug.body.statement.id);
      expect(line).toMatchObject({ ledgerEntryId: late.body.id, amountTh: 70_000 });
      expect(line.description).toContain('(dated 2026-07-28)');
      expect(await expenseLines(july)).toHaveLength(1); // the issued report is untouched
      expect((await db.ledgerEntry.findUniqueOrThrow({ where: { id: late.body.id } })).statementId).toBe(aug.body.statement.id);
    });

    it('is counted exactly once: a rebuilt draft keeps it, and a later report does not repeat it', async () => {
      await issuedJuly();
      const late = await recordCost(w.staff, { description: 'Late one', occurredOn: '2026-07-29' });
      const aug = await august();
      const rebuilt = await august({ regenerate: true });
      expect(rebuilt.body.statement.operatingExpensesAmountThb).toBe(aug.body.statement.operatingExpensesAmountThb);
      expect((await expenseLines(aug.body.statement.id)).filter((l) => l.ledgerEntryId === late.body.id)).toHaveLength(1);

      await signOperator(aug.body.statement.id);
      const sept = await generate({}, w.unitA.id, ['2026-09-01', '2026-09-30']);
      expect(await expenseLines(sept.body.statement.id)).toHaveLength(0);
    });

    it('makes the next report stale — not silently different — when another late cost arrives before it is signed', async () => {
      await issuedJuly();
      await recordCost(w.staff, { description: 'Late one', occurredOn: '2026-07-29' });
      const aug = await august();
      await recordCost(w.staff, { description: 'Later still', occurredOn: '2026-07-30' });
      const refused = await signOperator(aug.body.statement.id);
      expect([refused.res.status, refused.body.code]).toEqual([409, 'statement_stale']);
      const rebuilt = await august({ regenerate: true });
      expect(await expenseLines(rebuilt.body.statement.id)).toHaveLength(2);
      expect((await signOperator(aug.body.statement.id)).res.status).toBe(200);
    });

    it('does not carry a cost from a period that never had an issued report', async () => {
      await recordCost(w.staff, { occurredOn: '2026-06-15', description: 'June, never reported' });
      const jul = await generate();
      expect(await expenseLines(jul.body.statement.id)).toHaveLength(0);
    });
  });

  describe('an issued report is replaced, not edited', () => {
    async function issued() {
      const cost = await recordCost(w.staff);
      const { body: gen } = await generate();
      await signOperator(gen.statement.id);
      return { cost, oldId: gen.statement.id as string };
    }

    it('supersedes the issued report, keeps it as issued, and prepares a new draft that includes what was missing', async () => {
      const { oldId } = await issued();
      const late = await recordCost(w.staff, { description: 'Found after issue', occurredOn: '2026-07-28', amountThb: 70_000 });
      const before = await lines(oldId);

      const replaced = await generate({ regenerate: true });
      expect(replaced.res.status).toBe(200);
      expect(replaced.body.supersededStatementId).toBe(oldId);
      const newId = replaced.body.statement.id as string;
      expect(newId).not.toBe(oldId);
      expect(replaced.body.statement.status).toBe('draft');
      expect(replaced.body.statement.operatingExpensesAmountThb).toBe(250_000 + 70_000);

      // The old report is exactly as it was issued — only its status moved.
      const old = await db.ownerStatement.findUniqueOrThrow({ where: { id: oldId } });
      expect(old.status).toBe('superseded');
      expect(await lines(oldId)).toEqual(before);
      expect(old.operatingExpensesAmountTh).toBe(250_000);
      // Ledger rows now belong to the new report, once.
      expect((await db.ledgerEntry.findUniqueOrThrow({ where: { id: late.body.id } })).statementId).toBe(newId);
      expect(await db.ownerStatement.count({ where: { unitId: w.unitA.id, status: { not: 'superseded' } } })).toBe(1);
      expect((await db.auditLog.findFirstOrThrow({ where: { action: 'statement_regenerated', entityId: newId } })).data).toMatchObject({ supersededStatementId: oldId });
    });

    it('shows the owner the replaced report as replaced, hides the new draft, and needs the operator to sign it again', async () => {
      const { oldId } = await issued();
      await recordCost(w.staff, { description: 'Found after issue', occurredOn: '2026-07-28' });
      const { body } = await generate({ regenerate: true });
      const newId = body.statement.id as string;

      as(w.ownerA);
      const listed = (await (await ownerStatementsRoute(json('/x', 'GET'))).json()).statements as Array<{ id: string; status: string }>;
      expect(listed.map((s) => [s.id, s.status])).toEqual([[oldId, 'superseded']]);

      expect((await signOwner(w.ownerA, oldId)).res.status).toBe(404); // a replaced report cannot be signed
      expect((await signOperator(oldId)).res.status).toBe(409);
      expect((await signOwner(w.ownerA, newId)).res.status).toBe(404); // draft: not the owner's yet
      expect((await signOperator(newId)).res.status).toBe(200);
      expect((await signOwner(w.ownerA, newId)).res.status).toBe(200);
      expect((await db.ownerStatement.findUniqueOrThrow({ where: { id: newId } })).status).toBe('signed_off');
    });

    it('keeps receipts reachable for the owner through both the replaced and the new report', async () => {
      const cost = await recordCost(w.staff);
      const receiptId = (await upload(w.staff, cost.body.id)).body.receipt.id as string;
      const { body: gen } = await generate();
      await signOperator(gen.statement.id);
      await generate({ regenerate: true });
      expect((await download(w.ownerA, receiptId)).status).toBe(200); // cited by the superseded report, still visible to its recipient
    });

    it('also replaces a report awaiting the operator after the owner viewed it, but never one the owner signed', async () => {
      const { oldId } = await issued();
      await db.ownerStatement.update({ where: { id: oldId }, data: { signedOffByOwnerAt: new Date() } });
      const refused = await generate({ regenerate: true });
      expect([refused.res.status, refused.body.code]).toEqual([409, 'statement_not_regenerable']);
      expect((await db.ownerStatement.findUniqueOrThrow({ where: { id: oldId } })).status).not.toBe('superseded');
    });

    it('never replaces a closed report, and two simultaneous replacements leave one live report', async () => {
      const { oldId } = await issued();
      const [a, b] = await Promise.all([generate({ regenerate: true }), generate({ regenerate: true })]);
      expect([a.res.status, b.res.status]).toEqual([200, 200]);
      expect(await db.ownerStatement.count({ where: { unitId: w.unitA.id, status: { not: 'superseded' } } })).toBe(1);
      expect((await db.ownerStatement.findUniqueOrThrow({ where: { id: oldId } })).status).toBe('superseded');

      await db.ownerStatement.updateMany({ where: { unitId: w.unitA.id, status: { not: 'superseded' } }, data: { status: 'signed_off' } });
      expect((await generate({ regenerate: true })).res.status).toBe(409);
    });
  });

  describe('closed reports stay closed', () => {
    it('refuses to regenerate once the owner has signed, to generate a second report, or to touch a closed one', async () => {
      await recordCost(w.staff);
      const { body: gen } = await generate();
      const id = gen.statement.id as string;

      expect((await generate()).res.status).toBe(409); // one report per unit and period
      await signOperator(id);
      await signOwner(w.ownerA, id);
      const refused = await generate({ regenerate: true });
      expect(refused.res.status).toBe(409);
      expect(refused.body.code).toBe('statement_not_regenerable');
      expect((await signOperator(id)).res.status).toBe(409);
      expect((await signOwner(w.ownerA, id)).res.status).toBe(409);
      expect((await db.ownerStatement.findUniqueOrThrow({ where: { id } })).status).toBe('signed_off');
    });

    it('does not bring a distributed report back when a signature arrives late', async () => {
      const { body: gen } = await generate();
      const id = gen.statement.id as string;
      await db.ownerStatement.update({ where: { id }, data: { status: 'distributed' } });
      expect((await signOperator(id)).res.status).toBe(409);
      expect((await db.ownerStatement.findUniqueOrThrow({ where: { id } })).status).toBe('distributed');
    });

    it('never loses a signature when owner and operator sign at the same instant', async () => {
      for (let round = 0; round < 6; round += 1) {
        await db.ownerStatement.deleteMany();
        const { body: gen } = await generate({}, w.unitA.id, ['2026-07-01', '2026-07-31']);
        const id = gen.statement.id as string;
        await db.ownerStatement.update({ where: { id }, data: { status: 'published' } });

        as(w.admin);
        const operator = adminSignOffRoute(json('/x', 'PUT', { actor: 'operator' }), { params: { statementId: id } });
        as(w.ownerA);
        const owner = ownerSignOffRoute(json('/x', 'PUT'), { params: { statementId: id } });
        const [a, b] = await Promise.all([operator, owner]);
        expect([a.status, b.status]).toEqual([200, 200]);

        const done = await db.ownerStatement.findUniqueOrThrow({ where: { id } });
        expect(done.status).toBe('signed_off');
        expect(done.signedOffByOwnerAt).not.toBeNull();
        expect(done.signedOffByOperatorAt).not.toBeNull();
        expect(done.approvedAt).not.toBeNull();
      }
    });

    it('lets only one of two simultaneous generations for a unit and period through', async () => {
      const [a, b] = await Promise.all([generate(), generate()]);
      expect([a.res.status, b.res.status].sort()).toEqual([200, 409]);
      expect(await db.ownerStatement.count({ where: { unitId: w.unitA.id } })).toBe(1);
    });
  });

  describe('private receipts: who may read, who may write', () => {
    async function costWithReceipt() {
      const cost = await recordCost(w.staff);
      const receipt = await upload(w.staff, cost.body.id);
      return { cost, receiptId: receipt.body.receipt.id as string };
    }

    it('serves the author and colleagues with authority on the unit, and nobody else', async () => {
      const { receiptId } = await costWithReceipt();
      expect((await download(w.staff, receiptId)).status).toBe(200);
      expect((await download(w.colleague, receiptId)).status).toBe(200);
      expect((await download(w.admin, receiptId)).status).toBe(200);

      const stranger = await createIdentity();
      const otherProject = await createProject({ status: 'live' });
      const foreignStaff = await createIdentity();
      await createRoleAssignment({ identityId: foreignStaff.id, role: 'staff_ops', scopeType: 'project', projectId: otherProject.id });
      for (const actor of [stranger, foreignStaff, w.ownerA, w.ownerB]) {
        expect((await download(actor, receiptId)).status).toBe(404);
      }
      expect((await download(null, receiptId)).status).toBe(401);
      expect((await download(w.admin, randomUUID())).status).toBe(404);
    });

    it('stops serving the moment a role is revoked', async () => {
      const { receiptId } = await costWithReceipt();
      expect((await download(w.colleague, receiptId)).status).toBe(200);
      await db.roleAssignment.updateMany({ where: { identityId: w.colleague.id }, data: { status: 'revoked' } });
      expect((await download(w.colleague, receiptId)).status).toBe(404);
      await db.identity.update({ where: { id: w.staff.id }, data: { status: 'blocked' } });
      expect((await download(w.staff, receiptId)).status).toBe(404);
    });

    it('serves an owner only the receipts their own visible report cites', async () => {
      const a = await costWithReceipt();
      const costB = await recordCost(w.staff, {}, randomUUID(), w.unitB.id);
      const receiptB = (await upload(w.staff, costB.body.id, { bytes: PNG(5), type: 'image/png' })).body.receipt.id as string;
      const genA = await generate();
      const genB = await generate({}, w.unitB.id);
      await signOperator(genA.body.statement.id);
      await signOperator(genB.body.statement.id);

      expect((await download(w.ownerA, a.receiptId)).status).toBe(200);
      expect((await download(w.ownerA, receiptB)).status).toBe(404);
      expect((await download(w.ownerB, receiptB)).status).toBe(200);
      expect((await download(w.ownerB, a.receiptId)).status).toBe(404);

      as(w.ownerA);
      const mine = (await (await ownerStatementsRoute(json('/x', 'GET'))).json()).statements;
      expect(mine.map((s: { unitId: string }) => s.unitId)).toEqual([w.unitA.id]);
    });

    it('lets one owner with two units in two portfolios read each unit’s receipt, and no other', async () => {
      const otherProject = await createProject({ status: 'live' });
      const portfolioUnit = await createUnit({ projectId: otherProject.id, ownerIdentityId: w.ownerA.id, name: 'Villa A2' });
      await engage(portfolioUnit.id, w.ownerA.id);
      const staff2 = await createIdentity();
      await createRoleAssignment({ identityId: staff2.id, role: 'staff_ops', scopeType: 'project', projectId: otherProject.id });

      const first = await costWithReceipt();
      const second = await recordCost(staff2, {}, randomUUID(), portfolioUnit.id);
      const secondReceipt = (await upload(staff2, second.body.id, { bytes: PNG(6), type: 'image/png' })).body.receipt.id as string;
      const g1 = await generate();
      const g2 = await generate({}, portfolioUnit.id);
      await signOperator(g1.body.statement.id);
      await signOperator(g2.body.statement.id);

      expect((await download(w.ownerA, first.receiptId)).status).toBe(200);
      expect((await download(w.ownerA, secondReceipt)).status).toBe(200);
      // The staff of one project cannot read the other project's receipt.
      expect((await download(w.staff, secondReceipt)).status).toBe(404);
      expect((await download(staff2, first.receiptId)).status).toBe(404);
    });

    it('keeps the historical recipient entitled after the unit changes hands', async () => {
      const { receiptId } = await costWithReceipt();
      const gen = await generate();
      await signOperator(gen.body.statement.id);

      await setUnitOwner(db, { unitId: w.unitA.id, ownerIdentityId: w.ownerB.id, effectiveFrom: new Date('2026-09-01') });
      expect((await download(w.ownerA, receiptId)).status).toBe(200); // recorded beneficiary of that report
      expect((await download(w.ownerB, receiptId)).status).toBe(404); // today's owner was never its recipient
      as(w.ownerA);
      expect((await (await ownerStatementsRoute(json('/x', 'GET'))).json()).statements).toHaveLength(1);
      as(w.ownerB);
      expect((await (await ownerStatementsRoute(json('/x', 'GET'))).json()).statements).toHaveLength(0);
    });

    describe('attaching', () => {
      it('rejects files that are not what they claim, or are too large, or have no key', async () => {
        const cost = await recordCost(w.staff);
        const html = await upload(w.staff, cost.body.id, { bytes: Buffer.from('<html><script>alert(1)</script></html>'), type: 'image/png' });
        expect([html.res.status, html.body.code]).toEqual([400, 'content_mismatch']);
        const svg = await upload(w.staff, cost.body.id, { bytes: Buffer.from('<svg onload="x()"/>'), type: 'image/svg+xml' });
        expect([svg.res.status, svg.body.code]).toEqual([400, 'unsupported_type']);
        const huge = await upload(w.staff, cost.body.id, { bytes: Buffer.concat([PNG(1), Buffer.alloc(4 * 1024 * 1024)]), type: 'image/png' });
        expect(huge.res.status).toBe(413);
        const noKey = await upload(w.staff, cost.body.id, undefined, '');
        expect([noKey.res.status, noKey.body.code]).toEqual([400, 'invalid_idempotency_key']);
        expect(await db.expenseReceipt.count()).toBe(0);
      });

      it('accepts a PDF and refuses an upload for a cost that is not the caller’s to evidence', async () => {
        const cost = await recordCost(w.staff);
        const pdf = await upload(w.staff, cost.body.id, { bytes: Buffer.from('%PDF-1.4\n%%EOF'), type: 'application/pdf', name: 'r.pdf' });
        expect(pdf.res.status).toBe(201);
        // A colleague holds authority on the unit but did not record this cost.
        expect((await upload(w.colleague, cost.body.id, { bytes: PNG(3), type: 'image/png' })).res.status).toBe(404);
        const stranger = await createIdentity();
        expect((await upload(stranger, cost.body.id)).res.status).toBe(404);
        expect((await upload(w.staff, randomUUID())).res.status).toBe(404);
        // An admin may.
        expect((await upload(w.admin, cost.body.id, { bytes: PNG(3), type: 'image/png' })).res.status).toBe(201);
      });

      it('does not let one file evidence two different costs', async () => {
        const one = await recordCost(w.staff);
        const two = await recordCost(w.staff, { description: 'A second, different cost' });
        expect((await upload(w.staff, one.body.id, { bytes: PNG(4), type: 'image/png' })).res.status).toBe(201);
        const reused = await upload(w.staff, two.body.id, { bytes: PNG(4), type: 'image/png' });
        expect([reused.res.status, reused.body.code]).toEqual([409, 'receipt_reused']);
      });

      it('treats the same key with a different file as a conflict and the same file as a replay', async () => {
        const cost = await recordCost(w.staff);
        const first = await upload(w.staff, cost.body.id, { bytes: PNG(1), type: 'image/png' });
        const replay = await upload(w.staff, cost.body.id, { bytes: PNG(1), type: 'image/png' }, first.key);
        expect([replay.res.status, replay.body.replayed]).toEqual([200, true]);
        const conflict = await upload(w.staff, cost.body.id, { bytes: PNG(2), type: 'image/png' }, first.key);
        expect([conflict.res.status, conflict.body.code]).toEqual([409, 'idempotency_conflict']);
        expect(await db.expenseReceipt.count()).toBe(1);
      });

      it('keeps one current receipt when uploads race, and never two', async () => {
        const cost = await recordCost(w.staff);
        const outcomes = await Promise.all(
          [1, 2, 3, 4, 5].map((n) => upload(w.staff, cost.body.id, { bytes: PNG(10 + n), type: 'image/png' }))
        );
        expect(outcomes.some((o) => o.res.status === 201)).toBe(true);
        expect(await db.expenseReceipt.count({ where: { ledgerEntryId: cost.body.id, supersededAt: null } })).toBe(1);
      });

      it('supersedes rather than overwrites: the replaced file survives for what cited it', async () => {
        const cost = await recordCost(w.staff);
        const first = await upload(w.staff, cost.body.id, { bytes: PNG(1), type: 'image/png' });
        const second = await upload(w.staff, cost.body.id, { bytes: PNG(2), type: 'image/png' });
        expect(second.body.supersededReceiptId).toBe(first.body.receipt.id);
        const rows = await db.expenseReceipt.findMany({ where: { ledgerEntryId: cost.body.id } });
        expect(rows).toHaveLength(2);
        expect(rows.filter((r) => r.supersededAt === null)).toHaveLength(1);
        expect((await download(w.staff, first.body.receipt.id)).status).toBe(200);
        // Evidence bytes can never be edited in place.
        await expect(db.expenseReceipt.update({ where: { id: first.body.receipt.id }, data: { sha256: 'a'.repeat(64) } })).rejects.toThrow(/immutable/i);
        await expect(db.expenseReceipt.delete({ where: { id: first.body.receipt.id } })).rejects.toThrow(/immutable/i);
      });

      it('takes no evidence for a cost that has been reversed', async () => {
        const cost = await recordCost(w.staff);
        as(w.admin);
        await reverseRoute(json('/x', 'POST', { reason: 'Recorded twice' }), { params: Promise.resolve({ entryId: cost.body.id }) });
        const late = await upload(w.staff, cost.body.id);
        expect([late.res.status, late.body.code]).toEqual([409, 'not_attachable']);
      });

      it('stores ciphertext, never the file', async () => {
        const cost = await recordCost(w.staff);
        await upload(w.staff, cost.body.id, { bytes: PNG(1), type: 'image/png' });
        const [row] = await db.expenseReceipt.findMany();
        expect(row.ciphertext).not.toContain(PNG(1).toString('base64'));
        expect(row.ciphertext.split(':')).toHaveLength(3);
      });
    });
  });

  describe('the record-cost endpoint', () => {
    it('refuses a missing key, a receiptMediaId, adjustment, and a non-integer amount — writing nothing', async () => {
      as(w.staff);
      const body = { unitId: w.unitA.id, entryType: 'cleaning_cost', amountThb: 5000, occurredOn: '2026-07-20', description: 'ok cost' };
      const noKey = await recordCostRoute(json('/x', 'POST', body));
      expect([noKey.status, (await noKey.json()).code]).toEqual([400, 'missing_idempotency_key']);
      for (const [patch, code] of [
        [{ receiptMediaId: 'public-marketing-photo' }, 'receipt_media_not_supported'],
        [{ entryType: 'adjustment' }, 'invalid_entry_type'],
        [{ amountThb: 12.5 }, 'invalid_amount'],
        [{ occurredOn: '2999-01-01' }, 'date_in_future'],
      ] as const) {
        const r = await recordCost(w.staff, patch);
        expect([r.res.status, r.body.code]).toEqual([400, code]);
      }
      expect(await db.ledgerEntry.count({ where: { entryType: 'cleaning_cost' } })).toBe(0);
    });

    it('answers 200 for a replay, 409 for a reused key, 403 for the wrong unit, 401 for no session', async () => {
      const first = await recordCost(w.staff);
      expect((await recordCost(w.staff, {}, first.key)).res.status).toBe(200);
      expect((await recordCost(w.staff, { amountThb: 1 }, first.key)).res.status).toBe(409);
      const foreign = await createProject({ status: 'live' });
      const foreignUnit = await createUnit({ projectId: foreign.id, ownerIdentityId: w.ownerA.id });
      expect((await recordCost(w.staff, {}, randomUUID(), foreignUnit.id)).res.status).toBe(403);
      as(null);
      const anon = await recordCostRoute(json('/x', 'POST', {}, { 'Idempotency-Key': randomUUID() }));
      expect(anon.status).toBe(401);
    });
  });
});
