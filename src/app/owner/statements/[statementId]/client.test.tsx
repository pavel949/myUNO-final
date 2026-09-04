// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import {
  OwnerStatementDetailClient,
  type StatementDetail,
} from './client';

// Q55 retrofit regression guard: this client used to hand-roll its own
// formatCurrency(thb) — StatementDetail's *Th fields arrive already
// converted to baht by the page server component (Q47), so the migration to
// the shared MoneyAmount (satang-in) multiplies each figure back to satang
// at the call site. This test locks in that the visible baht figures are
// unchanged by that migration.
const baseStatement: StatementDetail = {
  id: 'stmt-1',
  unitName: 'B-707',
  periodStart: '2026-07-01T00:00:00.000Z',
  periodEnd: '2026-07-31T00:00:00.000Z',
  status: 'published',
  publishedAt: '2026-08-01T00:00:00.000Z',
  approvedAt: null,
  signedOffByOwnerAt: null,
  signedOffByOperatorAt: null,

  grossBookingsAmountTh: 50000,
  guestPaymentsReceivedTh: 50000,
  serviceFeesAmountTh: 5000,
  operatingExpensesAmountTh: 2000,
  taxesAmountTh: 1000,
  adjustedNoiTh: 42000,
  distributableCashTh: 40000,
  performanceFeeAmountTh: null,
  performanceFeeBasisText: null,

  grossRevenueTh: 50000,
  totalCostsTh: 8000,
  noiTh: 42000,
  ownerShareTh: 34000,
  estateShareTh: 8000,
  capApplied: false,

  lines: [],
  payout: null,
  questionThreadId: null,
};

const labels: Record<string, string> = {
  'owner.statement.gross_bookings': 'Gross bookings',
  'owner.statement.adjusted_noi': 'Adjusted net operating income',
  'owner.statement.distributable_cash': 'Distributable cash',
  'owner.statement.your_share': 'Your Share',
  'owner.statement.estate_share': 'myUNO share',
  'owner.statement.summary_title': 'Summary',
  'owner.statement.breakdown_title': 'How this statement was calculated',
  'owner.statement.breakdown_subtitle': 'subtitle',
  'owner.statement.split_title': 'How the result is split',
  'owner.statement.signoff_title': 'Sign-off',
  'owner.statement.detail_title': 'Statement',
  'owner.statement.unit': 'Unit',
  'owner.statement.period': 'Period',
  'owner.statement.back': 'Back to dashboard',
  'owner.statement.signoff_awaiting_owner': 'Awaiting your signature',
  'owner.statement.signoff_awaiting_operator': "Awaiting myUNO's signature",
  'owner.statement.payout_title': 'Payout',
  'owner.statement.payout_pending': 'No payout recorded yet.',
  'owner.statement.question_title': 'Question this statement',
  'owner.statement.question_hint': 'Ask about a line item.',
  'owner.statement.question_open': 'Ask a question',
  'common.status.statement.published': 'Published',
};

describe('OwnerStatementDetailClient money display (Q55 MoneyAmount migration)', () => {
  it('renders the summary tiles in baht, matching the pre-migration values', () => {
    render(<OwnerStatementDetailClient statement={baseStatement} labels={labels} />);

    // Gross bookings: ฿50,000
    expect(screen.getAllByText('฿50,000').length).toBeGreaterThan(0);
    // Adjusted NOI: ฿42,000 (appears in the stat tile and the breakdown row)
    expect(screen.getAllByText('฿42,000').length).toBeGreaterThan(0);
    // Distributable cash: ฿40,000
    expect(screen.getAllByText('฿40,000').length).toBeGreaterThan(0);
    // Owner's share: ฿34,000 (stat tile + split section)
    expect(screen.getAllByText('฿34,000').length).toBeGreaterThan(0);
    // myUNO share: ฿8,000
    expect(screen.getAllByText('฿8,000').length).toBeGreaterThan(0);

    // None of these should ever show a 100x-too-large satang value.
    expect(screen.queryByText(/฿5,000,000/)).not.toBeInTheDocument();
    expect(screen.queryByText(/฿4,200,000/)).not.toBeInTheDocument();
  });

  it('shows deductions with a minus prefix, unchanged from the old formatter', () => {
    render(<OwnerStatementDetailClient statement={baseStatement} labels={labels} />);
    // Service fees (a deduction row) = ฿5,000 with a leading minus.
    expect(
      screen.getAllByText((_, node) => node?.textContent === '− ฿5,000').length
    ).toBeGreaterThan(0);
  });
});
