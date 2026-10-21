import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';

const source = 'postgresql://test:test@localhost:5432/myuno_recovery_test';
const target = 'postgresql://test:test@localhost:5432/myuno_recovery_restored_test';
assert.equal(process.env.MYUNO_RECOVERY_REHEARSAL, 'isolated');
assert.equal(process.env.DATABASE_URL, source);
assert.equal(process.env.DATABASE_URL_TEST, source);
for (const key of ['RESEND_API_KEY', 'BLOB_READ_WRITE_TOKEN', 'OMISE_SECRET_KEY', 'VERCEL_TOKEN']) {
  assert.ok(!process.env[key], `${key} must be absent`);
}
function docker(args: string[]) {
  const result = spawnSync('docker', ['--host=unix:///var/run/docker.sock', 'exec',
    'myuno-release-postgres', ...args], { encoding: 'utf8' });
  assert.equal(result.status, 0, 'Disposable PostgreSQL operation failed');
}

async function main() {
  const { PrismaClient } = await import('@prisma/client');
  const { db, createIdentity, createProject, createUnit, createBooking } = await import('../src/test/util');
  const { seedConfig } = await import('../src/modules/config/seed');
  const { processOpnEvent } = await import('../src/modules/finance/provider-webhook.service');
  const { refund } = await import('../src/modules/finance/finance.service');
  let restored: InstanceType<typeof PrismaClient> | undefined;
  const fetchBefore = globalThis.fetch;
  const begin = Date.now();
  const quote = (name: string) => '"' + name.replaceAll('"', '""') + '"';
  async function manifest(client: InstanceType<typeof PrismaClient>) {
    const tables = await client.$queryRaw<Array<{ name: string }>>`SELECT tablename AS name FROM pg_tables WHERE schemaname='public' ORDER BY tablename`;
    const result = [];
    for (const { name } of tables) {
      const rows = await client.$queryRawUnsafe<Array<{ rows: string; digest: string }>>(
        `SELECT count(*)::text AS rows, md5(coalesce(string_agg(md5(row_to_json(t)::text), '' ORDER BY md5(row_to_json(t)::text)), '')) AS digest FROM public.${quote(name)} t`);
      result.push({ name, ...rows[0] });
    }
    return result;
  }
  try {
    assert.equal((await db.$queryRaw<Array<{ name: string }>>`SELECT current_database() AS name`)[0].name, 'myuno_recovery_test');
    assert.equal(await db.identity.count(), 0, 'Rehearsal requires a freshly migrated disposable DB');
    await seedConfig(db);
    const guest = await createIdentity();
    const project = await createProject();
    const unit = await createUnit(project.id);
    const booking = await createBooking({ unitId: unit.id, projectId: project.id,
      guestIdentityId: guest.id, status: 'pending_payment', totalThb: 400000,
      startDate: new Date('2027-07-10'), endDate: new Date('2027-07-12') });
    const payment = await db.payment.create({ data: { purpose: 'stay', bookingId: booking.id,
      payerIdentityId: guest.id, method: 'card_provider', provider: 'opn',
      providerSessionId: 'chrg_recovery_synthetic', amountThb: 400000, status: 'pending' } });
    process.env.PAYMENT_PROVIDER = 'opn';
    process.env.OMISE_SECRET_KEY = 'skey_test_recovery_synthetic_only';
    // Transport-only stub. The real payment, refund, booking and ledger writers run.
    globalThis.fetch = async (input, options) => {
      const url = String(input);
      assert.ok(url.startsWith('https://api.omise.co/charges/chrg_recovery_synthetic'), 'Unexpected outbound request');
      if (options?.method === 'POST' && url.endsWith('/refunds')) {
        return Response.json({ id: 'rfnd_recovery_synthetic', object: 'refund', amount: 100000, voided: false });
      }
      return Response.json({ id: 'chrg_recovery_synthetic', object: 'charge', amount: 400000,
        currency: 'thb', status: 'successful', paid: true, authorized: true });
    };
    const charge = { id: 'evnt_recovery_charge', object: 'event' as const,
      key: 'charge.complete', data: { id: 'chrg_recovery_synthetic', paid: true } };
    assert.equal((await processOpnEvent(db, charge)).action, 'payment_confirmed');
    const pendingRefund = await refund(db, payment.id, 100000, 'cancellation', guest.id);
    assert.equal(pendingRefund.status, 'processing');
    const expected = await manifest(db);
    const beforeLedger = await db.ledgerEntry.count({ where: { bookingId: booking.id } });
    await db.$disconnect();
    docker(['pg_dump', '-U', 'test', '-d', 'myuno_recovery_test', '--no-owner', '--no-privileges',
      '-Fc', '-f', '/tmp/myuno-recovery-synthetic.pgc']);
    docker(['createdb', '-U', 'test', 'myuno_recovery_restored_test']);
    docker(['pg_restore', '-U', 'test', '-d', 'myuno_recovery_restored_test', '--no-owner',
      '--no-privileges', '--exit-on-error', '/tmp/myuno-recovery-synthetic.pgc']);
    restored = new PrismaClient({ datasources: { db: { url: target } } });
    const actual = await manifest(restored);
    assert.deepEqual(actual, expected, 'Restored table/row/digest parity');
    const restoredAt = Date.now();
    // Provider completed the refund during the outage. Reconcile the external
    // fact against restored records, then replay both events to prove no duplicates.
    assert.equal((await processOpnEvent(restored, charge)).action, 'already_confirmed');
    const refunded = { id: 'evnt_recovery_refund', object: 'event' as const,
      key: 'refund.update', data: { id: 'rfnd_recovery_synthetic', voided: false } };
    assert.equal((await processOpnEvent(restored, refunded)).action, 'refund_succeeded');
    assert.equal((await processOpnEvent(restored, refunded)).action, 'refund_acknowledged');
    assert.equal((await processOpnEvent(restored, charge)).action, 'already_confirmed');
    assert.equal(await restored.ledgerEntry.count({ where: { bookingId: booking.id } }), beforeLedger + 1);
    assert.equal(await restored.ledgerEntry.count({ where: { refundId: pendingRefund.id, entryType: 'refund_out' } }), 1);
    assert.equal(await restored.payment.count({ where: { providerSessionId: 'chrg_recovery_synthetic' } }), 1);
    assert.equal((await restored.refund.findUniqueOrThrow({ where: { id: pendingRefund.id } })).status, 'succeeded');
    await mkdir('recovery-results', { recursive: true });
    await writeFile('recovery-results/result.json', JSON.stringify({
      sourceSha: process.env.RECOVERY_HEAD_SHA ?? null, synthetic: true,
      tablesCompared: actual.length, tableRowDigestParity: true,
      restoreElapsedMs: restoredAt - begin, totalElapsedMs: Date.now() - begin,
      confirmedPaymentReplay: 'no duplicate', outageRefundReconciliation: 'succeeded once',
      transport: 'mock Opn only', result: 'passed',
      scope: 'Disposable application DB. Excludes real gateway, Blob files, deployed app/config and measured production RTO/RPO.',
    }, null, 2));
    console.log(`Recovery passed: ${actual.length} tables match; provider charge/refund replay has no duplicate ledger effect.`);
  } finally {
    globalThis.fetch = fetchBefore;
    delete process.env.OMISE_SECRET_KEY;
    delete process.env.PAYMENT_PROVIDER;
    await restored?.$disconnect();
    await db.$disconnect();
  }
}
main().catch(() => { console.error('Isolated recovery rehearsal failed; inspect synthetic setup and assertions.'); process.exitCode = 1; });
