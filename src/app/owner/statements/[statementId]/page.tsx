import React from 'react';
import { notFound, redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { getLabels } from '@/lib/i18n';
import { track } from '@/modules/analytics';
import { OWNER_VISIBLE_STATEMENT_STATUSES } from '@/modules/finance';
import { OwnerStatementDetailClient, type StatementDetail } from './client';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: { statementId: string };
}

/**
 * S8 · Owner: statement detail (doc 06 §4, doc 07 F-OWN-3).
 *
 * The transparency block CLAUDE.md requires — gross bookings, service fees,
 * expenses, adjusted NOI, distributable cash and the performance fee with its
 * basis — with every figure openable down to the line items behind it.
 *
 * Scope is enforced in the query, never in the UI: the statement must belong to
 * the signed-in owner and must have passed the admin sign-off gate. Anything
 * else is a 404, not a rendered page.
 */
export default async function OwnerStatementDetailPage({ params }: PageProps) {
  const user = await getCurrentUser();
  if (!user) {
    redirect(`/login?next=/owner/statements/${params.statementId}`);
  }

  const statement = await prisma.ownerStatement.findFirst({
    where: {
      id: params.statementId,
      ownerIdentityId: user.identityId,
      status: { in: OWNER_VISIBLE_STATEMENT_STATUSES },
    },
    include: {
      unit: { select: { id: true, name: true, projectId: true } },
      lineItems: {
        orderBy: [{ category: 'asc' }, { createdAt: 'asc' }],
        include: {
          booking: { select: { id: true, startDate: true, endDate: true } },
        },
      },
    },
  });

  if (!statement) {
    notFound();
  }

  await track(prisma, 'owner_statement_viewed', {
    identityId: user.identityId,
    statementId: statement.id,
    unitId: statement.unit.id,
    projectId: statement.unit.projectId,
  }).catch(() => null);

  const detail: StatementDetail = {
    id: statement.id,
    unitName: statement.unit.name,
    periodStart: statement.periodStart.toISOString(),
    periodEnd: statement.periodEnd.toISOString(),
    status: statement.status,
    publishedAt: statement.publishedAt?.toISOString() ?? null,
    approvedAt: statement.approvedAt?.toISOString() ?? null,
    signedOffByOwnerAt: statement.signedOffByOwnerAt?.toISOString() ?? null,
    signedOffByOperatorAt: statement.signedOffByOperatorAt?.toISOString() ?? null,

    grossBookingsAmountTh: statement.grossBookingsAmountTh,
    guestPaymentsReceivedTh: statement.guestPaymentsReceivedTh,
    serviceFeesAmountTh: statement.serviceFeesAmountTh,
    operatingExpensesAmountTh: statement.operatingExpensesAmountTh,
    taxesAmountTh: statement.taxesAmountTh,
    adjustedNoiTh: statement.adjustedNoiTh,
    distributableCashTh: statement.distributableCashTh,
    performanceFeeAmountTh: statement.performanceFeeAmountTh,
    performanceFeeBasisText: statement.performanceFeeBasisText,

    grossRevenueTh: statement.grossRevenueTh,
    totalCostsTh: statement.totalCostsTh,
    noiTh: statement.noiTh,
    ownerShareTh: statement.ownerShareTh,
    estateShareTh: statement.estateShareTh,
    capApplied: statement.capApplied,

    lines: statement.lineItems.map((line) => ({
      id: line.id,
      category: line.category,
      description: line.description,
      amountTh: line.amountTh,
      bookingId: line.bookingId,
      bookingStartDate: line.booking?.startDate.toISOString() ?? null,
      bookingEndDate: line.booking?.endDate.toISOString() ?? null,
    })),
  };

  const labels = await getLabels({
    'owner.statement.back': 'Back to dashboard',
    'owner.statement.detail_title': 'Statement',
    'owner.statement.unit': 'Unit',
    'owner.statement.period': 'Period',
    'owner.statement.published_on': 'Published',
    'owner.statement.summary_title': 'Summary',
    'owner.statement.breakdown_title': 'How this statement was calculated',
    'owner.statement.breakdown_subtitle':
      'Every figure below traces to the rows behind it. Open a figure to see its source lines.',
    'owner.statement.gross_bookings': 'Gross bookings',
    'owner.statement.guest_payments_received': 'Guest payments received',
    'owner.statement.refunds': 'Refunds',
    'owner.statement.service_fees': 'Service fees',
    'owner.statement.operating_expenses': 'Operating expenses',
    'owner.statement.taxes': 'Taxes',
    'owner.statement.adjusted_noi': 'Adjusted net operating income',
    'owner.statement.performance_fee': 'Performance fee',
    'owner.statement.performance_fee_basis': 'Calculated on',
    'owner.statement.distributable_cash': 'Distributable cash',
    'owner.statement.your_share': 'Your Share',
    'owner.statement.estate_share': 'myUNO share',
    'owner.statement.gross_revenue': 'Gross revenue',
    'owner.statement.total_costs': 'Total costs',
    'owner.statement.noi': 'Net Income',
    'owner.statement.cap_applied': 'NOI cap applied',
    'owner.statement.cap_applied_note':
      'Your share for this period was limited by the annual NOI cap in your management contract.',
    'owner.statement.split_title': 'How the result is split',
    'owner.statement.lines_show': 'Show source lines',
    'owner.statement.lines_hide': 'Hide source lines',
    'owner.statement.lines_empty': 'No source lines recorded for this figure.',
    'owner.statement.lines_empty_all':
      'This statement has no source lines yet. Message us and we will trace every figure for you.',
    'owner.statement.booking_ref': 'Booking',
    'owner.statement.legacy_notice':
      'This statement predates the itemised breakdown. The figures recorded at the time are shown below.',
    'owner.statement.signoff_title': 'Sign-off',
    'owner.statement.signoff_description':
      'Signing records that you have reviewed the figures on this statement.',
    'owner.statement.signoff_action': 'Sign off this statement',
    'owner.statement.signoff_owner_signed': 'Signed by you',
    'owner.statement.signoff_operator_signed': 'Signed by myUNO',
    'owner.statement.signoff_awaiting_owner': 'Awaiting your signature',
    'owner.statement.signoff_awaiting_operator': 'Awaiting myUNO’s signature',
    'owner.statement.signoff_approved': 'Approved',
    'owner.statement.signoff_error':
      'We could not record your sign-off. Please try again.',
    'common.status.statement.draft': 'Draft',
    'common.status.statement.published': 'Published',
    'common.status.statement.superseded': 'Superseded',
    'common.status.statement.pending_owner_review': 'Awaiting your review',
    'common.status.statement.signed_off': 'Signed off',
    'common.status.statement.distributed': 'Paid out',
    'common.line_item_category.booking_revenue': 'Booking revenue',
    'common.line_item_category.refund': 'Refunds',
    'common.line_item_category.service_fee': 'Service fees',
    'common.line_item_category.operating_expense': 'Operating expenses',
    'common.line_item_category.tax': 'Taxes',
    'common.line_item_category.performance_fee': 'Performance fee',
  });

  return <OwnerStatementDetailClient statement={detail} labels={labels} />;
}
