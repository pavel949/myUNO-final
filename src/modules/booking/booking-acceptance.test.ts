import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PrismaClient } from '@prisma/client';

vi.mock('@/modules/analytics', () => ({ track: vi.fn().mockResolvedValue(null) }));
vi.mock('@/modules/comms', () => ({ createNotification: vi.fn() }));
vi.mock('@/modules/finance', () => ({ ensureDepositPreauthOnStayConfirmed: vi.fn() }));
vi.mock('./source-authority', () => ({ assertLayantaraBookingAuthority: vi.fn().mockResolvedValue(null) }));
vi.mock('./notify-requested', () => ({ notifyBookingRequested: vi.fn().mockResolvedValue(null) }));
vi.mock('./notify-modified', () => ({ notifyBookingModified: vi.fn() }));
vi.mock('@/modules/core', () => ({ computePriceBreakdown: vi.fn() }));

import { computePriceBreakdown } from '@/modules/core';
import { notifyBookingRequested } from './notify-requested';
import { createBooking, type CreateBookingInput } from './booking.service';

describe('booking acceptance at the canonical writer', () => {
  const unit = { id: 'unit-a', projectId: 'project-a', instantBook: false };
  const tx = {
    $executeRaw: vi.fn().mockResolvedValue(1),
    unit: { findUnique: vi.fn() },
    booking: {
      findFirst: vi.fn().mockResolvedValue(null),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      create: vi.fn(),
    },
    blockedDate: { findFirst: vi.fn().mockResolvedValue(null) },
  };
  const db = {
    $transaction: (fn: (client: typeof tx) => unknown) => fn(tx),
  } as unknown as PrismaClient;
  const input: CreateBookingInput = {
    unitId: unit.id, projectId: unit.projectId, guestIdentityId: 'guest-a',
    bookingType: 'guest_stay', channel: 'direct',
    startDate: new Date('2027-02-01'), endDate: new Date('2027-02-04'),
    adults: 2, children: 0, totalThb: 1, instantBook: true,
    acceptedMaxTotalThb: 300_000,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    unit.instantBook = false;
    tx.unit.findUnique.mockImplementation(async () => ({ ...unit }));
    tx.booking.create.mockImplementation(async ({ data }) => ({ id: 'booking-a', ...data }));
    vi.mocked(computePriceBreakdown).mockResolvedValue({ total_thb: 300_000 } as never);
  });

  it('cannot turn a request-only unit into an instant booking with client input', async () => {
    const booking = await createBooking(db, input);
    expect(booking.status).toBe('requested');
    expect(booking.holdExpiresAt).toBeNull();
    expect(booking.requestExpiresAt).toBeInstanceOf(Date);
    expect(notifyBookingRequested).toHaveBeenCalledWith(db, booking.id, 24);
  });

  it('keeps the configured instant-book flow', async () => {
    unit.instantBook = true;
    const booking = await createBooking(db, input);
    expect(booking.status).toBe('pending_payment');
    expect(booking.holdExpiresAt).toBeInstanceOf(Date);
    expect(booking.requestExpiresAt).toBeNull();
    expect(notifyBookingRequested).not.toHaveBeenCalled();
  });

  it('allows a caller to request approval without escalating the unit capability', async () => {
    unit.instantBook = true;
    const booking = await createBooking(db, { ...input, instantBook: false });
    expect(booking.status).toBe('requested');
  });

  it('rejects an increase at the final price calculation without writing a booking', async () => {
    vi.mocked(computePriceBreakdown).mockResolvedValue({ total_thb: 300_001 } as never);
    await expect(createBooking(db, input)).rejects.toMatchObject({ code: 'REQUOTE_REQUIRED' });
    expect(tx.booking.create).not.toHaveBeenCalled();
  });

  it('charges the canonical lower price, never the accepted cap or a client total', async () => {
    vi.mocked(computePriceBreakdown).mockResolvedValue({ total_thb: 290_000 } as never);
    const booking = await createBooking(db, input);
    expect(booking.totalThb).toBe(290_000);
  });
});
