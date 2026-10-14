// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import BookingDetailClient from './booking-client';

const router = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => router }));
vi.mock('@/components/booking/BankTransferInstructions', () => ({ default: () => null }));
vi.mock('@/components/LocalDate', () => ({ LocalDate: ({ value }: { value: string }) => <span>{value}</span> }));
vi.mock('@/components/SlaCountdown', () => ({ SlaCountdown: () => null }));
const labels = new Proxy({
  'booking.detail.confirmed_unpaid': 'Reservation confirmed — payment outstanding',
  'booking.detail.outstanding_balance': 'Outstanding balance',
  'booking.detail.confirmed_unpaid_note': 'Confirmation is not a payment receipt.',
  'booking.detail.paid': 'Paid in full',
}, { get: (target, key) => target[key as keyof typeof target] ?? String(key) }) as Record<string, string>;
const booking = { id: 'synthetic', status: 'confirmed', startDate: '2027-12-01', endDate: '2027-12-03',
  adults: 2, children: 0, totalThb: 9999, balanceDueThb: 123456, holdExpiresAt: null,
  unit: { id: 'unit', name: 'Synthetic home' }, project: { id: 'project', name: 'Synthetic project' },
  payments: [], viewer: { isGuest: true, isOwner: false, isStaff: false }, cancellable: false, refundPreviewThb: 0 };

describe('guest sees confirmed reservation and honest remaining payment separately', () => {
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
  it('renders raw API satang as baht, without marking the reservation paid', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => booking }));
    render(<BookingDetailClient bookingId="synthetic" labels={labels}/>);
    expect(await screen.findByText('Outstanding balance: ฿1,234.56')).toBeTruthy();
    expect(screen.getByText('Reservation confirmed — payment outstanding')).toBeTruthy();
    expect(screen.queryByText('Paid in full')).toBeNull();
  });
  it('does not present a retained cancelled balance as collectible', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ ...booking, status: 'cancelled' }) }));
    render(<BookingDetailClient bookingId="synthetic" labels={labels}/>);
    await screen.findByText('Synthetic home');
    expect(screen.queryByText('Reservation confirmed — payment outstanding')).toBeNull();
    expect(screen.queryByText(/Outstanding balance:/)).toBeNull();
  });
  it('does not mark a partly settled confirmed reservation paid while balance remains', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ ...booking,
      payments: [{ id: 'receipt', status: 'succeeded', method: 'cash', amountThb: 1000, receiptRef: 'SYNTHETIC-PARTIAL' }] }) }));
    render(<BookingDetailClient bookingId="synthetic" labels={labels}/>);
    expect(await screen.findByText('Outstanding balance: ฿1,234.56')).toBeTruthy();
    expect(screen.queryByText('Paid in full')).toBeNull();
  });
});
