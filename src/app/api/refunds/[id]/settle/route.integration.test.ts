import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { db, resetDb, createIdentity, createProject, createUnit, createBooking } from '@/test/util';
import { recordCashPayment } from '@/modules/finance';

const currentUser = vi.hoisted(() => vi.fn());
vi.mock('@/app/actions/getCurrentUser', () => ({ getCurrentUser: currentUser }));
vi.mock('@/lib/prisma', async () => ({ prisma: (await import('@/test/util')).db }));
import { POST } from './route';

describe('POST /api/refunds/[id]/settle — cash refund payout', () => {
  let refundId: string;
  let bookingId: string;
  let guestId: string;
  const call = () => POST(new NextRequest('http://localhost/api/refunds/x/settle', { method: 'POST' }), { params: { id: refundId } });

  beforeEach(async () => {
    await resetDb();
    const project = await createProject({ status: 'live' });
    const unit = await createUnit({ projectId: project.id, status: 'live' });
    const guest = await createIdentity();
    guestId = guest.id;
    const staff = await createIdentity();
    const booking = await createBooking({ unitId: unit.id, projectId: project.id, guestIdentityId: guest.id, totalThb: 500_000, status: 'pending_payment' });
    bookingId = booking.id;
    const payment = await recordCashPayment(db, {
      purpose: 'stay', bookingId, payerIdentityId: guest.id, amountThb: 500_000,
      receivedByIdentityId: staff.id, receiptRef: 'SYNTHETIC-CHK-1',
    });
    const refund = await db.refund.create({ data: {
      paymentId: payment.id, method: 'cash', amountThb: 500_000, reason: 'cancellation',
      status: 'requested', initiatedByIdentityId: guest.id,
    } });
    refundId = refund.id;
    await db.booking.update({ where: { id: bookingId }, data: { status: 'cancelled', refundAccruedThb: 500_000 } });
  });

  it('admin settles it once: refund succeeds, refund_out is written, a repeat changes nothing', async () => {
    const admin = await createIdentity({ isAdmin: true });
    currentUser.mockResolvedValue({ identityId: admin.id, isAdmin: true, roles: [] });
    expect((await call()).status).toBe(200);
    expect(await db.refund.findUniqueOrThrow({ where: { id: refundId } })).toMatchObject({ status: 'succeeded', paidBackByIdentityId: admin.id });
    expect(await db.ledgerEntry.findMany({ where: { refundId, entryType: 'refund_out' } })).toHaveLength(1);
    expect((await call()).status).toBe(200);
    expect(await db.ledgerEntry.count({ where: { refundId, entryType: 'refund_out' } })).toBe(1);
  });

  it('the guest cannot mark their own refund paid', async () => {
    currentUser.mockResolvedValue({ identityId: guestId, isAdmin: false, roles: [] });
    expect((await call()).status).toBe(403);
    expect((await db.refund.findUniqueOrThrow({ where: { id: refundId } })).status).toBe('requested');
    expect(await db.ledgerEntry.count({ where: { refundId } })).toBe(0);
  });

  it('refuses anonymous callers', async () => {
    currentUser.mockResolvedValue(null);
    expect((await call()).status).toBe(401);
  });
});
