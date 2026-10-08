import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { createBooking, createIdentity, createProject, createUnit, db, resetDb } from '@/test/util';
import { DEFAULT_POLICIES } from '@/modules/booking';
import { refund, verifyAndConfirm } from '@/modules/finance';
import type { CancellationQuote } from '@/modules/booking/cancellation-quote';

const { currentUser } = vi.hoisted(() => ({ currentUser: vi.fn() }));
vi.mock('@/app/actions/getCurrentUser', () => ({ getCurrentUser: currentUser }));
vi.mock('@/lib/prisma', async () => ({ prisma: (await import('@/test/util')).db }));
import { POST } from './route';
import { GET as detail } from '@/app/api/bookings/[id]/route';

async function displayedBooking(bookingId: string) {
  const response = await detail(new NextRequest(`http://localhost/api/bookings/${bookingId}`), { params: { id: bookingId } });
  expect(response.status).toBe(200);
  return response.json();
}

const cancelReviewed = (bookingId: string, quote: unknown) => POST(new NextRequest('http://localhost/api/bookings/x/cancel', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ reason: 'guest_requested', cancellationQuote: quote }),
}), { params: { id: bookingId } });

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

  it('rejects the unpaid confirmation shown before capture completed, even when POST first reads the paid booking', async () => {
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
    const displayedResponse = await detail(new NextRequest(`http://localhost/api/bookings/${booking.id}`), { params: { id: booking.id } });
    expect(displayedResponse.status).toBe(200);
    const displayed = await displayedResponse.json();
    expect(displayed).toMatchObject({ status: 'pending_payment', refundPreviewThb: null });
    const acceptedQuote = { bookingId: booking.id, bookingUpdatedAt: displayed.updatedAt,
      bookingStatus: displayed.status, refundAmountSatang: 0 };
    expect(displayed.cancellationQuote).toEqual(acceptedQuote);
    // Guest confirms the already displayed unpaid dialog. Capture commits
    // before cancellation even starts; there is no lock wait to expose it.
    expect(await verifyAndConfirm(db, payment.id)).toMatchObject({ confirmed: true });
    const response = await POST(new NextRequest('http://localhost/api/bookings/x/cancel', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'guest_requested', cancellationQuote: acceptedQuote }),
    }), { params: { id: booking.id } });
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ code: 'BOOKING_CHANGED' });
    expect(await db.booking.findUniqueOrThrow({ where: { id: booking.id } })).toMatchObject({ status: 'confirmed', refundAccruedThb: 0 });
    expect(await db.refund.count()).toBe(0);
    expect(await db.notification.count({ where: { type: 'stay_cancelled' } })).toBe(0);
    const refreshed = await displayedBooking(booking.id);
    expect(refreshed.refundPreviewThb).toBe(4000);
    const approved = await cancelReviewed(booking.id, refreshed.cancellationQuote);
    expect(approved.status).toBe(200);
    expect(await approved.json()).toMatchObject({ refund: { amountThb: 400_000, recordsCreated: 1 } });
  });

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
    const acceptedQuote = (await displayedBooking(booking.id)).cancellationQuote as CancellationQuote;
    let ready!: () => void;
    let release!: () => void;
    const reached = new Promise<void>(resolve => { ready = resolve; });
    const released = new Promise<void>(resolve => { release = resolve; });
    captureGate = { reached: ready, release: released };
    const capture = verifyAndConfirm(db, payment.id);
    await reached; // Finance owns the booking row, but its received-money transition has not committed.
    let settled = false;
    const attempt = cancelReviewed(booking.id, acceptedQuote).finally(() => { settled = true; });
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
    const retried = await cancelReviewed(booking.id, (await displayedBooking(booking.id)).cancellationQuote);
    expect(retried.status).toBe(200);
    expect(await retried.json()).toMatchObject({ booking: { status: 'cancelled', refundAccruedThb: 400_000 },
      refund: { amountThb: 400_000, recordsCreated: 1 } });
    expect(await db.refund.findFirstOrThrow()).toMatchObject({ paymentId: payment.id, amountThb: 400_000, status: 'processing' });
    expect(await db.ledgerEntry.count({ where: { paymentId: payment.id, entryType: 'rental_revenue' } })).toBe(1);
  });

  it('requires review of changed refund capacity even when the booking version is unchanged', async () => {
    const guest = await createIdentity();
    currentUser.mockResolvedValue({ identityId: guest.id, roles: [], isAdmin: false });
    const project = await createProject();
    const unit = await createUnit(project.id);
    const booking = await createBooking({ unitId: unit.id, projectId: project.id, guestIdentityId: guest.id,
      status: 'confirmed', totalThb: 400_099,
      startDate: new Date(Date.now() + 7 * 86_400_000), endDate: new Date(Date.now() + 10 * 86_400_000),
      cancellationPolicySnapshot: { name: 'flexible', steps: DEFAULT_POLICIES.flexible.steps } });
    const payment = await db.payment.create({ data: { purpose: 'stay', bookingId: booking.id, payerIdentityId: guest.id,
      amountThb: booking.totalThb, method: 'card_provider', provider: 'mock', status: 'succeeded', succeededAt: new Date() } });
    const shown = await displayedBooking(booking.id);
    expect(shown.refundPreviewThb).toBe(4000.99);
    await refund(db, payment.id, 100_000, 'cancellation', guest.id);
    expect((await db.booking.findUniqueOrThrow({ where: { id: booking.id } })).updatedAt).toEqual(booking.updatedAt);
    const stale = await cancelReviewed(booking.id, shown.cancellationQuote);
    expect(stale.status).toBe(409);
    expect(await stale.json()).toMatchObject({ code: 'BOOKING_CHANGED' });
    expect(await db.booking.findUniqueOrThrow({ where: { id: booking.id } })).toMatchObject({ status: 'confirmed' });
    expect(await db.refund.count()).toBe(1);
    expect(await db.notification.count({ where: { type: 'stay_cancelled' } })).toBe(0);
    const refreshed = await displayedBooking(booking.id);
    expect(refreshed.refundPreviewThb).toBe(3000.99);
    expect(refreshed.cancellationQuote.refundAmountSatang).toBe(300_099);
    const accepted = await cancelReviewed(booking.id, refreshed.cancellationQuote);
    expect(accepted.status).toBe(200);
    expect(await accepted.json()).toMatchObject({ refund: { amountThb: 300_099, recordsCreated: 1 } });
    const reserved = await db.refund.aggregate({ where: { paymentId: payment.id }, _sum: { amountThb: true } });
    expect(reserved._sum.amountThb).toBe(400_099);
  });

  it.each([undefined, { refundAmountSatang: -1 }, { refundAmountSatang: 0.1 }])('rejects a missing or malformed confirmation without cancellation: %j', async quote => {
    const guest = await createIdentity();
    currentUser.mockResolvedValue({ identityId: guest.id, roles: [], isAdmin: false });
    const project = await createProject();
    const unit = await createUnit(project.id);
    const booking = await createBooking({ unitId: unit.id, projectId: project.id, guestIdentityId: guest.id, status: 'requested' });
    const shown = await displayedBooking(booking.id);
    const invalid = quote === undefined ? undefined : { ...shown.cancellationQuote, ...quote };
    const response = await cancelReviewed(booking.id, invalid);
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ code: 'BOOKING_CHANGED' });
    expect(await db.booking.findUniqueOrThrow({ where: { id: booking.id } })).toMatchObject({ status: 'requested' });
    expect(await db.refund.count()).toBe(0);
    expect(await db.notification.count({ where: { type: 'stay_cancelled' } })).toBe(0);
  });
});
