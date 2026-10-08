import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { createBooking, createIdentity, createProject, createUnit, db, resetDb } from '@/test/util';
import { DEFAULT_POLICIES } from '@/modules/booking';
import { verifyAndConfirm } from '@/modules/finance';

const { currentUser } = vi.hoisted(() => ({ currentUser: vi.fn() }));
vi.mock('@/app/actions/getCurrentUser', () => ({ getCurrentUser: currentUser }));
vi.mock('@/lib/prisma', async () => ({ prisma: (await import('@/test/util')).db }));
import { POST } from './route';

let captureGate: { reached: () => void; release: Promise<void> } | null = null;
db.$use(async (params, next) => {
  if (captureGate && params.model === 'Payment' && params.action === 'update' && params.args.data.status === 'succeeded') {
    const gate = captureGate;
    captureGate = null;
    gate.reached();
    await gate.release;
  }
  return next(params);
});

describe('cancellation versus in-flight payment confirmation', () => {
  beforeEach(async () => { await resetDb(); vi.stubEnv('PAYMENT_PROVIDER', 'mock'); });
  afterEach(() => { captureGate = null; vi.unstubAllEnvs(); });

  it('requires a fresh cancellation review when payment changed the refund basis while cancellation waited', async () => {
    const guest = await createIdentity();
    currentUser.mockResolvedValue({ identityId: guest.id, roles: [], isAdmin: false });
    const project = await createProject();
    const unit = await createUnit(project.id);
    const booking = await createBooking({ unitId: unit.id, projectId: project.id, guestIdentityId: guest.id,
      status: 'pending_payment', totalThb: 400_000, holdExpiresAt: new Date(Date.now() + 600_000),
      startDate: new Date(Date.now() + 7 * 86_400_000), endDate: new Date(Date.now() + 10 * 86_400_000),
      cancellationPolicySnapshot: { name: 'flexible', steps: DEFAULT_POLICIES.flexible.steps } });
    const payment = await db.payment.create({ data: { purpose: 'stay', bookingId: booking.id, payerIdentityId: guest.id,
      amountThb: booking.totalThb, method: 'card_provider', provider: 'mock', status: 'pending' } });
    let ready!: () => void;
    let release!: () => void;
    const reached = new Promise<void>(resolve => { ready = resolve; });
    const released = new Promise<void>(resolve => { release = resolve; });
    captureGate = { reached: ready, release: released };
    const capture = verifyAndConfirm(db, payment.id);
    await reached; // Finance owns the booking row, but its received-money transition has not committed.
    const cancel = () => POST(new NextRequest('http://localhost/api/bookings/x/cancel', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reason: 'guest_requested' }),
    }), { params: { id: booking.id } });
    let settled = false;
    const attempt = cancel().finally(() => { settled = true; });
    try {
      const deadline = Date.now() + 4_000;
      while (!settled) {
        const [row] = await db.$queryRaw<Array<{ waiting: boolean }>>`
          SELECT EXISTS (SELECT 1 FROM pg_locks WHERE NOT granted
            AND (locktype = 'transactionid' OR
              (locktype = 'advisory' AND database = (SELECT oid FROM pg_database WHERE datname = current_database())
                AND objid = ((hashtext(${unit.id})::bigint & 4294967295)::oid)))) AS waiting
        `;
        if (row.waiting) break;
        if (Date.now() > deadline) throw new Error('Cancellation did not wait for the in-flight capture');
        await new Promise(resolve => setTimeout(resolve, 10));
      }
    } finally { release(); }
    expect(await capture).toMatchObject({ confirmed: true });
    const response = await attempt;
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ code: 'BOOKING_CHANGED' });
    expect(await db.booking.findUniqueOrThrow({ where: { id: booking.id } })).toMatchObject({ status: 'confirmed', refundAccruedThb: 0 });
    expect(await db.refund.count()).toBe(0);
    const retried = await cancel();
    expect(retried.status).toBe(200);
    expect(await retried.json()).toMatchObject({ booking: { status: 'cancelled', refundAccruedThb: 400_000 },
      refund: { amountThb: 400_000, recordsCreated: 1 } });
    expect(await db.refund.findFirstOrThrow()).toMatchObject({ paymentId: payment.id, amountThb: 400_000, status: 'processing' });
    expect(await db.ledgerEntry.count({ where: { paymentId: payment.id, entryType: 'rental_revenue' } })).toBe(1);
  });
});
