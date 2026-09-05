'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Button, StatTile, EmptyState, MoneyAmount } from '@/components';
import { SIGNABLE_STATEMENT_STATUSES } from '@/modules/finance';
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

export interface StatementPayout {
  id: string;
  amountTh: number;
  method: string;
  reference: string;
  executedOn: string;
  status: string;
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
  payout: StatementPayout | null;
  questionThreadId: string | null;
}

interface OwnerStatementDetailClientProps {
  statement: StatementDetail;
  labels: Record<string, string>;
}

// StatementDetail's *Th fields arrive already converted to baht (the page
// server component does the satang -> baht conversion once, at the boundary
// — Q47). MoneyAmount's contract is satang-in, so every figure here is
// multiplied back by 100 at the call site rather than reimplementing a
// baht-in formatter — one shared component, one conversion rule.
const toSatang = (baht: number): number => Math.round(baht * 100);

const formatDate = (iso: string): string =>
  new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'Asia/Bangkok',
  });

const formatMonth = (iso: string): string =>
  new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    timeZone: 'Asia/Bangkok',
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
  const [status, setStatus] = useState<OwnerStatementStatus>(statement.status);
  const [ownerSignedAt, setOwnerSignedAt] = useState<string | null>(
    statement.signedOffByOwnerAt
  );
  const [operatorSignedAt, setOperatorSignedAt] = useState<string | null>(
    statement.signedOffByOperatorAt
  );
  const [approvedAt, setApprovedAt] = useState<string | null>(statement.approvedAt);
  const [disputeOpen, setDisputeOpen] = useState(false);
  const [disputeTitle, setDisputeTitle] = useState('');
  const [disputeDescription, setDisputeDescription] = useState('');
  const [disputeSent, setDisputeSent] = useState(false);
  const [disputeBusy, setDisputeBusy] = useState(false);
  const [disputeError, setDisputeError] = useState<string | null>(null);
  const [questionOpen, setQuestionOpen] = useState(false);
  const [questionBody, setQuestionBody] = useState('');
  const [questionBusy, setQuestionBusy] = useState(false);
  const [questionError, setQuestionError] = useState<string | null>(null);
  const [questionThreadId, setQuestionThreadId] = useState<string | null>(
    statement.questionThreadId
  );

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
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(
        `/api/owner/statements/${statement.id}/sign-off`,
        {
          method: 'PUT',
          signal: controller.signal,
        }
      );

      clearTimeout(timeout);
      const data = await response.json().catch(() => null);

      if (response.status === 409) {
        setSignOffError(labels['owner.statement.signoff_already_signed'] || labels['owner.statement.signoff_error']);
        return;
      }

      if (!response.ok) {
        throw new Error(data?.error || labels['owner.statement.signoff_error']);
      }

      // Update all fields from response
      if (data?.statement) {
        setStatus(data.statement.status);
        setOwnerSignedAt(data.statement.signedOffByOwnerAt);
        setOperatorSignedAt(data.statement.signedOffByOperatorAt);
        setApprovedAt(data.statement.approvedAt);
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        setSignOffError(labels['owner.statement.signoff_timeout'] || labels['owner.statement.signoff_error']);
      } else {
        const msg = err instanceof Error ? err.message : labels['owner.statement.signoff_error'];
        setSignOffError(msg);
      }
    } finally {
      setSigningOff(false);
    }
  };

  const handleDisputeSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!disputeTitle.trim() || !disputeDescription.trim()) return;
    setDisputeBusy(true);
    setDisputeError(null);
    try {
      const response = await fetch('/api/disputes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subjectType: 'statement',
          subjectId: statement.id,
          title: disputeTitle.trim(),
          description: disputeDescription.trim(),
        }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error || labels['owner.statement.dispute_error']);
      }
      setDisputeSent(true);
      setDisputeOpen(false);
      setDisputeTitle('');
      setDisputeDescription('');
    } catch (err) {
      setDisputeError(
        err instanceof Error ? err.message : labels['owner.statement.dispute_error']
      );
    } finally {
      setDisputeBusy(false);
    }
  };

  const handleQuestionSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!questionBody.trim()) return;
    setQuestionBusy(true);
    setQuestionError(null);
    try {
      const response = await fetch(`/api/owner/statements/${statement.id}/question`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: questionBody.trim() }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error || labels['owner.statement.question_error']);
      }
      const data = await response.json();
      setQuestionThreadId(data.threadId);
      setQuestionOpen(false);
      setQuestionBody('');
    } catch (err) {
      setQuestionError(
        err instanceof Error ? err.message : labels['owner.statement.question_error']
      );
    } finally {
      setQuestionBusy(false);
    }
  };

  const renderAmount = (amount: number, deduction?: boolean) => (
    <>
      {deduction && amount !== 0 ? '− ' : ''}
      <MoneyAmount satang={toSatang(amount)} />
    </>
  );

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
                STATUS_CLASSES[status]
              }`}
            >
              {labels[`common.status.statement.${status}`]}
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
              value={
                <MoneyAmount
                  satang={toSatang(
                    statement.grossBookingsAmountTh ?? statement.grossRevenueTh
                  )}
                />
              }
              variant="revenue"
            />
            <StatTile
              label={labels['owner.statement.adjusted_noi']}
              value={
                <MoneyAmount
                  satang={toSatang(statement.adjustedNoiTh ?? statement.noiTh)}
                />
              }
              variant="neutral"
            />
            <StatTile
              label={labels['owner.statement.distributable_cash']}
              value={
                <MoneyAmount
                  satang={toSatang(
                    statement.distributableCashTh ?? statement.noiTh
                  )}
                />
              }
              variant="neutral"
            />
            <StatTile
              label={labels['owner.statement.your_share']}
              value={<MoneyAmount satang={toSatang(statement.ownerShareTh)} />}
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
                                {renderAmount(line.amountTh, line.category === 'refund')}
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
                <MoneyAmount satang={toSatang(statement.ownerShareTh)} />
              </span>
            </div>
            <div className="flex justify-between gap-16">
              <span className="text-body text-text-secondary">
                {labels['owner.statement.estate_share']}
              </span>
              <span className="text-body font-medium text-text-ink">
                <MoneyAmount satang={toSatang(statement.estateShareTh)} />
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

            {!ownerSignedAt && SIGNABLE_STATEMENT_STATUSES.includes(status) && (
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

        {/* Payout */}
        <div className="mb-40">
          <h2 className="text-heading-2 font-semibold text-text-ink mb-16">
            {labels['owner.statement.payout_title']}
          </h2>
          <div className="bg-surface-paper border border-border-line rounded-md p-24">
            {statement.payout ? (
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-12 text-body">
                <div>
                  <dt className="text-text-secondary">{labels['owner.statement.payout_amount']}</dt>
                  <dd className="font-semibold text-text-ink">
                    <MoneyAmount satang={toSatang(statement.payout.amountTh)} />
                  </dd>
                </div>
                <div>
                  <dt className="text-text-secondary">{labels['owner.statement.payout_executed']}</dt>
                  <dd className="text-text-ink">{formatDate(statement.payout.executedOn)}</dd>
                </div>
                <div>
                  <dt className="text-text-secondary">{labels['owner.statement.payout_method']}</dt>
                  <dd className="text-text-ink">
                    {labels[`owner.statement.payout_method.${statement.payout.method}`] ||
                      statement.payout.method}
                  </dd>
                </div>
                <div>
                  <dt className="text-text-secondary">{labels['owner.statement.payout_reference']}</dt>
                  <dd className="text-text-ink font-mono">{statement.payout.reference}</dd>
                </div>
              </dl>
            ) : (
              <p className="text-body text-text-secondary">
                {labels['owner.statement.payout_pending']}
              </p>
            )}
          </div>
        </div>

        {/* Question thread */}
        <div className="mb-40">
          <h2 className="text-heading-2 font-semibold text-text-ink mb-16">
            {labels['owner.statement.question_title']}
          </h2>
          <div className="bg-surface-paper border border-border-line rounded-md p-24">
            <p className="text-body text-text-secondary mb-16">
              {labels['owner.statement.question_hint']}
            </p>
            {questionThreadId ? (
              <Link
                href={`/messages/${questionThreadId}`}
                className="inline-flex items-center text-body font-semibold text-brand-andaman hover:underline"
              >
                {labels['owner.statement.question_open_thread']}
              </Link>
            ) : null}
            {questionOpen ? (
              <form onSubmit={handleQuestionSubmit} className="flex flex-col gap-12 mt-16">
                <textarea
                  value={questionBody}
                  onChange={(event) => setQuestionBody(event.target.value)}
                  rows={4}
                  maxLength={4000}
                  className="px-12 py-8 rounded-sm bg-surface-paper border border-border-line text-text-ink focus:border-brand-andaman focus:outline-none"
                  placeholder={labels['owner.statement.question_placeholder']}
                />
                {questionError ? (
                  <p role="alert" className="text-body text-state-error">
                    {questionError}
                  </p>
                ) : null}
                <div className="flex gap-12">
                  <Button
                    type="submit"
                    variant="secondary"
                    isLoading={questionBusy}
                    disabled={!questionBody.trim()}
                  >
                    {labels['owner.statement.question_submit']}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setQuestionOpen(false)}
                    disabled={questionBusy}
                  >
                    {labels['owner.statement.question_cancel']}
                  </Button>
                </div>
              </form>
            ) : !questionThreadId ? (
              <Button variant="ghost" onClick={() => setQuestionOpen(true)}>
                {labels['owner.statement.question_open']}
              </Button>
            ) : null}
          </div>
        </div>

        {/* Dispute */}
        <div className="mb-40">
          <h2 className="text-heading-2 font-semibold text-text-ink mb-16">
            {labels['owner.statement.dispute_title']}
          </h2>
          <div className="bg-surface-paper border border-border-line rounded-md p-24">
            {disputeSent && !disputeOpen && (
              <p className="text-body text-state-success mb-16">
                {labels['owner.statement.dispute_sent']}
              </p>
            )}
            {disputeOpen ? (
              <form onSubmit={handleDisputeSubmit} className="flex flex-col gap-12">
                <div className="flex flex-col gap-4">
                  <label htmlFor="statement-dispute-title" className="text-small text-text-secondary">
                    {labels['owner.statement.dispute_title_field']}
                  </label>
                  <input
                    id="statement-dispute-title"
                    type="text"
                    value={disputeTitle}
                    onChange={(e) => setDisputeTitle(e.target.value)}
                    maxLength={200}
                    className="h-48 px-12 rounded-sm bg-surface-paper border border-border-line text-text-ink focus:border-brand-andaman focus:outline-none"
                  />
                </div>
                <div className="flex flex-col gap-4">
                  <label
                    htmlFor="statement-dispute-description"
                    className="text-small text-text-secondary"
                  >
                    {labels['owner.statement.dispute_description_field']}
                  </label>
                  <textarea
                    id="statement-dispute-description"
                    value={disputeDescription}
                    onChange={(e) => setDisputeDescription(e.target.value)}
                    rows={4}
                    maxLength={4000}
                    className="px-12 py-8 rounded-sm bg-surface-paper border border-border-line text-text-ink focus:border-brand-andaman focus:outline-none"
                  />
                </div>
                {disputeError && (
                  <p role="alert" className="text-body text-state-error">
                    {disputeError}
                  </p>
                )}
                <div className="flex gap-12">
                  <Button
                    type="submit"
                    variant="secondary"
                    isLoading={disputeBusy}
                    disabled={!disputeTitle.trim() || !disputeDescription.trim()}
                  >
                    {labels['owner.statement.dispute_submit']}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setDisputeOpen(false)}
                    disabled={disputeBusy}
                  >
                    {labels['owner.statement.dispute_cancel']}
                  </Button>
                </div>
              </form>
            ) : (
              <Button
                variant="ghost"
                onClick={() => {
                  setDisputeOpen(true);
                  setDisputeSent(false);
                }}
              >
                {labels['owner.statement.dispute_open']}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
