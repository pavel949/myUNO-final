import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
createRequire(resolve('scripts/e2e/expire-synthetic-request.ts'))('./isolation.cjs').assertIsolation();
async function main() {
  const { PrismaClient } = await import('@prisma/client');
  const { expireHolds, autoDeclineRequests } = await import('@/modules/booking');
  const db = new PrismaClient();
  try {
    const fixture = JSON.parse(await readFile('browser-results/fixture.json', 'utf8'));
    const [bookingId, kind] = process.argv.slice(2);
    assert.match(bookingId ?? '', /^[0-9a-f-]{36}$/); assert.ok(kind === 'hold' || kind === 'request');
    const name = await db.$queryRaw<Array<{ name: string }>>`SELECT current_database() AS name`;
    assert.equal(name[0]?.name, 'myuno_browser_test');
    const before = await db.booking.findUniqueOrThrow({ where: { id: bookingId }, include: { guestIdentity: { select: { email: true } } } });
    assert.equal(before.unitId, fixture.unitId); assert.equal(before.guestIdentity.email, 'registered@browser.example.test');
    assert.equal(before.status, kind === 'hold' ? 'pending_payment' : 'requested');
    const deadline = kind === 'hold' ? before.holdExpiresAt : before.requestExpiresAt; assert.ok(deadline);
    const cutoff = new Date(deadline.getTime() + 1000);
    if (kind === 'hold') await expireHolds(db, cutoff); else await autoDeclineRequests(db, cutoff);
    const after = await db.booking.findUniqueOrThrow({ where: { id: bookingId } });
    assert.equal(after.status, kind === 'hold' ? 'expired' : 'declined');
    if (kind === 'request') assert.equal(after.cancellationReason, 'auto_declined_timeout');
    assert.equal(after.holdExpiresAt, null); assert.equal(after.requestExpiresAt, null);
    assert.deepEqual(await Promise.all([
      db.payment.count({ where: { bookingId } }),
      db.ledgerEntry.count({ where: { bookingId } }),
      db.depositPreauth.count({ where: { bookingId } }),
    ]), [0, 0, 0]);
    await writeFile(`browser-results/request-expiry-${bookingId}.json`, JSON.stringify({
      synthetic: true, method: kind === 'hold' ? 'expireHolds' : 'autoDeclineRequests',
      deadline: deadline.toISOString(), explicitFutureCutoff: cutoff.toISOString(), status: after.status, bookingId,
    }, null, 2));
  } finally { await db.$disconnect(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
