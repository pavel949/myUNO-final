import { prisma } from '@/lib/prisma';
import { getLabels } from '@/lib/i18n';
import PayoutForms from './payout-forms';

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
  });

  return (
    <div>
      <h1 className="text-heading-1 font-bold text-text-ink mb-24">
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

      <h2 className="text-heading-3 font-bold text-text-ink mt-40 mb-16">
        {labels['admin.payouts.title']}
      </h2>
      {payouts.length === 0 ? (
        <p className="text-body text-text-secondary">{labels['admin.payouts.empty']}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-small">
            <thead>
              <tr className="border-b border-border-line">
                <th className="px-12 py-12 text-left">{labels['admin.payouts.reference']}</th>
                <th className="px-12 py-12 text-right">{labels['admin.payouts.amount']}</th>
                <th className="px-12 py-12 text-left">{labels['admin.payouts.status']}</th>
                <th className="px-12 py-12 text-left">{labels['admin.payouts.recorded_by']}</th>
              </tr>
            </thead>
            <tbody>
              {payouts.map((p) => (
                <tr key={p.id} className="border-b border-border-line">
                  <td className="px-12 py-8 font-mono">{p.reference}</td>
                  <td className="px-12 py-8 text-right font-mono">{(p.amountThb / 100).toFixed(2)}</td>
                  <td className="px-12 py-8">{p.status}</td>
                  <td className="px-12 py-8">
                    {`${p.recordedBy?.firstName} ${p.recordedBy?.lastName}`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
