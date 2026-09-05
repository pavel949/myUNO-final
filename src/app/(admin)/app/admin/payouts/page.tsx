import { prisma } from '@/lib/prisma';
import { getLabels } from '@/lib/i18n';
import PayoutForms from './payout-forms';
import PayoutsTable from './payouts-table';

export const dynamic = 'force-dynamic';

export default async function AdminPayoutsPage() {
  const payouts = await prisma.payout.findMany({
    include: {
      recordedBy: { select: { firstName: true, lastName: true } },
      provider: { select: { name: true } },
      ownerStatement: { select: { id: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  // Eligible for a payout: a statement past the admin sign-off gate (Q18)
  // with no owner payout recorded against it yet.
  const eligibleStatements = await prisma.ownerStatement.findMany({
    where: {
      status: { in: ['signed_off', 'published', 'distributed'] },
      payouts: { none: { payeeType: 'owner' } },
    },
    select: {
      id: true,
      periodStart: true,
      periodEnd: true,
      ownerShareTh: true,
      unit: { select: { name: true } },
    },
    orderBy: { periodEnd: 'desc' },
    take: 100,
  });

  const providers = await prisma.provider.findMany({
    where: { status: 'active' },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });

  const labels = await getLabels({
    'admin.payouts.title': 'Payouts',
    'admin.payouts.empty': 'No payouts recorded.',
    'admin.payouts.reference': 'Reference',
    'admin.payouts.amount': 'Amount (฿)',
    'admin.payouts.status': 'Status',
    'admin.payouts.recorded_by': 'Recorded By',
    'admin.payouts.record_title': 'Record a payout',
    'admin.payouts.owner_tab': 'Owner payout',
    'admin.payouts.provider_tab': 'Provider payout',
    'admin.payouts.owner_statement': 'Statement',
    'admin.payouts.period_to': 'to',
    'admin.payouts.owner_statement_empty':
      'No signed-off statement is waiting for a payout.',
    'admin.payouts.owner_share': 'Owner share (locked to the statement)',
    'admin.payouts.provider_field': 'Provider',
    'admin.payouts.provider_empty': 'No active providers.',
    'admin.payouts.period_start': 'Period start',
    'admin.payouts.period_end': 'Period end',
    'admin.payouts.compute': 'Compute remittance',
    'admin.payouts.computing': 'Computing…',
    'admin.payouts.net_amount': 'Net remittance',
    'admin.payouts.fulfilled_total': 'Fulfilled orders total',
    'admin.payouts.take_rate': 'myUNO take rate',
    'admin.payouts.refunds_clawed_back': 'Refunds clawed back',
    'admin.payouts.reference_field': 'Reference (bank transfer ref, receipt no.)',
    'admin.payouts.executed_on': 'Paid on',
    'admin.payouts.submit': 'Record payout',
    'admin.payouts.working': 'Recording…',
    'admin.payouts.success': 'Payout recorded.',
    'admin.payouts.error': 'That did not work.',
    'admin.payouts.compute_first': 'Compute the remittance before recording.',
    'admin.payouts.history_title': 'Payout history',
    'admin.payouts.reconciliation_link': 'Open reconciliation board →',
    'admin.payouts.payee_type': 'Payee',
    'admin.payouts.payee_owner': 'Owner',
    'admin.payouts.payee_provider': 'Provider',
    'admin.payouts.status_recorded': 'Recorded',
    'admin.payouts.status_reconciled': 'Reconciled',
    'admin.payouts.reconcile': 'Mark reconciled',
    'admin.payouts.action': 'Action',
  });

  return (
    <div>
      <h1 className="font-display text-display-xl font-semibold text-text-ink mb-24">
        {labels['admin.payouts.title']}
      </h1>

      <PayoutForms
        eligibleStatements={eligibleStatements.map((s) => ({
          id: s.id,
          unitName: s.unit.name,
          periodStart: s.periodStart.toISOString(),
          periodEnd: s.periodEnd.toISOString(),
          ownerShareTh: s.ownerShareTh,
        }))}
        providers={providers}
        labels={labels}
      />

      <PayoutsTable
        payouts={payouts.map((p) => ({
          id: p.id,
          reference: p.reference,
          amountThb: p.amountThb,
          status: p.status,
          payeeType: p.payeeType,
          recordedByName: `${p.recordedBy?.firstName ?? ''} ${p.recordedBy?.lastName ?? ''}`.trim(),
        }))}
        labels={labels}
      />
    </div>
  );
}
