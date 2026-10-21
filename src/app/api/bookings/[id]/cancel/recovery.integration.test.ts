import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { db, resetDb, createIdentity, createProject, createUnit, createBooking } from '@/test/util';
import { getCancellationQuote } from '@/modules/booking/cancellation-quote';
const mocks = vi.hoisted(() => ({ user: vi.fn(), dispatch: vi.fn() }));
vi.mock('@/app/actions/getCurrentUser', () => ({ getCurrentUser: mocks.user }));
vi.mock('@/lib/prisma', async () => ({ prisma: (await import('@/test/util')).db }));
vi.mock('@/modules/finance', async original => ({ ...(await original<typeof import('@/modules/finance')>()), processRequestedCardRefund: mocks.dispatch }));
import { POST } from './route';
let failRefundCreate = false;
let failRefundRead = false;
db.$use(async (params, next) => {
  if (failRefundRead && params.model === 'Refund' && params.action === 'findMany') {
    failRefundRead = false; throw new Error('Synthetic post-commit read outage');
  }
  if (failRefundCreate && params.model === 'Refund' && params.action === 'create') {
    failRefundCreate = false;
    throw new Error('Synthetic refund persistence outage');
  }
  return next(params);
});
beforeEach(async () => { await resetDb(); mocks.dispatch.mockReset(); });
afterEach(() => { failRefundCreate = false; failRefundRead = false; });
async function fixture(method: 'cash' | 'card_provider' = 'cash') {
  const guest = await createIdentity(), project = await createProject(), unit = await createUnit(project.id);
  const booking = await createBooking({ unitId: unit.id, projectId: project.id, guestIdentityId: guest.id,
    status: 'confirmed', totalThb: 400000, startDate: new Date(Date.now() + 7 * 86400000), endDate: new Date(Date.now() + 10 * 86400000),
    cancellationPolicySnapshot: { name: 'Synthetic full refund', steps: [{ days_before_checkin: 0, refund_pct: 100 }] } });
  await db.payment.create({ data: { bookingId: booking.id, payerIdentityId: guest.id, purpose: 'stay',
    method, provider: method === 'cash' ? 'cash' : 'mock', amountThb: 400000, status: 'succeeded' } });
  mocks.user.mockResolvedValue({ identityId: guest.id });
  const quote = await getCancellationQuote(db, booking);
  const send = () => POST(new NextRequest('http://localhost/api/bookings/x/cancel', { method: 'POST',
    body: JSON.stringify({ reason: 'Synthetic cancellation', cancellationQuote: quote }) }), { params: Promise.resolve({ id: booking.id }) });
  return { booking, send };
}
describe('durable cancellation refunds', () => {
  it('rolls back cancellation if its refund obligation cannot be saved, then allows retry', async () => {
    const f = await fixture(); failRefundCreate = true;
    expect((await f.send()).status).toBe(400);
    expect(await db.booking.findUniqueOrThrow({ where: { id: f.booking.id } })).toMatchObject({ status: 'confirmed', refundAccruedThb: 0 });
    expect(await db.refund.count()).toBe(0);
    expect((await f.send()).status).toBe(200);
    expect(await db.refund.count()).toBe(1);
  });
  it('returns the committed cancellation after response loss/repeat without duplicate obligations or notices', async () => {
    const f = await fixture(); const responses = await Promise.all([f.send(), f.send()]);
    expect(responses.map(r => r.status)).toEqual([200, 200]);
    const saved = await db.booking.findUniqueOrThrow({ where: { id: f.booking.id } });
    expect(saved.status).toBe('cancelled'); expect(await db.refund.count()).toBe(1);
    expect((await f.send()).status).toBe(200);
    expect((await db.booking.findUniqueOrThrow({ where: { id: f.booking.id } })).cancelledAt).toEqual(saved.cancelledAt);
    expect(await db.refund.count()).toBe(1);
    expect(await db.notification.count({ where: { type: 'stay_cancelled', identityId: saved.guestIdentityId } })).toBe(1);
  });
  it('does not report a committed cancellation as failed when the response summary read fails', async () => {
    const f = await fixture(); failRefundRead = true;
    expect((await f.send()).status).toBe(200);
    expect(await db.booking.findUniqueOrThrow({ where: { id: f.booking.id } })).toMatchObject({ status: 'cancelled' });
    expect(await db.refund.count()).toBe(1);
    expect((await f.send()).status).toBe(200); expect(await db.refund.count()).toBe(1);
  });
  it('keeps a durable requested card refund when dispatch fails after commit', async () => {
    const f = await fixture('card_provider'); mocks.dispatch.mockRejectedValue(new Error('Synthetic dispatcher outage'));
    expect((await f.send()).status).toBe(200);
    expect(await db.booking.findUniqueOrThrow({ where: { id: f.booking.id } })).toMatchObject({ status: 'cancelled', refundAccruedThb: 400000 });
    expect(await db.refund.findFirstOrThrow()).toMatchObject({ status: 'requested', amountThb: 400000 });
    expect((await f.send()).status).toBe(200); expect(await db.refund.count()).toBe(1);
  });
});
