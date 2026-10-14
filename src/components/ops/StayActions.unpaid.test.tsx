// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import StayActions from './StayActions';

const mocks = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => mocks }));
vi.mock('@/components/ops/CheckOutConditionReportModal', () => ({ default: () => null }));
const labels = {
  'staff.stay_360.actions': 'Next action', 'staff.stay_360.warning': 'Real receipts only',
  'staff.stay_360.confirm_unpaid': 'Confirm reservation — payment outstanding',
  'staff.stay_360.confirm_unpaid_note': 'This does not record money',
  'staff.stay_360.confirm_reason': 'Reason before payment', 'staff.stay_360.balance': 'Balance due',
  'staff.stay_360.receipt': 'Receipt reference', 'staff.stay_360.cash': 'Record cash payment',
  'staff.stay_360.success': 'Updated', 'staff.stay_360.error': 'Failed',
};
const props = { id: 'stay-1', status: 'pending_payment', updatedAt: '2026-10-14T00:00:00.000Z',
  balanceSatang: 123456, canConfirmUnpaid: true, canRecordMoney: false, canManageReservations: true,
  canManageFrontDesk: false, guestName: 'Synthetic guest', unitName: 'Synthetic unit', labels };

describe('honest operator confirmation and receipt controls', () => {
  beforeEach(() => { mocks.refresh.mockReset(); vi.stubGlobal('crypto', { randomUUID: () => '11111111-1111-4111-8111-111111111111' }); });
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

  it('requires a reason and sends revision/command, never money or receipt', async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }); vi.stubGlobal('fetch', fetcher);
    render(<StayActions {...props}/>);
    expect(screen.getByText('Balance due: ฿1,234.56')).toBeTruthy();
    const button = screen.getByRole('button', { name: labels['staff.stay_360.confirm_unpaid'] });
    expect((button as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('Reason before payment'), { target: { value: 'Existing reservation' } });
    fireEvent.click(button);
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
    expect(fetcher.mock.calls[0][0]).toBe('/api/bookings/stay-1/confirm-unpaid');
    expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({ reason: 'Existing reservation', expectedUpdatedAt: props.updatedAt, commandId: '11111111-1111-4111-8111-111111111111' });
    expect(screen.queryByLabelText('Receipt reference')).toBeNull();
  });

  it('retries a transport failure with the same command ID', async () => {
    const fetcher = vi.fn().mockRejectedValueOnce(new Error('Connection interrupted')).mockResolvedValueOnce({ ok: true, json: async () => ({}) }); vi.stubGlobal('fetch', fetcher);
    render(<StayActions {...props}/>);
    fireEvent.change(screen.getByLabelText('Reason before payment'), { target: { value: 'Existing reservation' } });
    fireEvent.click(screen.getByRole('button', { name: labels['staff.stay_360.confirm_unpaid'] }));
    await screen.findByRole('alert');
    fireEvent.click(screen.getByRole('button', { name: labels['staff.stay_360.confirm_unpaid'] }));
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
    expect(fetcher.mock.calls[0][1].body).toBe(fetcher.mock.calls[1][1].body);
  });

  it('shows later receipt only to money-authorized operator and requires a real reference', async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }); vi.stubGlobal('fetch', fetcher);
    render(<StayActions {...props} status="confirmed" canConfirmUnpaid={false} canManageReservations={false} canRecordMoney/>);
    expect(screen.queryByRole('button', { name: labels['staff.stay_360.confirm_unpaid'] })).toBeNull();
    const button = screen.getByRole('button', { name: 'Record cash payment' });
    expect((button as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('Receipt reference'), { target: { value: 'ACTUAL-SYNTHETIC-RECEIPT' } });
    fireEvent.click(button);
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
    expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({ receiptRef: 'ACTUAL-SYNTHETIC-RECEIPT' });
  });

  it('never offers collection or confirmation for a cancelled reservation', () => {
    render(<StayActions {...props} status="cancelled" canRecordMoney/>);
    expect(screen.queryByRole('button', { name: 'Record cash payment' })).toBeNull();
    expect(screen.queryByRole('button', { name: labels['staff.stay_360.confirm_unpaid'] })).toBeNull();
  });
});
