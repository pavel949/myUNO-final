'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Button, StatTile, EmptyState } from '@/components';
import type { LineItemCategory, OwnerStatementStatus } from '@prisma/client';

export interface StatementLine {
  id: string;
  category: LineItemCategory;
  description: string;
  amountTh: number;
  bookingId: string | null;
  bookingStartDate: string | null;
  bookingEndDate: string | null;
}

export interface StatementDetail {
  id: string;
  unitName: string;
  periodStart: string;
  periodEnd: string;
  status: OwnerStatementStatus;
  publishedAt: string | null;
  approvedAt: string | null;
  signedOffByOwnerAt: string | null;
  signedOffByOperatorAt: string | null;

  // The transparency block (CLAUDE.md, "Fee Transparency for Owners").
  // Nullable: statements drafted before it existed carry none of it.
  grossBookingsAmountTh: number | null;
  guestPaymentsReceivedTh: number | null;
  serviceFeesAmountTh: number | null;
  operatingExpensesAmountTh: number | null;
  taxesAmountTh: number | null;
  adjustedNoiTh: number | null;
  distributableCashTh: number | null;
  performanceFeeAmountTh: number | null;
  performanceFeeBasisText: string | null;

  // The figures every statement has carried from the start.
  grossRevenueTh: number;
  totalCostsTh: number;
  noiTh: number;
  ownerShareTh: number;
  estateShareTh: number;
  capApplied: boolean;

  lines: StatementLine[];
}

interface OwnerStatementDetailClientProps {
  statement: StatementDetail;
  labels: Record<string, string>;
}

// Same money formatting as the owner dashboard: THB integers, no decimals.
const formatCurrency = (thb: number): string => {
  return new Intl.NumberFormat('th-TH', {
    style: 'currency',
    currency: 'THB',
    maximumFractionDigits: 0,
  }).format(thb);
};

const formatDate = (iso: string): string =>
  new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

const formatMonth = (iso: string): string =>
  new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
  });

/**
 * Status → colour comes from the single mapping in doc 06 §3.4; builders never
 * choose status colours ad hoc. Every chip carries its label text as well as
 * its colour, so colour is never the only signal.
 */
const STATUS_CLASSES: Record<OwnerStatementStatus, string> = {
  draft: 'bg-surface-paper text-text-stone border border-border-line',
  published: 'bg-state-info-soft text-state-info',
  pending_owner_review: 'bg-state-warning-soft text-state-warning',
  signed_off: 'bg-state-success-soft text-state-success',
  distributed: 'bg-state-success-soft text-state-success',
  superseded: 'bg-surface-paper text-text-stone border border-border-line',
};

/** A row of the breakdown: its label, its figure, and the lines behind it. */
interface BreakdownRow {
  key: string;
  labelKey: string;
  amount: number | null;
  /** The line-item category this figure is made of, when it has one. */
  category: LineItemCategory | null;
  /** Subtotals (NOI, distributable cash) are emphasised, not itemised. */
  emphasis?: boolean;
  /** Costs are shown as deductions from the gross. */
  deduction?: boolean;
  /** Free-text basis shown under the row (the performance fee's calc basis). */
  note?: string | null;
}

