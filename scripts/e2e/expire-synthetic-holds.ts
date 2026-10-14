import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
const localRequire = createRequire(resolve('scripts/e2e/expire-synthetic-holds.ts'));
localRequire('./isolation.cjs').assertIsolation();

async function main() {
  const { PrismaClient } = await import('@prisma/client');
  const { expireHolds } = await import('@/modules/booking');
  const db = new PrismaClient();
  try {
    const fixture = JSON.parse(await readFile('browser-results/fixture.json', 'utf8'));
    const bookingId = process.argv[2];
    assert.match(bookingId ?? '', /^[0-9a-f-]{36}$/);
    const name = await db.$queryRaw<Array<{ name: string }>>`SELECT current_database() AS name`;
    assert.equal(name[0]?.name, 'myuno_browser_test');
    const before = await db.booking.findUniqueOrThrow({ where: { id: bookingId } });
    assert.equal(before.unitId, fixture.unitId); assert.equal(before.guestIdentityId, fixture.guestId);
    assert.equal(before.channel, 'manual'); assert.equal(before.status, 'confirmed');
    assert.equal(before.holdExpiresAt, null); assert.equal(before.balanceDueThb, before.totalThb);
    const cutoff = new Date(Date.now() + 31 * 60_000);
    // An explicit synthetic future cutoff, not a claim that wall-clock time passed.
    await expireHolds(db, cutoff);
    const after = await db.booking.findUniqueOrThrow({ where: { id: bookingId } });
    assert.equal(after.status, 'confirmed'); assert.equal(after.holdExpiresAt, null);
    assert.equal(after.balanceDueThb, before.totalThb); assert.equal(after.updatedAt.toISOString(), before.updatedAt.toISOString());
    assert.equal(await db.payment.count({ where: { bookingId } }), 0);
    assert.equal(await db.ledgerEntry.count({ where: { bookingId } }), 0);
    assert.equal(await db.depositPreauth.count({ where: { bookingId } }), 0);
    await writeFile('browser-results/unpaid-expiry.json', JSON.stringify({
      synthetic: true, method: 'canonical expireHolds with explicit future cutoff',
      cutoff: cutoff.toISOString(), bookingId, status: after.status,
      holdExpiresAt: after.holdExpiresAt, balanceDueSatang: after.balanceDueThb,
    }, null, 2));
    console.log('Synthetic future-cutoff expiry preserved the confirmed unpaid reservation.');
  } finally { await db.$disconnect(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
