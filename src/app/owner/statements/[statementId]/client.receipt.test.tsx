// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { OwnerStatementDetailClient, type StatementDetail } from './client';

const statement: StatementDetail = {
  id: 'stmt-1', unitName: 'B-707', periodStart: '2026-07-01T00:00:00.000Z', periodEnd: '2026-07-31T00:00:00.000Z',
  status: 'pending_owner_review', publishedAt: '2026-08-01T00:00:00.000Z', approvedAt: null,
  signedOffByOwnerAt: null, signedOffByOperatorAt: '2026-08-02T00:00:00.000Z',
  grossBookingsAmountTh: 9000, guestPaymentsReceivedTh: 9000, serviceFeesAmountTh: 900, operatingExpensesAmountTh: 2500,
  taxesAmountTh: 0, adjustedNoiTh: 5600, distributableCashTh: 5600, performanceFeeAmountTh: null, performanceFeeBasisText: null,
  grossRevenueTh: 9000, totalCostsTh: 3400, noiTh: 5600, ownerShareTh: 5000, estateShareTh: 600, capApplied: false,
  lines: [
    { id: 'l1', category: 'operating_expense', description: 'cleaning_cost: Deep clean', amountTh: 2500, bookingId: null, bookingStartDate: null, bookingEndDate: null, receiptId: 'receipt-1' },
    { id: 'l2', category: 'operating_expense', description: 'utilities_cost: Power', amountTh: 0, bookingId: null, bookingStartDate: null, bookingEndDate: null, receiptId: null },
  ],
  payout: null, questionThreadId: null, ownerMaySign: true,
};

const labels: Record<string, string> = {
  'owner.statement.operating_expenses': 'Operating expenses',
  'owner.statement.breakdown_title': 'How this statement was calculated',
  'owner.statement.lines_show': 'Show source lines',
  'owner.statement.lines_hide': 'Hide source lines',
  'owner.statement.lines_empty': 'No source lines',
  'owner.statement.receipt_view': 'View receipt',
  'owner.statement.signoff_title': 'Sign-off',
  'owner.statement.signoff_description': 'Sign to approve',
  'owner.statement.signoff_action': 'Sign off',
  'owner.statement.signoff_error': 'Could not sign off.',
  'owner.statement.signoff_already_signed': 'You have already signed this statement.',
  'owner.statement.signoff_stale': 'This statement changed after it was prepared and cannot be signed as it stands.',
  'common.line_item_category.operating_expense': 'Operating expenses',
};

afterEach(() => vi.unstubAllGlobals());

describe('owner statement: expense lines and their receipts', () => {
  it('links an expense line to its private receipt through the checked download route, and only that line', async () => {
    render(<OwnerStatementDetailClient statement={statement} labels={labels} />);
    // Open the expense row's source lines (each row with lines has its own toggle).
    for (const toggle of screen.getAllByRole('button', { name: 'Show source lines' })) {
      await userEvent.click(toggle);
      if (screen.queryByText('cleaning_cost: Deep clean')) break;
    }
    const links = screen.getAllByRole('link', { name: 'View receipt' });
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAttribute('href', '/api/ledger/receipts/receipt-1');
    // Never a storage address: the file is only reachable through the route that re-checks the viewer.
    expect(links[0].getAttribute('href')).not.toMatch(/^https?:|blob|data:/);
  });
});

describe('owner sign-off availability', () => {
  it('offers the signature only while the server says one can still be written', () => {
    const { rerender } = render(<OwnerStatementDetailClient statement={statement} labels={labels} />);
    expect(screen.getByRole('button', { name: 'Sign off' })).toBeInTheDocument();
    rerender(<OwnerStatementDetailClient statement={{ ...statement, status: 'distributed', ownerMaySign: false }} labels={labels} />);
    expect(screen.queryByRole('button', { name: 'Sign off' })).toBeNull();
  });
});

describe('owner sign-off answers', () => {
  const sign = async (response: { status: number; body: unknown }) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: response.status < 400, status: response.status, json: () => Promise.resolve(response.body),
    }));
    render(<OwnerStatementDetailClient statement={statement} labels={labels} />);
    await userEvent.click(screen.getByRole('button', { name: 'Sign off' }));
  };

  it('says the statement changed — not "already signed" — when the server reports it stale', async () => {
    await sign({ status: 409, body: { error: 'x', code: 'statement_stale' } });
    await waitFor(() => expect(screen.getByText(/changed after it was prepared/)).toBeInTheDocument());
    expect(screen.queryByText(/already signed/)).toBeNull();
  });

  it('still says "already signed" for a genuine duplicate', async () => {
    await sign({ status: 409, body: { error: 'The owner has already signed off this statement' } });
    await waitFor(() => expect(screen.getByText('You have already signed this statement.')).toBeInTheDocument());
  });
});