export const OwnerStatementDetailClient: React.FC<OwnerStatementDetailClientProps> = ({
  statement,
  labels,
}) => {
  const [openRow, setOpenRow] = useState<string | null>(null);
  const [signingOff, setSigningOff] = useState(false);
  const [signOffError, setSignOffError] = useState<string | null>(null);
  const [ownerSignedAt, setOwnerSignedAt] = useState<string | null>(
    statement.signedOffByOwnerAt
  );
  const [operatorSignedAt, setOperatorSignedAt] = useState<string | null>(
    statement.signedOffByOperatorAt
  );
  const [approvedAt, setApprovedAt] = useState<string | null>(statement.approvedAt);

  // Group the line items by category and total each group; the breakdown rows
  // open onto their own group, so a figure is never shown without its sources.
  const grouped = new Map<LineItemCategory, StatementLine[]>();
  const groupTotals = new Map<LineItemCategory, number>();
  for (const line of statement.lines) {
    const group = grouped.get(line.category) ?? [];
    group.push(line);
    grouped.set(line.category, group);
    groupTotals.set(line.category, (groupTotals.get(line.category) ?? 0) + line.amountTh);
  }

  const refundsTotal = groupTotals.get('refund') ?? null;

  // A statement written before the transparency block exists only as the
  // original figures; say so rather than rendering a wall of blanks.
  const hasTransparencyBlock = statement.adjustedNoiTh !== null;

  const transparencyRows: BreakdownRow[] = [
    {
      key: 'gross_bookings',
      labelKey: 'owner.statement.gross_bookings',
      amount: statement.grossBookingsAmountTh,
      category: 'booking_revenue',
    },
    {
      key: 'guest_payments_received',
      labelKey: 'owner.statement.guest_payments_received',
      amount: statement.guestPaymentsReceivedTh,
      category: null,
    },
    {
      key: 'refunds',
      labelKey: 'owner.statement.refunds',
      amount: refundsTotal,
      category: 'refund',
      deduction: true,
    },
    {
      key: 'service_fees',
      labelKey: 'owner.statement.service_fees',
      amount: statement.serviceFeesAmountTh,
      category: 'service_fee',
      deduction: true,
    },
    {
      key: 'operating_expenses',
      labelKey: 'owner.statement.operating_expenses',
      amount: statement.operatingExpensesAmountTh,
      category: 'operating_expense',
      deduction: true,
    },
    {
      key: 'taxes',
      labelKey: 'owner.statement.taxes',
      amount: statement.taxesAmountTh,
      category: 'tax',
      deduction: true,
    },
    {
      key: 'adjusted_noi',
      labelKey: 'owner.statement.adjusted_noi',
      amount: statement.adjustedNoiTh,
      category: null,
      emphasis: true,
    },
    {
      key: 'performance_fee',
      labelKey: 'owner.statement.performance_fee',
      amount: statement.performanceFeeAmountTh,
      category: 'performance_fee',
      deduction: true,
      note: statement.performanceFeeBasisText,
    },
    {
      key: 'distributable_cash',
      labelKey: 'owner.statement.distributable_cash',
      amount: statement.distributableCashTh,
      category: null,
      emphasis: true,
    },
  ];

  const originalFigureRows: BreakdownRow[] = [
    {
      key: 'gross_revenue',
      labelKey: 'owner.statement.gross_revenue',
      amount: statement.grossRevenueTh,
      category: 'booking_revenue',
    },
    {
      key: 'total_costs',
      labelKey: 'owner.statement.total_costs',
      amount: statement.totalCostsTh,
      category: null,
      deduction: true,
    },
    {
      key: 'noi',
      labelKey: 'owner.statement.noi',
      amount: statement.noiTh,
      category: null,
      emphasis: true,
    },
  ];

  // A figure that was never recorded is left out rather than shown as zero —
  // a statement never guesses (CLAUDE.md money rules).
  const rows: BreakdownRow[] = hasTransparencyBlock
    ? transparencyRows.filter((row) => row.amount !== null)
    : originalFigureRows;

  const handleSignOff = async () => {
    setSigningOff(true);
    setSignOffError(null);
    try {
      const response = await fetch(
        `/api/owner/statements/${statement.id}/sign-off`,
        { method: 'PUT' }
      );
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(labels['owner.statement.signoff_error']);
      }
      setOwnerSignedAt(data?.statement?.signedOffByOwnerAt ?? new Date().toISOString());
      setOperatorSignedAt(data?.statement?.signedOffByOperatorAt ?? operatorSignedAt);
      setApprovedAt(data?.statement?.approvedAt ?? approvedAt);
    } catch {
      setSignOffError(labels['owner.statement.signoff_error']);
    } finally {
      setSigningOff(false);
    }
  };

  const renderAmount = (amount: number, deduction?: boolean) =>
    deduction && amount !== 0 ? `− ${formatCurrency(amount)}` : formatCurrency(amount);

  return (
    <div className="min-h-screen bg-surface-background">
      <div className="max-w-6xl mx-auto px-24 py-40">
        {/* Header */}
        <div className="mb-40">
          <Link
            href="/owner"
            className="text-small text-brand-andaman hover:text-brand-deep transition-colors duration-micro"
          >
            {labels['owner.statement.back']}
          </Link>
          <div className="flex flex-wrap items-start justify-between gap-16 mt-12">
            <div>
              <h1 className="text-heading-1 font-bold text-text-ink mb-8">
                {labels['owner.statement.detail_title']}
              </h1>
              <p className="text-body text-text-secondary">
                {labels['owner.statement.unit']}: {statement.unitName}
              </p>
              <p className="text-body text-text-secondary">
                {labels['owner.statement.period']}: {formatMonth(statement.periodStart)} –{' '}
                {formatMonth(statement.periodEnd)}
              </p>
              {statement.publishedAt && (
                <p className="text-small text-text-stone mt-4">
                  {labels['owner.statement.published_on']}:{' '}
                  {formatDate(statement.publishedAt)}
                </p>
              )}
            </div>
            <span
              className={`inline-flex items-center px-16 py-8 rounded-full text-small font-medium ${
                STATUS_CLASSES[statement.status]
              }`}
            >
              {labels[`common.status.statement.${statement.status}`]}
            </span>
          </div>
        </div>

        {/* Summary tiles */}
        <div className="mb-40">
          <h2 className="text-heading-2 font-semibold text-text-ink mb-16">
            {labels['owner.statement.summary_title']}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-20">
            <StatTile
              label={labels['owner.statement.gross_bookings']}
              value={formatCurrency(
                statement.grossBookingsAmountTh ?? statement.grossRevenueTh
              )}
              variant="revenue"
            />
            <StatTile
              label={labels['owner.statement.adjusted_noi']}
              value={formatCurrency(statement.adjustedNoiTh ?? statement.noiTh)}
              variant="neutral"
            />
            <StatTile
              label={labels['owner.statement.distributable_cash']}
              value={formatCurrency(
                statement.distributableCashTh ?? statement.noiTh
              )}
              variant="neutral"
            />
            <StatTile
              label={labels['owner.statement.your_share']}
              value={formatCurrency(statement.ownerShareTh)}
              variant="occupancy"
            />
          </div>
        </div>

        {/* Breakdown — every figure opens onto the lines behind it */}
        <div className="mb-40">
          <h2 className="text-heading-2 font-semibold text-text-ink mb-8">
            {labels['owner.statement.breakdown_title']}
          </h2>
          <p className="text-body text-text-secondary mb-16">
            {labels['owner.statement.breakdown_subtitle']}
          </p>

          {!hasTransparencyBlock && (
            <div className="bg-state-warning-soft border border-state-warning rounded-md p-16 mb-16">
              <p className="text-body text-text-ink">
                {labels['owner.statement.legacy_notice']}
              </p>
            </div>
          )}

          <div className="bg-surface-paper border border-border-line rounded-md">
            {rows.map((row) => {
              const lines = row.category ? grouped.get(row.category) ?? [] : [];
              const isOpen = openRow === row.key;
              return (
                <div
                  key={row.key}
                  className="border-b border-border-line last:border-b-0"
                >
                  <div className="flex items-center justify-between gap-16 p-24">
                    <div className="min-w-0">
                      <p
                        className={`text-body text-text-ink ${
                          row.emphasis ? 'font-semibold' : ''
                        }`}
                      >
                        {labels[row.labelKey]}
                      </p>
                      {row.note && (
                        <p className="text-small text-text-stone mt-4">
                          {labels['owner.statement.performance_fee_basis']}: {row.note}
                        </p>
                      )}
                      {row.category && (
                        <button
                          type="button"
                          aria-expanded={isOpen}
                          aria-controls={`statement-lines-${row.key}`}
                          onClick={() => setOpenRow(isOpen ? null : row.key)}
                          className="text-small text-brand-andaman hover:text-brand-deep transition-colors duration-micro mt-4"
                        >
                          {isOpen
                            ? labels['owner.statement.lines_hide']
                            : labels['owner.statement.lines_show']}
                        </button>
                      )}
                    </div>
                    <p
                      className={`text-body text-text-ink whitespace-nowrap ${
                        row.emphasis ? 'font-semibold' : 'font-medium'
                      }`}
                    >
                      {renderAmount(row.amount ?? 0, row.deduction)}
                    </p>
                  </div>

                  {row.category && isOpen && (
                    <div
                      id={`statement-lines-${row.key}`}
                      className="border-t border-border-line bg-surface-background px-24 py-16"
                    >
                      <p className="text-small text-text-stone mb-12">
                        {labels[`common.line_item_category.${row.category}`]}
                      </p>
                      {lines.length === 0 ? (
                        <p className="text-body text-text-secondary">
                          {labels['owner.statement.lines_empty']}
                        </p>
                      ) : (
                        <ul className="space-y-12">
                          {lines.map((line) => (
                            <li
                              key={line.id}
                              className="flex items-start justify-between gap-16"
                            >
                              <div className="min-w-0">
                                <p className="text-body text-text-ink break-words">
                                  {line.description}
                                </p>
                                {line.bookingId && (
                                  <p className="text-small text-text-stone mt-4">
                                    {labels['owner.statement.booking_ref']}:{' '}
                                    {line.bookingId}
                                    {line.bookingStartDate && line.bookingEndDate
                                      ? ` · ${formatDate(line.bookingStartDate)} – ${formatDate(line.bookingEndDate)}`
                                      : ''}
                                  </p>
                                )}
                              </div>
                              <p className="text-body font-medium text-text-ink whitespace-nowrap">
                                {formatCurrency(line.amountTh)}
                              </p>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {statement.lines.length === 0 && (
            <EmptyState title={labels['owner.statement.lines_empty_all']} />
          )}
        </div>

        {/* The split — owner share, myUNO share, and the cap when it bound */}
        <div className="mb-40">
          <h2 className="text-heading-2 font-semibold text-text-ink mb-16">
            {labels['owner.statement.split_title']}
          </h2>
          <div className="bg-surface-paper border border-border-line rounded-md p-24 space-y-12">
            <div className="flex justify-between gap-16">
              <span className="text-body text-text-secondary">
                {labels['owner.statement.your_share']}
              </span>
              <span className="text-body font-semibold text-text-ink">
                {formatCurrency(statement.ownerShareTh)}
              </span>
            </div>
            <div className="flex justify-between gap-16">
              <span className="text-body text-text-secondary">
                {labels['owner.statement.estate_share']}
              </span>
              <span className="text-body font-medium text-text-ink">
                {formatCurrency(statement.estateShareTh)}
              </span>
            </div>
            {statement.capApplied && (
              <div className="bg-state-info-soft rounded-md p-16">
                <p className="text-body font-medium text-text-ink mb-4">
                  {labels['owner.statement.cap_applied']}
                </p>
                <p className="text-small text-text-secondary">
                  {labels['owner.statement.cap_applied_note']}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Sign-off */}
        <div className="mb-40">
          <h2 className="text-heading-2 font-semibold text-text-ink mb-16">
            {labels['owner.statement.signoff_title']}
          </h2>
          <div className="bg-surface-paper border border-border-line rounded-md p-24">
            <div className="space-y-12 mb-16">
              <div className="flex justify-between gap-16">
                <span className="text-body text-text-secondary">
                  {ownerSignedAt
                    ? labels['owner.statement.signoff_owner_signed']
                    : labels['owner.statement.signoff_awaiting_owner']}
                </span>
                <span
                  className={`text-body font-medium ${
                    ownerSignedAt ? 'text-state-success' : 'text-state-warning'
                  }`}
                >
                  {ownerSignedAt ? formatDate(ownerSignedAt) : '—'}
                </span>
              </div>
              <div className="flex justify-between gap-16">
                <span className="text-body text-text-secondary">
                  {operatorSignedAt
                    ? labels['owner.statement.signoff_operator_signed']
                    : labels['owner.statement.signoff_awaiting_operator']}
                </span>
                <span
                  className={`text-body font-medium ${
                    operatorSignedAt ? 'text-state-success' : 'text-state-warning'
                  }`}
                >
                  {operatorSignedAt ? formatDate(operatorSignedAt) : '—'}
                </span>
              </div>
              {approvedAt && (
                <div className="flex justify-between gap-16">
                  <span className="text-body text-text-secondary">
                    {labels['owner.statement.signoff_approved']}
                  </span>
                  <span className="text-body font-medium text-state-success">
                    {formatDate(approvedAt)}
                  </span>
                </div>
              )}
            </div>

            {!ownerSignedAt && (
              <>
                <p className="text-body text-text-secondary mb-16">
                  {labels['owner.statement.signoff_description']}
                </p>
                <Button
                  variant="primary"
                  onClick={handleSignOff}
                  isLoading={signingOff}
                  disabled={signingOff}
                >
                  {labels['owner.statement.signoff_action']}
                </Button>
              </>
            )}

            {signOffError && (
              <p
                role="alert"
                aria-live="polite"
                className="text-body text-state-error mt-16"
              >
                {signOffError}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
