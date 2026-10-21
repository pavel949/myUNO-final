import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createBooking, createIdentity, createProject, createUnit, db, resetDb } from '@/test/util';
import { recordBankTransfer } from './bank-transfer.service';

describe('bank transfer authorization under the inventory lock', () => {
  beforeEach(async () => { await resetDb(); });
  it('rolls back without money or status changes when command authority is revoked', async () => {
    const guest = await createIdentity();
    const staff = await createIdentity();
    const project = await createProject();
    const unit = await createUnit({ projectId: project.id });
    const booking = await createBooking({ unitId: unit.id, projectId: project.id, guestIdentityId: guest.id, status: 'pending_payment', totalThb: 10000, holdExpiresAt: new Date(Date.now() + 3600000) });
    const authorizeBooking = vi.fn().mockResolvedValue(false);
    await expect(recordBankTransfer(db, { purpose: 'stay', bookingId: booking.id, payerIdentityId: guest.id, confirmedByIdentityId: staff.id, amountThb: booking.totalThb, bankReference: 'local-test', authorizeBooking })).rejects.toMatchObject({ code: 'BOOKING_FORBIDDEN' });
    expect(authorizeBooking).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ projectId: project.id, unitId: unit.id }));
    expect(await db.payment.count()).toBe(0);
    expect(await db.ledgerEntry.count()).toBe(0);
    expect((await db.booking.findUniqueOrThrow({ where: { id: booking.id } })).status).toBe('pending_payment');
  });
});
