import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { db, resetDb, createIdentity, createProject, createUnit } from '@/test/util';
import {
  createBooking, checkInBooking, checkOutBooking, completeBooking,
} from '@/modules/booking';
import { recordCashPayment } from '@/modules/finance';
import { getProcessState } from '@/app/(admin)/app/admin/processes/process-state';

const currentUser = vi.fn();
vi.mock('@/app/actions/getCurrentUser', () => ({ getCurrentUser: () => currentUser() }));
vi.mock('@/lib/prisma', async () => {
  const { db } = await import('@/test/util');
  return { prisma: db };
});
import { POST as generateStatement } from '@/app/api/admin/statements/generate/route';

describe('canonical property → booking → operations → financial close', () => {
  beforeEach(async () => { await resetDb(); });
  afterEach(async () => { await resetDb(); });

  it('retains one property, one booking and a reconciled payment through owner reporting', async () => {
    const admin = await createIdentity({ isAdmin: true });
    const owner = await createIdentity();
    const guest = await createIdentity();
    currentUser.mockResolvedValue({
      identityId: admin.id, isAdmin: true, email: admin.email,
      firstName: admin.firstName, lastName: admin.lastName, roles: [],
    });
    const project = await createProject({ status: 'live' });
    const unit = await createUnit({
      projectId: project.id, ownerIdentityId: owner.id,
      categoryKey: 'two_bedroom', name: 'Villa G6', status: 'live',
      baseNightlyThb: 200_00, instantBook: true,
    });
    await db.unitEngagement.create({
      data: {
        unitId: unit.id, ownerIdentityId: owner.id, engagementType: 'direct_managed',
        status: 'active', noiCapAnnualThb: 1_000_000_00,
      },
    });

    const booking = await createBooking(db, {
      unitId: unit.id, projectId: project.id, guestIdentityId: guest.id,
      bookingType: 'guest_stay', channel: 'direct',
      startDate: new Date('2026-08-03'), endDate: new Date('2026-08-07'),
      adults: 2, children: 0, totalThb: 0, instantBook: true,
    });
    expect(booking.status).toBe('pending_payment');
    expect(booking.unit.inventoryCategoryId).toBeTruthy();
    await expect(createBooking(db, {
      unitId: unit.id, projectId: project.id, guestIdentityId: guest.id,
      bookingType: 'guest_stay', channel: 'direct',
      startDate: new Date('2026-08-04'), endDate: new Date('2026-08-06'),
      adults: 2, children: 0, totalThb: 0, instantBook: true,
    })).rejects.toMatchObject({ code: 'DOUBLE_BOOK' });

    const payment = await recordCashPayment(db, {
      purpose: 'stay', bookingId: booking.id, payerIdentityId: guest.id,
      amountThb: booking.totalThb, receivedByIdentityId: admin.id,
      receiptRef: 'INTEGRATION-RECEIPT',
    });
    const revenue = await db.ledgerEntry.findMany({
      where: { bookingId: booking.id, paymentId: payment.id, entryType: 'rental_revenue' },
    });
    expect(revenue).toHaveLength(1);
    expect(revenue[0].amountThb).toBe(booking.totalThb);
    await checkInBooking(db, booking.id);
    await checkOutBooking(db, booking.id);
    await completeBooking(db, booking.id);

    const response = await generateStatement(new NextRequest(
      'http://localhost/api/admin/statements/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ unitId: unit.id, periodStart: '2026-08-01', periodEnd: '2026-08-31' }),
      },
    ));
    expect(response.status).toBe(200);
    const statement = (await response.json()).statement;
    expect(statement.grossBookingsAmountThb).toBe(booking.totalThb);
    expect(statement.guestPaymentsReceivedThb).toBe(booking.totalThb);

    const stored = await db.booking.findUniqueOrThrow({
      where: { id: booking.id },
      include: { payments: true, ledgerEntries: true, statementLines: true },
    });
    expect(stored.status).toBe('completed');
    expect(stored.payments.filter(p => p.status === 'succeeded' && p.purpose === 'stay')).toHaveLength(1);
    expect(stored.ledgerEntries.filter(e => e.entryType === 'rental_revenue')).toHaveLength(1);
    expect(stored.statementLines.some(l => l.statementId === statement.id)).toBe(true);
    expect(await db.unit.count({ where: { projectId: project.id, name: unit.name } })).toBe(1);
    expect(await db.booking.count({ where: { id: booking.id } })).toBe(1);

    const snapshot = await getProcessState(db);
    expect(snapshot['05'].summary).toContain('0 requests');
    expect(snapshot['06'].summary).toContain('1 completed');
    expect(snapshot['12'].attention).toBeNull();
  });
});
